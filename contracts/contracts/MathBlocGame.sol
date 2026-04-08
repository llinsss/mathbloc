// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MathBlocGame
 * @notice Educational math game contract deployed on Celo.
 *         Tracks daily activity, scores, streaks, and distributes CELO rewards.
 */
contract MathBlocGame is Ownable, ReentrancyGuard {

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

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => Player) public players;
    mapping(address => DailyActivity[]) public activityHistory;
    mapping(uint256 => address[]) public dailyActivePlayers; // day => players active that day

    address[] public registeredPlayers;

    uint256 public constant DAILY_REWARD_COINS   = 10;
    uint256 public constant STREAK_BONUS_COINS   = 5;   // extra per streak milestone (every 7 days)
    uint256 public constant PERFECT_SCORE_BONUS  = 20;
    uint256 public constant CELO_REWARD_THRESHOLD = 100; // coins needed to claim CELO
    uint256 public constant CELO_REWARD_AMOUNT   = 0.001 ether; // 0.001 CELO per claim

    uint256 public totalActiveDays;   // global stat
    uint256 public rewardPool;        // CELO deposited by owner for rewards

    // ─── Events ──────────────────────────────────────────────────────────────

    event PlayerRegistered(address indexed player, string username, uint256 timestamp);
    event ActivityRecorded(address indexed player, string topic, uint256 score, uint256 correct, uint256 attempts, uint256 day);
    event StreakUpdated(address indexed player, uint256 streak);
    event CoinsEarned(address indexed player, uint256 amount, string reason);
    event CeloClaimed(address indexed player, uint256 amount);
    event RewardPoolFunded(uint256 amount);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyRegistered() {
        require(players[msg.sender].exists, "Not registered");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * @notice Register a new player wallet with a username.
     */
    function register(string calldata username) external {
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

    // ─── Daily Activity ──────────────────────────────────────────────────────

    /**
     * @notice Record a game session result. Can be called once per day per player.
     * @param score      Total score achieved in the session
     * @param correct    Number of correct answers
     * @param attempts   Total questions attempted
     * @param topic      Topic played (e.g. "addition", "multiplication")
     */
    function recordActivity(
        uint256 score,
        uint256 correct,
        uint256 attempts,
        string calldata topic
    ) external onlyRegistered nonReentrant {
        require(attempts > 0, "No attempts");
        require(correct <= attempts, "Invalid correct count");
        require(bytes(topic).length > 0, "Topic required");

        Player storage p = players[msg.sender];
        uint256 today = block.timestamp / 1 days;

        // Allow multiple sessions per day but track streak by day
        bool firstActivityToday = p.lastActivityDay != today;

        // Update streak
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

        // Record history
        activityHistory[msg.sender].push(DailyActivity({
            score:       score,
            correct:     correct,
            attempts:    attempts,
            topicPlayed: topic,
            timestamp:   block.timestamp
        }));

        // ── Coin rewards ──
        uint256 coinsToAward = DAILY_REWARD_COINS;
        string memory reason = "daily activity";

        // Streak milestone bonus (every 7 days)
        if (p.streak > 0 && p.streak % 7 == 0) {
            coinsToAward += STREAK_BONUS_COINS * (p.streak / 7);
            reason = "streak milestone";
        }

        // Perfect score bonus (100% correct)
        if (correct == attempts && attempts >= 5) {
            coinsToAward += PERFECT_SCORE_BONUS;
            reason = "perfect score";
        }

        p.coinsEarned += coinsToAward;

        emit ActivityRecorded(msg.sender, topic, score, correct, attempts, today);
        emit StreakUpdated(msg.sender, p.streak);
        emit CoinsEarned(msg.sender, coinsToAward, reason);
    }

    // ─── CELO Reward Claim ───────────────────────────────────────────────────

    /**
     * @notice Claim CELO reward when coin balance reaches threshold.
     *         Burns the coins and sends CELO from reward pool.
     */
    function claimCeloReward() external onlyRegistered nonReentrant {
        Player storage p = players[msg.sender];
        require(p.coinsEarned >= CELO_REWARD_THRESHOLD, "Not enough coins");
        require(rewardPool >= CELO_REWARD_AMOUNT, "Reward pool empty");

        p.coinsEarned -= CELO_REWARD_THRESHOLD;
        rewardPool    -= CELO_REWARD_AMOUNT;

        (bool sent, ) = msg.sender.call{value: CELO_REWARD_AMOUNT}("");
        require(sent, "CELO transfer failed");

        emit CeloClaimed(msg.sender, CELO_REWARD_AMOUNT);
    }

    // ─── Owner: Fund Reward Pool ─────────────────────────────────────────────

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

    // ─── Views ───────────────────────────────────────────────────────────────

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

    /**
     * @notice Returns top N players sorted by totalScore (simple bubble sort — fine for small sets).
     */
    function getLeaderboard(uint256 topN) external view returns (LeaderboardEntry[] memory) {
        uint256 total = registeredPlayers.length;
        if (topN > total) topN = total;

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

    receive() external payable {
        rewardPool += msg.value;
    }
}
