/* eslint-disable @typescript-eslint/no-var-requires */
const { ethers } = require("ethers");
const dotenv     = require("dotenv");
const fs         = require("fs");
const path       = require("path");

dotenv.config({ path: ".env.local" });

const RPC_URL     = process.env.CELO_RPC_URL    || "https://forno.celo.org";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
  if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  const deploymentPath = path.join(__dirname, "../../lib/contract.json");
  if (!fs.existsSync(deploymentPath)) throw new Error("lib/contract.json not found. Deploy first.");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(deployment.address, deployment.abi, wallet);

  const today = Math.floor(Date.now() / 86400000);
  console.log(`\n📅 Daily Activity Report — Day ${today} (${new Date().toUTCString()})`);
  console.log(`📍 Contract : ${deployment.address}`);
  console.log(`🌐 Network  : ${deployment.network} (chainId ${deployment.chainId})`);

  // ── 1. Total players ──
  const totalPlayers = await contract.getTotalPlayers();
  console.log(`👥 Total registered players: ${totalPlayers}`);

  // ── 2. Today's active players ──
  const todayActive = await contract.getTodayActivePlayers();
  console.log(`✅ Active today: ${todayActive.length}`);

  // ── 3. Leaderboard top 5 ──
  if (Number(totalPlayers) > 0) {
    const top = Math.min(5, Number(totalPlayers));
    const leaderboard = await contract.getLeaderboard(top);
    console.log("\n🏆 Leaderboard (Top 5):");
    leaderboard.forEach((entry, i) => {
      console.log(`  ${i + 1}. ${entry.username} — Score: ${entry.totalScore} | Streak: ${entry.streak} days`);
    });
  }

  // ── 4. Keeper activity ──
  const deployerAddr   = wallet.address;
  const deployerPlayer = await contract.getPlayer(deployerAddr);

  if (deployerPlayer.exists) {
    const isActive = await contract.isActiveToday(deployerAddr);
    if (!isActive) {
      console.log("\n🤖 Recording keeper daily activity...");
      const tx = await contract.recordActivity(10, 8, 10, "keeper", { gasLimit: 300000 });
      await tx.wait();
      console.log(`✅ Keeper activity recorded. TX: ${tx.hash}`);
    } else {
      console.log("\n🤖 Keeper already active today.");
    }
  } else {
    console.log("\n🤖 Registering keeper wallet...");
    const tx = await contract.register("MathBlocKeeper");
    await tx.wait();
    console.log("✅ Keeper registered.");
  }

  // ── 5. Reward pool ──
  const rewardPool = await contract.rewardPool();
  console.log(`\n💰 Reward pool: ${ethers.formatEther(rewardPool)} CELO`);

  if (rewardPool < ethers.parseEther("0.005")) {
    console.log("⚠️  Pool low — topping up with 0.01 CELO...");
    const tx = await contract.fundRewardPool({ value: ethers.parseEther("0.01") });
    await tx.wait();
    console.log("✅ Pool refilled.");
  }

  console.log("\n✅ Daily activity script complete.\n");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
