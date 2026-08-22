// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MathBlocGame
 * @notice Educational math game contract deployed on Celo.
 *         Tracks daily activity, scores, streaks, and distributes CELO rewards.
 *
 *         Security model:
 *         - Session results require an EIP-712 signature from a trusted signer
 *           (when sessionSigner != address(0)), preventing forged on-chain submissions.
 *         - Daily base reward is awarded at most once per player per day.
 *         - Input bounds enforce sane score/attempt ranges.
 *         - Per-player nonces prevent replay attacks.
 *         - Emergency pause halts all activity recording and claims.
 */
contract MathBlocGame is Ownable, ReentrancyGuard, Pausable, EIP712 {

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Player {
        string  username;
        uint256 totalScore;
        uint256 totalCorrect;
        uint256 totalAttempts;
        uint256 streak;           // consecutive daily activity days
        uint256 lastActivityDay;  // day number (block.timestamp / 1 days)
        uint256 coinsEarned;      // on-chain coin balance
        uint256 registeredAt;
        bool    exists;
    }

    struct DailyActivity {
        uint256 score;
        uint256 correct;
        uint256 attempts;
        string  topicPlayed;      // e.g. "addition"
        uint256 timestamp;
    }

    struct LeaderboardEntry {
        address player;
        string  username;
        uint256 totalScore;
        uint256 streak;
    }

    // ─── Constants ──────────────────────────────────────────────────────────

    uint256 public constant DAILY_REWARD_COINS   = 10;
    uint256 public constant STREAK_BONUS_COINS   = 5;   // extra per streak milestone (every 7 days)
    uint256 public constant PERFECT_SCORE_BONUS  = 20;
    uint256 public constant CELO_REWARD_THRESHOLD = 100; // coins needed to claim CELO
    uint256 public constant CELO_REWARD_AMOUNT   = 0.001 ether; // 0.001 CELO per claim
    uint256 public constant MAX_ATTEMPTS_PER_SESSION = 100;
    uint256 public constant MAX_SCORE_PER_SESSION = 1000;
    uint256 public constant MAX_SESSIONS_PER_DAY  = 10;

    // EIP-712 type hash for session attestation
    bytes32 public constant SESSION_TYPEHASH = keccak256(
        "Session(address player,uint256 score,uint256 correct,uint256 attempts,string topic,uint256 nonce,uint256 deadline)"
    );

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => Player) public players;
    mapping(address => DailyActivity[]) public activityHistory;
    mapping(uint256 => address[]) public dailyActivePlayers; // day => players active that day

    address[] public registeredPlayers;

    uint256 public totalActiveDays;   // global stat
    uint256 public rewardPool;        // CELO deposited by owner for rewards

    /// @notice Trusted signer for session attestations. When address(0), signatures are not required.
    address public sessionSigner;

    /// @notice Per-player nonce for replay protection.
    mapping(address => uint256) public nonces;

    /// @notice Tracks whether the daily base reward has been claimed for a player on a given day.
    mapping(address => mapping(uint256 => bool)) public dailyRewardClaimed;

    /// @notice Number of sessions recorded per player per day.
    mapping(address => mapping(uint256 => uint256)) public dailySessionCount;

    // ─── Events ─────────────────────────────────────────────────────────────

    event PlayerRegistered(address indexed player, string username, uint256 timestamp);
    event ActivityRecorded(address indexed player, string topic, uint256 score, uint256 correct, uint256 attempts, uint256 day);
    event StreakUpdated(address indexed player, uint256 streak);
    event CoinsEarned(address indexed player, uint256 amount, string reason);
    event CeloClaimed(address indexed player, uint256 amount);
    event RewardPoolFunded(uint256 amount);
    event SessionSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyRegistered() {
        require(players[msg.sender].exists, "Not registered");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) EIP712("MathBlocGame", "2") {}

    // ─── Registration ───────────────────────────────────────────────────────

    /**
     * @notice Register a new player wallet with a username.
     */
    function register(string calldata username) external whenNotPaused {
        require(!players[msg.sender].exists, "Already registered");
        require(bytes(username).length > 0 && bytes(username).length <= 32, "Invalid username");

        players[msg.sender] = Player({
            username:        username,
            totalScore:      0,
            totalCorrect:    0,
            totalAttempts:   0,
            streak:          0,
            lastActivityDay: 0,
            coinsEarned:     0,
            registeredAt:    block.timestamp,
            exists:          true
        });

        registeredPlayers.push(msg.sender);
        emit PlayerRegistered(msg.sender, username, block.timestamp);
    }

    // ─── Daily Activity ─────────────────────────────────────────────────────

    /**
     * @notice Record a game session result with an optional signed attestation.
     * @param score      Total score achieved in the session (max MAX_SCORE_PER_SESSION)
     * @param correct    Number of correct answers
     * @param attempts   Total questions attempted (max MAX_ATTEMPTS_PER_SESSION)
     * @param topic      Topic played (e.g. "addition", "multiplication")
     * @param deadline   Attestation expiry timestamp (0 if signer not set)
     * @param signature  EIP-712 signature from sessionSigner (empty if signer not set)
     */
    function recordActivity(
        uint256 score,
        uint256 correct,
        uint256 attempts,
        string calldata topic,
        uint256 deadline,
        bytes calldata signature
    ) external onlyRegistered nonReentrant whenNotPaused {
        // ── Input bounds ──
        require(attempts > 0, "No attempts");
        require(attempts <= MAX_ATTEMPTS_PER_SESSION, "Too many attempts");
        require(correct <= attempts, "Invalid correct count");
        require(score <= MAX_SCORE_PER_SESSION, "Score exceeds maximum");
        require(bytes(topic).length > 0 && bytes(topic).length <= 32, "Invalid topic");

        uint256 today = block.timestamp / 1 days;

        // ── Rate limit: max sessions per day ──
        require(dailySessionCount[msg.sender][today] < MAX_SESSIONS_PER_DAY, "Daily session limit reached");

        // ── Session attestation (when signer is configured) ──
        if (sessionSigner != address(0)) {
            require(block.timestamp <= deadline, "Attestation expired");

            uint256 currentNonce = nonces[msg.sender];
            bytes32 structHash = keccak256(abi.encode(
                SESSION_TYPEHASH,
                msg.sender,
                score,
                correct,
                attempts,
                keccak256(bytes(topic)),
                currentNonce,
                deadline
            ));

            bytes32 digest = _hashTypedDataV4(structHash);
            address recovered = ECDSA.recover(digest, signature);
            require(recovered == sessionSigner, "Invalid session signature");

            nonces[msg.sender] = currentNonce + 1;
        }

        Player storage p = players[msg.sender];

        // Track streak by day (only update on first activity of the day)
        bool firstActivityToday = p.lastActivityDay != today;

        if (firstActivityToday) {
            if (p.lastActivityDay == today - 1) {
                p.streak += 1;
            } else if (p.lastActivityDay < today - 1) {
                p.streak = 1; // reset streak if missed a day
            }
            p.lastActivityDay = today;
            dailyActivePlayers[today].push(msg.sender);
            totalActiveDays += 1;
        }

        // Update stats
        p.totalScore    += score;
        p.totalCorrect  += correct;
        p.totalAttempts += attempts;
        dailySessionCount[msg.sender][today] += 1;

        // Record history
        activityHistory[msg.sender].push(DailyActivity({
            score:       score,
            correct:     correct,
            attempts:    attempts,
            topicPlayed: topic,
            timestamp:   block.timestamp
        }));

        // ── Coin rewards (daily base reward at most once per day) ──
        uint256 coinsToAward = 0;
        string memory reason = "session recorded";

        if (!dailyRewardClaimed[msg.sender][today]) {
            coinsToAward = DAILY_REWARD_COINS;
            dailyRewardClaimed[msg.sender][today] = true;
            reason = "daily activity";

            // Streak milestone bonus (every 7 days) — only on the first session of the day
            if (p.streak > 0 && p.streak % 7 == 0) {
                coinsToAward += STREAK_BONUS_COINS * (p.streak / 7);
                reason = "streak milestone";
            }
        }

        // Perfect score bonus (100% correct, at least 5 questions) — awarded per session
        if (correct == attempts && attempts >= 5) {
            coinsToAward += PERFECT_SCORE_BONUS;
            reason = coinsToAward > PERFECT_SCORE_BONUS ? "daily + perfect" : "perfect score";
        }

        if (coinsToAward > 0) {
            p.coinsEarned += coinsToAward;
            emit CoinsEarned(msg.sender, coinsToAward, reason);
        }

        emit ActivityRecorded(msg.sender, topic, score, correct, attempts, today);
        emit StreakUpdated(msg.sender, p.streak);
    }

    // ─── CELO Reward Claim ──────────────────────────────────────────────────

    /**
     * @notice Claim CELO reward when coin balance reaches threshold.
     *         Burns the coins and sends CELO from reward pool.
     */
    function claimCeloReward() external onlyRegistered nonReentrant whenNotPaused {
        Player storage p = players[msg.sender];
        require(p.coinsEarned >= CELO_REWARD_THRESHOLD, "Not enough coins");
        require(rewardPool >= CELO_REWARD_AMOUNT, "Reward pool empty");

        p.coinsEarned -= CELO_REWARD_THRESHOLD;
        rewardPool    -= CELO_REWARD_AMOUNT;

        (bool sent, ) = msg.sender.call{value: CELO_REWARD_AMOUNT}("");
        require(sent, "CELO transfer failed");

        emit CeloClaimed(msg.sender, CELO_REWARD_AMOUNT);
    }

    // ─── Owner: Administration ──────────────────────────────────────────────

    /**
     * @notice Owner deposits CELO into the reward pool.
     */
    function fundRewardPool() external payable onlyOwner {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.value);
    }

    /**
     * @notice Owner withdraws excess CELO from reward pool.
     */
    function withdrawPool(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= rewardPool, "Exceeds pool");
        rewardPool -= amount;
        (bool sent, ) = owner().call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    /**
     * @notice Set the trusted session signer. Set to address(0) to disable signature verification.
     */
    function setSessionSigner(address _signer) external onlyOwner {
        emit SessionSignerUpdated(sessionSigner, _signer);
        sessionSigner = _signer;
    }

    /**
     * @notice Pause all activity recording and claims (emergency).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getPlayer(address addr) external view returns (Player memory) {
        return players[addr];
    }

    function getActivityHistory(address addr) external view returns (DailyActivity[] memory) {
        return activityHistory[addr];
    }

    function getActivityCount(address addr) external view returns (uint256) {
        return activityHistory[addr].length;
    }

    function getDailyActivePlayers(uint256 day) external view returns (address[] memory) {
        return dailyActivePlayers[day];
    }

    function getTodayActivePlayers() external view returns (address[] memory) {
        return dailyActivePlayers[block.timestamp / 1 days];
    }

    function getTotalPlayers() external view returns (uint256) {
        return registeredPlayers.length;
    }

    function getNonce(address addr) external view returns (uint256) {
        return nonces[addr];
    }

    function getDailySessionCount(address addr, uint256 day) external view returns (uint256) {
        return dailySessionCount[addr][day];
    }

    /**
     * @notice Returns top N players sorted by totalScore (simple bubble sort — fine for small sets).
     */
    function getLeaderboard(uint256 topN) external view returns (LeaderboardEntry[] memory) {
        uint256 total = registeredPlayers.length;
        if (topN > total) topN = total;
        if (total == 0 || topN == 0) return new LeaderboardEntry[](0);

        // Copy scores into memory array for sorting
        address[] memory addrs = new address[](total);
        for (uint256 i = 0; i < total; i++) addrs[i] = registeredPlayers[i];

        // Bubble sort descending by totalScore
        for (uint256 i = 0; i < total - 1; i++) {
            for (uint256 j = 0; j < total - i - 1; j++) {
                if (players[addrs[j]].totalScore < players[addrs[j + 1]].totalScore) {
                    address tmp = addrs[j];
                    addrs[j] = addrs[j + 1];
                    addrs[j + 1] = tmp;
                }
            }
        }

        LeaderboardEntry[] memory board = new LeaderboardEntry[](topN);
        for (uint256 i = 0; i < topN; i++) {
            Player storage p = players[addrs[i]];
            board[i] = LeaderboardEntry({
                player:     addrs[i],
                username:   p.username,
                totalScore: p.totalScore,
                streak:     p.streak
            });
        }
        return board;
    }

    /**
     * @notice Check if a player has been active today.
     */
    function isActiveToday(address addr) external view returns (bool) {
        return players[addr].lastActivityDay == block.timestamp / 1 days;
    }

    /**
     * @notice Returns the EIP-712 domain separator for off-chain signature construction.
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    receive() external payable {
        rewardPool += msg.value;
    }
}
