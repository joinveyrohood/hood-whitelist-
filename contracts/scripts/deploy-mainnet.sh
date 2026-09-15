#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RPC_URL="${RH_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "PRIVATE_KEY is not set. Put it in contracts/.env on this machine only."
  exit 1
fi

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$CHAIN_ID" != "4663" ]]; then
  echo "Refusing to deploy. Expected Robinhood mainnet 4663, got ${CHAIN_ID}"
  exit 1
fi

echo "Connected to Robinhood Chain mainnet (4663)"
echo "Treasury: 0xf6F80827cBAf83798c7763FCd915C0068F2bE60C"

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow \
  --private-key "$PRIVATE_KEY"
