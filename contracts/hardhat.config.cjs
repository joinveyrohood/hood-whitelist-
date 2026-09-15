try {
  require("dotenv").config();
} catch (_) {}

const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
} = require("hardhat/builtin-tasks/task-names");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();
  return paths.filter((p) => {
    const n = p.replace(/\\/g, "/");
    if (n.includes("/lib/")) return false;
    if (n.includes("/forge-test/")) return false;
    if (n.includes("/script/")) return false;
    if (n.includes("/node_modules/")) return false;
    if (n.includes("/out/")) return false;
    if (n.includes("/cache/")) return false;
    return n.endsWith(".sol");
  });
});

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { chainId: 31337 },
    robinhood: {
      url: process.env.RH_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: ".",
    tests: "./test",
    cache: "./cache",
    artifacts: "./hh-artifacts",
  },
  mocha: { timeout: 180000 },
};
