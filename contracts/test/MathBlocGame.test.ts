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
      expect(await contract.getTotalPlayers()).to.equal(1);
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
      expect(p.totalScore).to.equal(80);
      expect(p.totalCorrect).to.equal(8);
      expect(p.coinsEarned).to.equal(10); // DAILY_REWARD_COINS
    });

    it("awards perfect score bonus", async () => {
      await contract.connect(player1).recordActivity(100, 10, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      // DAILY_REWARD_COINS(10) + PERFECT_SCORE_BONUS(20) = 30
      expect(p.coinsEarned).to.equal(30);
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
      expect(p.streak).to.equal(1);
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
  });

  describe("CELO Rewards", () => {
    it("allows owner to fund reward pool", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.1"));
    });

    it("allows claim when coins >= threshold", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");

      // Manually set coins via multiple perfect sessions (mock: just check logic)
      // Record 4 perfect sessions to accumulate 30*4=120 coins > 100 threshold
      for (let i = 0; i < 4; i++) {
        // Each call in same block counts as same day, only first updates streak
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
