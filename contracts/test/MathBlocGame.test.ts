import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MathBlocGame", function () {
  let contract: any;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let player3: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, player1, player2, player3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MathBlocGame");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  describe("Registration", () => {
    it("registers a new player", async () => {
      await contract.connect(player1).register("Alice");
      const p = await contract.getPlayer(player1.address);
      expect(p.username).to.equal("Alice");
      expect(p.exists).to.be.true;
      expect(p.totalScore).to.equal(0n);
      expect(p.totalCorrect).to.equal(0n);
      expect(p.totalAttempts).to.equal(0n);
      expect(p.streak).to.equal(0n);
      expect(p.coinsEarned).to.equal(0n);
      expect(p.registeredAt).to.be.gt(0n);
      expect(await contract.getTotalPlayers()).to.equal(1n);
    });

    it("rejects duplicate registration", async () => {
      await contract.connect(player1).register("Alice");
      await expect(contract.connect(player1).register("Alice2")).to.be.revertedWith("Already registered");
    });

    it("rejects empty username", async () => {
      await expect(contract.connect(player1).register("")).to.be.revertedWith("Invalid username");
    });

    it("rejects username exceeding 32 bytes", async () => {
      const longUsername = "a".repeat(33);
      await expect(contract.connect(player1).register(longUsername)).to.be.revertedWith("Invalid username");
    });

    it("accepts maximum 32 bytes username", async () => {
      const validLongUsername = "a".repeat(32);
      await expect(contract.connect(player1).register(validLongUsername)).to.not.be.reverted;
      const p = await contract.getPlayer(player1.address);
      expect(p.username).to.equal(validLongUsername);
    });
  });

  describe("Activity Recording", () => {
    beforeEach(async () => {
      await contract.connect(player1).register("Alice");
    });

    it("records activity and awards daily coins", async () => {
      await contract.connect(player1).recordActivity(80, 8, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      expect(p.totalScore).to.equal(80n);
      expect(p.totalCorrect).to.equal(8n);
      expect(p.totalAttempts).to.equal(10n);
      expect(p.coinsEarned).to.equal(10n); // DAILY_REWARD_COINS
      expect(await contract.totalActiveDays()).to.equal(1n);
    });

    it("awards perfect score bonus when attempts >= 5 and 100% correct", async () => {
      await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      // DAILY_REWARD_COINS(10) + PERFECT_SCORE_BONUS(20) = 30
      expect(p.coinsEarned).to.equal(30n);
    });

    it("does not award perfect score bonus when attempts < 5 even if 100% correct", async () => {
      await contract.connect(player1).recordActivity(40, 4, 4, "addition");
      const p = await contract.getPlayer(player1.address);
      expect(p.coinsEarned).to.equal(10n); // only daily reward, no bonus
    });

    it("rejects unregistered player", async () => {
      await expect(
        recordUnsigned(player2, 50, 5, 10, "counting")
      ).to.be.revertedWith("Not registered");
    });

    it("rejects 0 attempts", async () => {
      await expect(
        contract.connect(player1).recordActivity(0, 0, 0, "addition")
      ).to.be.revertedWith("No attempts");
    });

    it("rejects invalid correct count exceeding attempts", async () => {
      await expect(
        recordUnsigned(player1, 50, 11, 10, "addition")
      ).to.be.revertedWith("Invalid correct count");
    });

    it("rejects empty topic string", async () => {
      await expect(
        contract.connect(player1).recordActivity(50, 5, 10, "")
      ).to.be.revertedWith("Topic required");
    });

    it("tracks activity history and count", async () => {
      await contract.connect(player1).recordActivity(70, 7, 10, "subtraction");
      const history = await contract.getActivityHistory(player1.address);
      expect(history.length).to.equal(1);
      expect(history[0].topicPlayed).to.equal("subtraction");
      expect(history[0].score).to.equal(70n);
      expect(history[0].correct).to.equal(7n);
      expect(history[0].attempts).to.equal(10n);
      expect(await contract.getActivityCount(player1.address)).to.equal(1n);
    });

    it("handles multiple sessions on the same day without re-incrementing streak or active days", async () => {
      await contract.connect(player1).recordActivity(50, 5, 10, "addition");
      await contract.connect(player1).recordActivity(60, 6, 10, "subtraction");

      const p = await contract.getPlayer(player1.address);
      expect(p.totalScore).to.equal(110n);
      expect(p.totalCorrect).to.equal(11n);
      expect(p.totalAttempts).to.equal(20n);
      expect(p.streak).to.equal(1n);
      expect(await contract.totalActiveDays()).to.equal(1n);
      expect(await contract.getActivityCount(player1.address)).to.equal(2n);
    });

    it("updates todayActivePlayers and getDailyActivePlayers correctly", async () => {
      await contract.connect(player2).register("Bob");
      await contract.connect(player1).recordActivity(50, 5, 10, "addition");
      await contract.connect(player2).recordActivity(60, 6, 10, "counting");

      const active = await contract.getTodayActivePlayers();
      expect(active.length).to.equal(2);
      expect(active[0]).to.equal(player1.address);
      expect(active[1]).to.equal(player2.address);
      expect(await contract.isActiveToday(player1.address)).to.be.true;
      expect(await contract.isActiveToday(player3.address)).to.be.false;

      const block = await ethers.provider.getBlock("latest");
      const today = BigInt(Math.floor(block!.timestamp / 86400));
      const dailyActive = await contract.getDailyActivePlayers(today);
      expect(dailyActive.length).to.equal(2);
    });

    it("rejects score exceeding maximum", async () => {
      await expect(
        recordUnsigned(player1, 1001, 10, 10, "addition")
      ).to.be.revertedWith("Score exceeds maximum");
    });

    it("rejects attempts exceeding maximum", async () => {
      await expect(
        recordUnsigned(player1, 50, 5, 101, "addition")
      ).to.be.revertedWith("Too many attempts");
    });

    it("rejects topic longer than 32 bytes", async () => {
      const longTopic = "a".repeat(33);
      await expect(
        recordUnsigned(player1, 50, 5, 10, longTopic)
      ).to.be.revertedWith("Invalid topic");
    });
  });

  describe("Daily Reward Cap", () => {
    beforeEach(async () => {
      await contract.connect(player1).register("Alice");
    });

    it("awards daily base reward only once per day", async () => {
      await recordUnsigned(player1, 50, 5, 10, "addition");
      const p1 = await contract.getPlayer(player1.address);
      expect(p1.coinsEarned).to.equal(10n); // DAILY_REWARD_COINS

      // Second session same day: no base reward
      await recordUnsigned(player1, 50, 5, 10, "addition");
      const p2 = await contract.getPlayer(player1.address);
      expect(p2.coinsEarned).to.equal(10n); // unchanged — no second daily reward
    });

    it("awards daily reward again on a new day", async () => {
      await recordUnsigned(player1, 50, 5, 10, "addition");

      // Advance 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await recordUnsigned(player1, 50, 5, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      expect(p.coinsEarned).to.equal(20n); // 10 + 10
    });

    it("still awards perfect score bonus on subsequent same-day sessions", async () => {
      await recordUnsigned(player1, 50, 5, 10, "addition");
      // 10 coins (daily)

      // Perfect score session same day
      await recordUnsigned(player1, 100, 10, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      // 10 (daily) + 20 (perfect) = 30. No second daily reward.
      expect(p.coinsEarned).to.equal(30n);
    });

    it("prevents farming coins via repeated same-day sessions", async () => {
      // Record 10 sessions in one day
      for (let i = 0; i < 10; i++) {
        await recordUnsigned(player1, 50, 5, 10, "addition");
      }
      const p = await contract.getPlayer(player1.address);
      // Only 1 daily reward of 10 coins, no other bonuses
      expect(p.coinsEarned).to.equal(10n);
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(async () => {
      await contract.connect(player1).register("Alice");
    });

    it("enforces max sessions per day", async () => {
      for (let i = 0; i < 10; i++) {
        await recordUnsigned(player1, 10, 1, 5, "addition");
      }
      await expect(
        recordUnsigned(player1, 10, 1, 5, "addition")
      ).to.be.revertedWith("Daily session limit reached");
    });
  });

  describe("Streak Logic and Milestones", () => {
    it("increments streak on consecutive days", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      expect((await contract.getPlayer(player1.address)).streak).to.equal(1n);

      // Advance time by 1 day (86400 seconds)
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      expect((await contract.getPlayer(player1.address)).streak).to.equal(2n);
    });

    it("resets streak if player misses a day", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      expect((await contract.getPlayer(player1.address)).streak).to.equal(1n);

      // Advance time by 2 days (172800 seconds) - missed day
      await ethers.provider.send("evm_increaseTime", [172800]);
      await ethers.provider.send("evm_mine", []);

      await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      expect((await contract.getPlayer(player1.address)).streak).to.equal(1n);
    });

    it("awards streak milestone bonus at 7-day streak", async () => {
      await contract.connect(player1).register("Alice");

      for (let day = 1; day <= 7; day++) {
        if (day > 1) {
          await ethers.provider.send("evm_increaseTime", [86400]);
          await ethers.provider.send("evm_mine", []);
        }
        await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      }

      const p = await contract.getPlayer(player1.address);
      expect(p.streak).to.equal(7n);
      // Days 1-6: 10 coins each = 60
      // Day 7: 10 + 5 * (7 / 7) = 15
      // Total coins = 75
      expect(p.coinsEarned).to.equal(75n);
    });
  });

  describe("EIP-712 Session Attestation", () => {
    // Helper to get a future deadline from the blockchain clock
    async function futureDeadline(): Promise<number> {
      const block = await ethers.provider.getBlock("latest");
      return (block!.timestamp) + 3600;
    }

    beforeEach(async () => {
      await contract.connect(player1).register("Alice");
      // Enable session signer
      await contract.connect(owner).setSessionSigner(signer.address);
    });

    it("accepts valid signed session", async () => {
      const nonce = await contract.getNonce(player1.address);
      const deadline = await futureDeadline();
      const sig = await signSession(signer, player1.address, 80, 8, 10, "addition", nonce, deadline);

      await contract.connect(player1).recordActivity(80, 8, 10, "addition", deadline, sig);
      const p = await contract.getPlayer(player1.address);
      expect(p.totalScore).to.equal(80n);
    });

    it("rejects forged signature (wrong signer)", async () => {
      const nonce = await contract.getNonce(player1.address);
      const deadline = await futureDeadline();
      // player2 signs instead of the trusted signer
      const sig = await signSession(player2, player1.address, 80, 8, 10, "addition", nonce, deadline);

      await expect(
        contract.connect(player1).recordActivity(80, 8, 10, "addition", deadline, sig)
      ).to.be.revertedWith("Invalid session signature");
    });

    it("rejects expired attestation", async () => {
      const nonce = await contract.getNonce(player1.address);
      const deadline = 1; // already expired
      const sig = await signSession(signer, player1.address, 80, 8, 10, "addition", nonce, deadline);

      await expect(
        contract.connect(player1).recordActivity(80, 8, 10, "addition", deadline, sig)
      ).to.be.revertedWith("Attestation expired");
    });

    it("rejects replayed signature (same nonce)", async () => {
      const nonce = await contract.getNonce(player1.address);
      const deadline = await futureDeadline();
      const sig = await signSession(signer, player1.address, 80, 8, 10, "addition", nonce, deadline);

      // First use: succeeds
      await contract.connect(player1).recordActivity(80, 8, 10, "addition", deadline, sig);

      // Replay: fails (nonce already consumed)
      await expect(
        contract.connect(player1).recordActivity(80, 8, 10, "addition", deadline, sig)
      ).to.be.revertedWith("Invalid session signature");
    });

    it("rejects cross-wallet attestation (signature for different player)", async () => {
      await contract.connect(player2).register("Bob");
      const nonce = await contract.getNonce(player1.address);
      const deadline = await futureDeadline();
      // Sign for player1 but submit from player2
      const sig = await signSession(signer, player1.address, 80, 8, 10, "addition", nonce, deadline);

      await expect(
        contract.connect(player2).recordActivity(80, 8, 10, "addition", deadline, sig)
      ).to.be.revertedWith("Invalid session signature");
    });

    it("increments nonce after each valid session", async () => {
      expect(await contract.getNonce(player1.address)).to.equal(0n);

      const deadline = await futureDeadline();
      const sig0 = await signSession(signer, player1.address, 50, 5, 10, "addition", 0n, deadline);
      await contract.connect(player1).recordActivity(50, 5, 10, "addition", deadline, sig0);

      expect(await contract.getNonce(player1.address)).to.equal(1n);

      const sig1 = await signSession(signer, player1.address, 50, 5, 10, "addition", 1n, deadline);
      await contract.connect(player1).recordActivity(50, 5, 10, "addition", deadline, sig1);

      expect(await contract.getNonce(player1.address)).to.equal(2n);
    });
  });

  describe("Emergency Pause", () => {
    it("owner can pause and unpause", async () => {
      await contract.connect(owner).pause();
      await expect(contract.connect(player1).register("Alice")).to.be.revertedWithCustomError(contract, "EnforcedPause");

      await contract.connect(owner).unpause();
      await contract.connect(player1).register("Alice");
      expect((await contract.getPlayer(player1.address)).exists).to.be.true;
    });

    it("non-owner cannot pause", async () => {
      await expect(contract.connect(player1).pause()).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("paused contract blocks activity recording", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(owner).pause();

      await expect(
        recordUnsigned(player1, 50, 5, 10, "addition")
      ).to.be.revertedWithCustomError(contract, "EnforcedPause");
    });

    it("paused contract blocks CELO claims", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");

      // Accumulate coins across multiple days to reach threshold
      for (let day = 0; day < 4; day++) {
        await recordUnsigned(player1, 100, 10, 10, "addition");
        if (day < 3) {
          await ethers.provider.send("evm_increaseTime", [86400]);
          await ethers.provider.send("evm_mine", []);
        }
      }

      await contract.connect(owner).pause();
      await expect(
        contract.connect(player1).claimCeloReward()
      ).to.be.revertedWithCustomError(contract, "EnforcedPause");
    });
  });

  describe("Leaderboard", () => {
    it("returns empty array when no players are registered", async () => {
      const board = await contract.getLeaderboard(5);
      expect(board.length).to.equal(0);
    });

    it("returns empty array when topN is 0", async () => {
      await contract.connect(player1).register("Alice");
      const board = await contract.getLeaderboard(0);
      expect(board.length).to.equal(0);
    });

    it("caps return count when topN exceeds total registered players", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player1).recordActivity(100, 10, 10, "addition");

      const board = await contract.getLeaderboard(10);
      expect(board.length).to.equal(1);
      expect(board[0].username).to.equal("Alice");
      expect(board[0].totalScore).to.equal(100n);
      expect(board[0].player).to.equal(player1.address);
    });

    it("correctly sorts multiple players in descending order of total score", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");
      await contract.connect(player3).register("Charlie");

      await contract.connect(player1).recordActivity(40, 4, 10, "addition");
      await contract.connect(player2).recordActivity(90, 9, 10, "addition");
      await contract.connect(player3).recordActivity(70, 7, 10, "addition");

      const board = await contract.getLeaderboard(3);
      expect(board.length).to.equal(3);
      expect(board[0].username).to.equal("Bob");
      expect(board[0].totalScore).to.equal(90n);
      expect(board[1].username).to.equal("Charlie");
      expect(board[1].totalScore).to.equal(70n);
      expect(board[2].username).to.equal("Alice");
      expect(board[2].totalScore).to.equal(40n);
    });

    it("limits output to topN when more players exist", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");
      await contract.connect(player3).register("Charlie");

      await contract.connect(player1).recordActivity(40, 4, 10, "addition");
      await contract.connect(player2).recordActivity(90, 9, 10, "addition");
      await contract.connect(player3).recordActivity(70, 7, 10, "addition");

      const top2 = await contract.getLeaderboard(2);
      expect(top2.length).to.equal(2);
      expect(top2[0].username).to.equal("Bob");
      expect(top2[1].username).to.equal("Charlie");
    });

    it("returns empty array when no players registered", async () => {
      const board = await contract.getLeaderboard(10);
      expect(board.length).to.equal(0);
    });

    it("returns empty array when topN is 0", async () => {
      await contract.connect(player1).register("Alice");
      const board = await contract.getLeaderboard(0);
      expect(board.length).to.equal(0);
    });
  });

  describe("CELO Rewards & Pool Management", () => {
    it("allows owner to fund reward pool directly via fundRewardPool", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.1"));
    });

    it("accepts direct plain ETH transfer via receive fallback to fund reward pool", async () => {
      await owner.sendTransaction({
        to: await contract.getAddress(),
        value: ethers.parseEther("0.05"),
      });
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.05"));
    });

    it("reverts claim when player has insufficient coins (<100)", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");
      await contract.connect(player1).recordActivity(50, 5, 10, "addition"); // 10 coins

      await expect(contract.connect(player1).claimCeloReward()).to.be.revertedWith("Not enough coins");
    });

    it("reverts claim when reward pool has insufficient CELO", async () => {
      await contract.connect(player1).register("Alice");
      // Accumulate 120 coins with 4 perfect sessions (4 * 30 = 120)
      for (let i = 0; i < 4; i++) {
        await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      }
      const p = await contract.getPlayer(player1.address);
      expect(p.coinsEarned).to.equal(120n);

      // Reward pool is 0
      await expect(contract.connect(player1).claimCeloReward()).to.be.revertedWith("Reward pool empty");
    });

    it("successfully claims CELO reward, burns 100 coins, and transfers CELO", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");

      // Accumulate 120 coins (4 perfect sessions * 30 coins)
      for (let i = 0; i < 4; i++) {
        await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      }

      const balBefore = await ethers.provider.getBalance(player1.address);
      await contract.connect(player1).claimCeloReward();
      const balAfter = await ethers.provider.getBalance(player1.address);
      expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.001"));

      const pAfter = await contract.getPlayer(player1.address);
      expect(pAfter.coinsEarned).to.equal(20n); // 120 - 100
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.099"));
    });

    it("allows owner to withdraw excess funds from reward pool", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });

      const balBefore = await ethers.provider.getBalance(owner.address);
      await contract.connect(owner).withdrawPool(ethers.parseEther("0.04"));
      const balAfter = await ethers.provider.getBalance(owner.address);
      expect(balAfter).to.be.gt(balBefore);
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.06"));
    });

    it("reverts withdrawPool if amount exceeds pool balance", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.05") });
      await expect(
        contract.connect(owner).withdrawPool(ethers.parseEther("0.1"))
      ).to.be.revertedWith("Exceeds pool");
    });

    it("reverts withdrawPool if called by non-owner", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.05") });
      await expect(
        contract.connect(player1).withdrawPool(ethers.parseEther("0.02"))
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });
});
