import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MathBlocGame with:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "CELO");

  // Deploy
  const Factory = await ethers.getContractFactory("MathBlocGame");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ MathBlocGame deployed to:", address);

  // Fund reward pool with 0.01 CELO
  const fundTx = await contract.fundRewardPool({ value: ethers.parseEther("0.01") });
  await fundTx.wait();
  console.log("✅ Reward pool funded with 0.01 CELO");

  // Save deployment info
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../artifacts/contracts/MathBlocGame.sol/MathBlocGame.json"),
        "utf8"
      )
    ).abi,
  };

  // Write to lib/ so the frontend can import it
  fs.writeFileSync(
    path.join(__dirname, "../../lib/contract.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("✅ Deployment info saved to lib/contract.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
