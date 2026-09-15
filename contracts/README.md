# VeyroHood contracts — Robinhood Chain mainnet

Chain ID `4663`. RPC `https://rpc.mainnet.chain.robinhood.com`.
Treasury `0xf6F80827cBAf83798c7763FCd915C0068F2bE60C`.

Compiler: Solidity `0.8.24`, optimizer `200`, EVM `cancun`.

## Compile / test

```bash
cd contracts
npm install
npx hardhat compile --show-stack-traces
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit
forge test
```

Hardhat is compile-only. Prefer Foundry for tests and mainnet deploy.

## Mainnet deploy

Create `contracts/.env` locally. Do not commit it or paste the key into chat.

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY and optional OWNER, INITIAL_ETH_USD
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit
bash scripts/deploy-mainnet.sh
```

The script refuses any chain id other than `4663`.
