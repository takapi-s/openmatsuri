#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/pocky/.nvm/versions/node/v20.19.5/bin:$PATH"
cd "$(dirname "$0")/.."

echo "==> Typecheck & build"
pnpm --filter @openmatsuri/config typecheck
pnpm --filter @openmatsuri/viewer build
pnpm --filter @openmatsuri/tracker build
pnpm --filter @openmatsuri/admin build

echo "==> OK"
