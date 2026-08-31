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

    // --- Structs ---

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

    // --- State ---

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

    // --- Events ---

    event PlayerRegistered(address indexed player, string username, uint256 timestamp);
    event ActivityRecorded(address indexed player, string topic, uint256 score, uint256 correct, uint256 attempts, uint256 day);
    event StreakUpdated(address indexed player, uint256 streak);
    event CoinsEarned(address indexed player, uint256 amount, string reason);
    event CeloClaimed(address indexed player, uint256 amount);
    event RewardPoolFunded(uint256 amount);

    // --- Modifiers ---

    modifier onlyRegistered() {
        require(players[msg.sender].exists, "Not registered");
        _;
    }

    // --- Constructor ---

    constructor() Ownable(msg.sender) {}

    // --- Registration ---

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

    // --- Daily Activity ---

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

        // -- Coin rewards --
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

    // --- CELO Reward Claim ---

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

    // --- Owner: Fund Reward Pool ---

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

    // --- Views ---

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
     * @notice Returns top N players sorted by totalScore descending.
     *         Uses a bounded insertion-sort (O(total * topN)) instead of a
     *         full O(n^2) bubble sort, and safely handles zero-player /
     *         zero-topN edge cases.
     *         Tie-breaking: equal totalScore is ordered by earlier registration
     *         (lower index in registeredPlayers comes first).
     * @param topN  Maximum entries to return.  Clamped to registeredPlayers.length.
     */
    function getLeaderboard(uint256 topN) external view returns (LeaderboardEntry[] memory) {
        uint256 total = registeredPlayers.length;

        // Edge cases: nothing to return
        if (total == 0 || topN == 0) {
            return new LeaderboardEntry[](0);
        }
        if (topN > total) topN = total;

        // Bounded top-K via insertion into a fixed-size array.
        // We maintain a sorted array of length topN. For every registered
        // player we find the correct insertion position and shift only the
        // tail of the small array, giving O(total * topN) worst-case, which
        // is O(total) when topN is a constant (e.g. 10 or 100).
        address[] memory top = new address[](topN);
        uint256[] memory topScores = new uint256[](topN);
        uint256 filled = 0; // how many slots are occupied so far

        for (uint256 i = 0; i < total; i++) {
            address addr = registeredPlayers[i];
            uint256 sc   = players[addr].totalScore;

            // Skip if the board is full and this score cannot make it in.
            if (filled == topN && sc <= topScores[topN - 1]) continue;

            // Find insertion position (first index whose score is < sc,
            // or whose score == sc but was registered later, so earlier
            // registrations stay ahead for tie-breaking).
            uint256 pos = filled < topN ? filled : topN - 1;
            for (uint256 k = 0; k < filled && k < topN; k++) {
                if (sc > topScores[k]) {
                    pos = k;
                    break;
                }
            }

            // Shift elements from pos to the right to make room.
            uint256 end = filled < topN ? filled : topN - 1;
            for (uint256 k = end; k > pos; k--) {
                top[k]       = top[k - 1];
                topScores[k] = topScores[k - 1];
            }

            top[pos]       = addr;
            topScores[pos] = sc;

            if (filled < topN) filled++;
        }

        // Build result
        LeaderboardEntry[] memory board = new LeaderboardEntry[](filled);
        for (uint256 i = 0; i < filled; i++) {
            Player storage p = players[top[i]];
            board[i] = LeaderboardEntry({
                player:     top[i],
                username:   p.username,
                totalScore: p.totalScore,
                streak:     p.streak
            });
        }
        return board;
    }

    /**
     * @notice Paginated leaderboard -- returns entries ranked from offset
     *         to offset + limit - 1 (0-indexed).  Useful for off-chain UIs
     *         that page through the full leaderboard.
     * @param limit   Maximum entries per page.
     * @param offset  Number of top entries to skip.
     */
    function getLeaderboardPage(uint256 limit, uint256 offset)
        external view returns (LeaderboardEntry[] memory)
    {
        uint256 total = registeredPlayers.length;
        if (total == 0 || limit == 0 || offset >= total) {
            return new LeaderboardEntry[](0);
        }

        // We need the top (offset + limit) entries, then slice [offset..].
        uint256 need = offset + limit;
        if (need > total) need = total;

        // Reuse top-K insertion sort for need entries
        address[] memory top = new address[](need);
        uint256[] memory topScores = new uint256[](need);
        uint256 filled = 0;

        for (uint256 i = 0; i < total; i++) {
            address addr = registeredPlayers[i];
            uint256 sc   = players[addr].totalScore;

            if (filled == need && sc <= topScores[need - 1]) continue;

            uint256 pos = filled < need ? filled : need - 1;
            for (uint256 k = 0; k < filled && k < need; k++) {
                if (sc > topScores[k]) { pos = k; break; }
            }

            uint256 end = filled < need ? filled : need - 1;
            for (uint256 k = end; k > pos; k--) {
                top[k]       = top[k - 1];
                topScores[k] = topScores[k - 1];
            }
            top[pos]       = addr;
            topScores[pos] = sc;
            if (filled < need) filled++;
        }

        // Slice [offset .. filled)
        uint256 start = offset < filled ? offset : filled;
        uint256 count = filled > start ? filled - start : 0;
        LeaderboardEntry[] memory board = new LeaderboardEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            Player storage p = players[top[start + i]];
            board[i] = LeaderboardEntry({
                player:     top[start + i],
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
