import { expect } from "chai";
import { ethers } from "hardhat";
import { MathBlocGame } from "../artifacts/contracts/MathBlocGame.sol/MathBlocGame";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MathBlocGame", function () {
  let contract: MathBlocGame;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let signer: HardhatEthersSigner;

  // Helper: record activity without attestation (signer not set)
  async function recordUnsigned(
    player: HardhatEthersSigner,
    score: number,
    correct: number,
    attempts: number,
    topic: string
  ) {
    return contract.connect(player).recordActivity(score, correct, attempts, topic, 0, "0x");
  }

  // Helper: build EIP-712 signed attestation
  async function signSession(
    signerWallet: HardhatEthersSigner,
    playerAddr: string,
    score: number,
    correct: number,
    attempts: number,
    topic: string,
    nonce: bigint,
    deadline: number
  ) {
    const domain = {
      name: "MathBlocGame",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress(),
    };
    const types = {
      Session: [
        { name: "player", type: "address" },
        { name: "score", type: "uint256" },
        { name: "correct", type: "uint256" },
        { name: "attempts", type: "uint256" },
        { name: "topic", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = { player: playerAddr, score, correct, attempts, topic, nonce, deadline };
    return signerWallet.signTypedData(domain, types, value);
  }

  beforeEach(async () => {
    [owner, player1, player2, signer] = await ethers.getSigners();
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
      await recordUnsigned(player1, 80, 8, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      expect(p.totalScore).to.equal(80n);
      expect(p.totalCorrect).to.equal(8n);
      expect(p.coinsEarned).to.equal(10n); // DAILY_REWARD_COINS
    });

    it("awards perfect score bonus", async () => {
      await recordUnsigned(player1, 100, 10, 10, "addition");
      const p = await contract.getPlayer(player1.address);
      // DAILY_REWARD_COINS(10) + PERFECT_SCORE_BONUS(20) = 30
      expect(p.coinsEarned).to.equal(30n);
    });

    it("rejects unregistered player", async () => {
      await expect(
        recordUnsigned(player2, 50, 5, 10, "counting")
      ).to.be.revertedWith("Not registered");
    });

    it("rejects invalid correct count", async () => {
      await expect(
        recordUnsigned(player1, 50, 11, 10, "addition")
      ).to.be.revertedWith("Invalid correct count");
    });

    it("tracks activity history", async () => {
      await recordUnsigned(player1, 70, 7, 10, "subtraction");
      const history = await contract.getActivityHistory(player1.address);
      expect(history.length).to.equal(1);
      expect(history[0].topicPlayed).to.equal("subtraction");
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

  describe("Streak", () => {
    it("sets streak to 1 on first activity", async () => {
      await contract.connect(player1).register("Bob");
      await recordUnsigned(player1, 50, 5, 10, "counting");
      const p = await contract.getPlayer(player1.address);
      expect(p.streak).to.equal(1n);
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
    it("returns sorted leaderboard", async () => {
      await contract.connect(player1).register("Alice");
      await contract.connect(player2).register("Bob");
      await recordUnsigned(player1, 100, 10, 10, "addition");
      await recordUnsigned(player2, 50, 5, 10, "counting");

      const board = await contract.getLeaderboard(2);
      expect(board[0].username).to.equal("Alice");
      expect(board[1].username).to.equal("Bob");
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

  describe("CELO Rewards", () => {
    it("allows owner to fund reward pool", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      expect(await contract.rewardPool()).to.equal(ethers.parseEther("0.1"));
    });

    it("cannot farm coins to reach threshold in one day", async () => {
      await contract.connect(owner).fundRewardPool({ value: ethers.parseEther("0.1") });
      await contract.connect(player1).register("Alice");

      // 10 non-perfect sessions in one day: only 10 coins (not 100)
      for (let i = 0; i < 10; i++) {
        await recordUnsigned(player1, 50, 5, 10, "addition");
      }

      const p = await contract.getPlayer(player1.address);
      expect(p.coinsEarned).to.equal(10n); // only daily reward once
      await expect(
        contract.connect(player1).claimCeloReward()
      ).to.be.revertedWith("Not enough coins");
    });
  });

  describe("Session Signer Management", () => {
    it("owner can set session signer", async () => {
      await contract.connect(owner).setSessionSigner(signer.address);
      expect(await contract.sessionSigner()).to.equal(signer.address);
    });

    it("owner can disable session signer", async () => {
      await contract.connect(owner).setSessionSigner(signer.address);
      await contract.connect(owner).setSessionSigner(ethers.ZeroAddress);
      expect(await contract.sessionSigner()).to.equal(ethers.ZeroAddress);
    });

    it("non-owner cannot set session signer", async () => {
      await expect(
        contract.connect(player1).setSessionSigner(signer.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });
});
