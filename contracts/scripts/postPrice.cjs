const hre = require("hardhat");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  if (Number(network.chainId) !== 4663) {
    throw new Error(`Expected chainId 4663, got ${network.chainId}`);
  }

  const priceSource = process.env.PRICE_SOURCE;
  const usd = Number(process.env.INITIAL_ETH_USD);
  if (!hre.ethers.isAddress(priceSource)) throw new Error("PRICE_SOURCE is required");
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("INITIAL_ETH_USD is required");

  const price8 = BigInt(Math.round(usd * 1e8));
  const contract = await hre.ethers.getContractAt("SessionEthUsdPrice", priceSource);
  const tx = await contract.postPrice(price8);
  console.log("postPrice tx:", tx.hash);
  await tx.wait();
  console.log("Updated ETH/USD 8-decimal price:", price8.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
