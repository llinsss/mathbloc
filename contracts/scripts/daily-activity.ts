/**
 * daily-activity.ts
 * ─────────────────
 * Cron-ready script that:
 *  1. Reads all registered players from the contract
 *  2. Checks who has NOT been active today
 *  3. Sends a reminder log (extend with email/push notifications)
 *  4. The deployer wallet records a "keeper" activity to keep the contract warm
 *  5. Prints a daily leaderboard snapshot
 *
 * Run manually:  npx ts-node contracts/scripts/daily-activity.ts
 * Cron (daily):  0 9 * * * cd /path/to/math && npx ts-node contracts/scripts/daily-activity.ts >> logs/daily.log 2>&1
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const RPC_URL    = process.env.CELO_RPC_URL    || "https://alfajores-forno.celo-testnet.org";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

async function main() {
  if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env.local");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../../lib/contract.json");
  if (!fs.existsSync(deploymentPath)) throw new Error("lib/contract.json not found. Deploy first.");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(deployment.address, deployment.abi, wallet);

  const today = Math.floor(Date.now() / 86400000);
  console.log(`\n📅 Daily Activity Report — Day ${today} (${new Date().toUTCString()})`);
  console.log(`📍 Contract: ${deployment.address}`);

  // ── 1. Total players ──
  const totalPlayers: bigint = await contract.getTotalPlayers();
  console.log(`👥 Total registered players: ${totalPlayers}`);

  // ── 2. Today's active players ──
  const todayActive: string[] = await contract.getTodayActivePlayers();
  console.log(`✅ Active today: ${todayActive.length}`);

  // ── 3. Leaderboard top 5 ──
  if (Number(totalPlayers) > 0) {
    const top = Math.min(5, Number(totalPlayers));
    const leaderboard = await contract.getLeaderboard(top);
    console.log("\n🏆 Leaderboard (Top 5):");
    leaderboard.forEach((entry: { username: string; totalScore: bigint; streak: bigint }, i: number) => {
      console.log(`  ${i + 1}. ${entry.username} — Score: ${entry.totalScore} | Streak: ${entry.streak} days`);
    });
  }

  // ── 4. Keeper activity: deployer records a daily ping ──
  const deployerAddr = wallet.address;
  const deployerPlayer = await contract.getPlayer(deployerAddr);

  if (deployerPlayer.exists) {
    const isActive: boolean = await contract.isActiveToday(deployerAddr);
    if (!isActive) {
      console.log("\n🤖 Recording keeper daily activity...");
      const tx = await contract.recordActivity(
        10,        // score
        8,         // correct
        10,        // attempts
        "keeper",  // topic
        { gasLimit: 300000 }
      );
      await tx.wait();
      console.log(`✅ Keeper activity recorded. TX: ${tx.hash}`);
    } else {
      console.log("\n🤖 Keeper already active today.");
    }
  } else {
    // Auto-register deployer as keeper if not registered
    console.log("\n🤖 Registering keeper wallet...");
    const tx = await contract.register("MathBlocKeeper");
    await tx.wait();
    console.log("✅ Keeper registered.");
  }

  // ── 5. Reward pool balance ──
  const rewardPool: bigint = await contract.rewardPool();
  console.log(`\n💰 Reward pool: ${ethers.formatEther(rewardPool)} CELO`);

  // Refill pool if low (< 0.005 CELO)
  if (rewardPool < ethers.parseEther("0.005")) {
    console.log("⚠️  Reward pool low — topping up with 0.01 CELO...");
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
