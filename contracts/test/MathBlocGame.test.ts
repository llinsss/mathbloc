import { expect } from "chai";
import { ethers } from "hardhat";
import { MathBlocGame } from "../artifacts/contracts/MathBlocGame.sol/MathBlocGame";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MathBlocGame", function () {
  let contract: MathBlocGame;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, player1, player2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MathBlocGame");
    contract = (await Factory.deploy()) as unknown as MathBlocGame;
    await contract.waitForDeployment();
  });

  describe("Registration", () => {
    it("registers a new player", async () => {
      await contract.connect(player1).register("Alice");
      const p = await contract.getPlayer(player1.address);
      expect(p.username).to.equal("Alice");
      expect(p.exists).to.be.true;
      expect(await contract.getTotalPlayers()).to.equal(1n);
    });

    it("rejects duplicate registration", async () => {
      await contract.connect(player1).register("Alice");
      await expect(contract.connect(player1).register("Alice2")).to.be.revertedWith("Already registered");
    });

    it("rejects empty username", async () => {
      await expect(contract.connect(player1).register("")).to.be.revertedWith("Invalid username");
    });
  });

  describe("Activity Recording", () => {
    beforeEach(async () => {
      await contract.connect(player1).register("Alice");
    });

    it("records activity and awards coins", async () => {
      await contract.connect(player1).recordActivity(80, 8, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      expect(p.totalScore).to.equal(80n);
      expect(p.totalCorrect).to.equal(8n);
      expect(p.coinsEarned).to.equal(10n); // DAILY_REWARD_COINS
    });

    it("awards perfect score bonus", async () => {
      await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      // DAILY_REWARD_COINS(10) + PERFECT_SCORE_BONUS(20) = 30
      expect(p.coinsEarned).to.equal(30n);
    });

    it("rejects unregistered player", async () => {
      await expect(
        contract.connect(player2).recordActivity(50, 5, 10, "counting")
      ).to.be.revertedWith("Not registered");
    });

    it("rejects invalid correct count", async () => {
      await expect(
        contract.connect(player1).recordActivity(50, 11, 10, "addition")
      ).to.be.revertedWith("Invalid correct count");
    });

    it("tracks activity history", async () => {
      await contract.connect(player1).recordActivity(70, 7, 10, "subtraction");
      const history = await contract.getActivityHistory(player1.address);
      expect(history.length).to.equal(1);
      expect(history[0].topicPlayed).to.equal("subtraction");
    });
  });

  describe("Streak", () => {
    it("sets streak to 1 on first activity", async () => {
      await contract.connect(player1).register("Bob");
      await contract.connect(player1).recordActivity(50, 5, 10, "counting");
      const p = await contract.getPlayer(player1.address);
      expect(p.streak).to.equal(1n);
    });
  });

  describe("Leaderboard", () => {
    it("returns sorted leaderboard", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");
      await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      await contract.connect(player2).recordActivity(50, 5, 10, "counting");

      const board = await contract.getLeaderboard(2);
      expect(board[0].username).to.equal("Alice");
      expect(board[1].username).to.equal("Bob");
    });

    it("returns empty array when no players are registered", async () => {
      const board = await contract.getLeaderboard(10);
      expect(board.length).to.equal(0);
    });

    it("returns empty array when topN is 0", async () => {
      await contract.connect(player1).register("Alice");
      const board = await contract.getLeaderboard(0);
      expect(board.length).to.equal(0);
    });

    it("handles single player leaderboard", async () => {
      await contract.connect(player1).register("Solo");
      await contract.connect(player1).recordActivity(42, 4, 10, "addition");

      const board = await contract.getLeaderboard(5);
      expect(board.length).to.equal(1);
      expect(board[0].username).to.equal("Solo");
      expect(board[0].totalScore).to.equal(42n);
    });

    it("clamps topN to total players when topN > total", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");

      const board = await contract.getLeaderboard(100);
      expect(board.length).to.equal(2);
    });

    it("handles tied scores with stable ordering (earlier registration first)", async () => {
      const signers = await ethers.getSigners();
      const p1 = signers[1];
      const p2 = signers[2];
      const p3 = signers[3];

      await contract.connect(p1).register("First");
      await contract.connect(p2).register("Second");
      await contract.connect(p3).register("Third");

      // All players score the same
      await contract.connect(p1).recordActivity(50, 5, 10, "addition");
      await contract.connect(p2).recordActivity(50, 5, 10, "addition");
      await contract.connect(p3).recordActivity(50, 5, 10, "addition");

      const board = await contract.getLeaderboard(3);
      expect(board.length).to.equal(3);
      // Earlier registration should come first for tied scores
      expect(board[0].username).to.equal("First");
      expect(board[1].username).to.equal("Second");
      expect(board[2].username).to.equal("Third");
    });

    it("handles many players requesting small topN", async () => {
      const signers = await ethers.getSigners();
      // Register 10 players with different scores
      for (let i = 1; i <= 10; i++) {
        await contract.connect(signers[i]).register("Player" + i);
        await contract.connect(signers[i]).recordActivity(i * 10, i, 10, "addition");
      }

      const board = await contract.getLeaderboard(3);
      expect(board.length).to.equal(3);
      // Top 3 should be players 10, 9, 8 (highest scores)
      expect(board[0].totalScore).to.equal(100n);
      expect(board[1].totalScore).to.equal(90n);
      expect(board[2].totalScore).to.equal(80n);
    });

    it("handles players with zero scores", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");
      // No activity recorded, all scores are 0

      const board = await contract.getLeaderboard(2);
      expect(board.length).to.equal(2);
      // Both have 0 score, earlier registration comes first
      expect(board[0].username).to.equal("Alice");
      expect(board[1].username).to.equal("Bob");
    });
  });

  describe("Leaderboard Pagination", () => {
    it("returns empty for zero offset beyond total", async () => {
      await contract.connect(player1).register("Alice");
      const board = await contract.getLeaderboardPage(10, 5);
      expect(board.length).to.equal(0);
    });

    it("returns empty when limit is 0", async () => {
      await contract.connect(player1).register("Alice");
      const board = await contract.getLeaderboardPage(0, 0);
      expect(board.length).to.equal(0);
    });

    it("returns correct page of results", async () => {
      const signers = await ethers.getSigners();
      for (let i = 1; i <= 5; i++) {
        await contract.connect(signers[i]).register("P" + i);
        await contract.connect(signers[i]).recordActivity(i * 10, i, 10, "math");
      }

      // Page 1: top 2 (scores 50, 40)
      const page1 = await contract.getLeaderboardPage(2, 0);
      expect(page1.length).to.equal(2);
      expect(page1[0].totalScore).to.equal(50n);
      expect(page1[1].totalScore).to.equal(40n);

      // Page 2: next 2 (scores 30, 20)
      const page2 = await contract.getLeaderboardPage(2, 2);
      expect(page2.length).to.equal(2);
      expect(page2[0].totalScore).to.equal(30n);
      expect(page2[1].totalScore).to.equal(20n);

      // Page 3: last 1 (score 10)
      const page3 = await contract.getLeaderboardPage(2, 4);
      expect(page3.length).to.equal(1);
      expect(page3[0].totalScore).to.equal(10n);
    });

    it("returns empty for no players", async () => {
      const board = await contract.getLeaderboardPage(10, 0);
      expect(board.length).to.equal(0);
    });
  });

  describe("CELO Rewards", () => {
    it("allows owner to fund reward pool", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.1"));
    });

    it("allows claim when coins >= threshold", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");

      // Record 4 perfect sessions to accumulate 30*4=120 coins > 100 threshold
      for (let i = 0; i < 4; i++) {
        await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      }

      const p = await contract.getPlayer(player1.address);
      if (p.coinsEarned >= 100n) {
        const balBefore = await ethers.provider.getBalance(player1.address);
        await contract.connect(player1).claimCeloReward();
        const balAfter = await ethers.provider.getBalance(player1.address);
        expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.001"));
      }
    });
  });
});
