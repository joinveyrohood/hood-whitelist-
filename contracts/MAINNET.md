# VeyroHood campaign contracts — Robinhood Chain mainnet only

Chain ID: `4663` / `0x1237`
RPC: `https://rpc.mainnet.chain.robinhood.com`
Explorer: `https://robinhoodchain.blockscout.com`
Treasury: `0xf6F80827cBAf83798c7763FCd915C0068F2bE60C`

This folder is separate from the Vite frontend so Vercel does not compile Hardhat.

## Do not send the deployer private key to chat, GitHub, or frontend env vars.

## Deploy from your machine

```bash
cd contracts
cp .env.example .env
# put PRIVATE_KEY and OWNER in .env locally
npm install
npx hardhat compile
npx hardhat run scripts/deploy.cjs --network robinhood
```

The script refuses any chain that is not `4663`.

## After addresses exist

1. Verify both contracts on Blockscout.
2. Keep posting `postPrice` at least every 15 minutes or payments/withdrawals revert as stale.
3. Wire `VITE_CAMPAIGN_CONTRACT` and Edge Function `CAMPAIGN_CONTRACT`.
4. Then change `src/main.jsx` payment target from the treasury EOA to `payToVerify`.

Do not change `src/styles.css`.
