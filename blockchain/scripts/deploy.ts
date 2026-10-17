import { ethers } from "hardhat";

async function main() {
  console.log("Deploying VeriChainRegistry...");
  
  const VeriChainRegistry = await ethers.getContractFactory("VeriChainRegistry");
  const registry = await VeriChainRegistry.deploy();

  await registry.waitForDeployment();

  console.log(`VeriChainRegistry deployed to: ${await registry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
