/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MathBlocGame with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "CELO");

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 CELO. Fund it first.");
  }

  // Deploy contract
  const Factory = await hre.ethers.getContractFactory("MathBlocGame");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ MathBlocGame deployed to:", address);

  // Fund reward pool with 0.01 CELO
  const fundTx = await contract.fundRewardPool({ value: hre.ethers.parseEther("0.01") });
  await fundTx.wait();
  console.log("✅ Reward pool funded with 0.01 CELO");

  // Read ABI from compiled artifacts
  const artifactPath = path.join(
    __dirname, "../artifacts/contracts/contracts/MathBlocGame.sol/MathBlocGame.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const network = await hre.ethers.provider.getNetwork();

  const deployment = {
    network: network.name,
    chainId: Number(network.chainId),
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  // Save to lib/contract.json so frontend loads it automatically
  const outPath = path.join(__dirname, "../../lib/contract.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("✅ Saved to lib/contract.json");
  console.log("\n🎉 Deployment complete!");
  console.log(`   Network  : ${deployment.network} (chainId ${deployment.chainId})`);
  console.log(`   Contract : ${address}`);
  console.log(`   CeloScan : https://celoscan.io/address/${address}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
