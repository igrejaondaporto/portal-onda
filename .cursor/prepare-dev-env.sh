#!/usr/bin/env bash
# Seeds a development .env for each app from its committed .env.production.
#
# Each app connects to the shared Firebase project using the *public* Web SDK
# config kept in apps/<base>/.env.production (safe to expose — security lives in
# the Firestore/Storage rules and Auth, not in hiding these values). Vite only
# loads .env.production in production mode, so `npm run dev` (development mode)
# would otherwise start with an unconfigured Firebase app. Copying the values
# into a dev-loaded .env lets the canonical `npm run dev` work end to end.
#
# Idempotent: never overwrites an existing .env.
set -euo pipefail

cd "$(dirname "$0")/.."

for dir in apps/*/; do
  base="$(basename "$dir")"
  prod="$dir.env.production"
  dev="$dir.env"
  if [[ -f "$prod" && ! -f "$dev" ]]; then
    cp "$prod" "$dev"
    echo "prepare-dev-env: seeded $dev from $prod ($base)"
  else
    echo "prepare-dev-env: skipped $base (.env exists or no .env.production)"
  fi
done
