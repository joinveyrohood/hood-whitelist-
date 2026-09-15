const hre = require("hardhat");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 4663) {
    throw new Error(`Refusing to deploy. Expected Robinhood mainnet chainId 4663, got ${network.chainId}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const treasury = process.env.TREASURY || "0xf6F80827cBAf83798c7763FCd915C0068F2bE60C";
  const owner = process.env.OWNER || deployer.address;
  const initialUsd = Number(process.env.INITIAL_ETH_USD || "3032");

  if (!hre.ethers.isAddress(treasury) || !hre.ethers.isAddress(owner)) {
    throw new Error("TREASURY and OWNER must be valid addresses");
  }
  if (!Number.isFinite(initialUsd) || initialUsd <= 0) {
    throw new Error("INITIAL_ETH_USD must be a positive number");
  }

  const initialPrice8 = BigInt(Math.round(initialUsd * 1e8));

  console.log("Network          : Robinhood Chain mainnet (4663 / 0x1237)");
  console.log("Deployer         :", deployer.address);
  console.log("Owner            :", owner);
  console.log("Treasury         :", treasury);
  console.log("Initial ETH/USD  :", initialUsd, "->", initialPrice8.toString());

  const Price = await hre.ethers.getContractFactory("SessionEthUsdPrice");
  const price = await Price.deploy(owner, initialPrice8);
  await price.waitForDeployment();
  const priceAddress = await price.getAddress();
  console.log("SessionEthUsdPrice:", priceAddress);

  const Campaign = await hre.ethers.getContractFactory("VeyroHoodCampaign");
  const campaign = await Campaign.deploy(treasury, priceAddress, owner);
  await campaign.waitForDeployment();
  const campaignAddress = await campaign.getAddress();
  console.log("VeyroHoodCampaign :", campaignAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
