# VeyroHood Campaign Contracts — Robinhood Chain Mainnet

Network: Robinhood Chain **mainnet only**
- Chain ID: `4663` (`0x1237`)
- RPC: `https://rpc.mainnet.chain.robinhood.com`
- Explorer: `https://robinhoodchain.blockscout.com`
- Native token: ETH
- Treasury: `0xf6F80827cBAf83798c7763FCd915C0068F2bE60C`

Do not put a private key in `src/main.jsx`, Vercel public env, GitHub, or chat.

## Campaign economics

Quoted verification fee = `$0.25` converted with the session ETH/USD price.

| Slice | Rule |
|---|---|
| Qualifying amount | `min(msg.value, quoted $0.25 wei)` |
| Referrer | `20%` of qualifying amount |
| Treasury | everything else (`msg.value - referral`) |
| No referrer / self / treasury / contract | `100%` of `msg.value` to treasury |
| Overpayment | extra ETH above `$0.25` does **not** increase the referral credit; it goes to treasury |
| Fat-finger cap | payment above `maxPaymentBps` (default 3x quoted) reverts |

`$0.25` and `$2` are never hard-coded as ETH amounts.

## Price design

Robinhood Chain has no Chainlink ETH/USD feed for this campaign.

`SessionEthUsdPrice` stores `price8` (8 decimals) and `updatedAt`.
`payToVerify` and `withdraw` revert if the price is missing or older than `maxPriceAge` (default 30 minutes).

Risk: the price poster can distort `$0.25` / `$2`. Move ownership to a multisig and post price on a short cadence.

## Test

```bash
cd contracts
npm install
npx hardhat test --network hardhat
```

## Mainnet deploy

```bash
cp .env.example .env
npm install
npx hardhat compile
npx hardhat run scripts/deploy.cjs --network robinhood
```

The script refuses any chain other than `4663`.
