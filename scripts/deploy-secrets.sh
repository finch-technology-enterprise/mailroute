#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Read .env (or .dev.vars) and push every key as a Wrangler secret.
# Usage:  ./scripts/deploy-secrets.sh [--remote]
#         npm run deploy-secret
#
# Lines starting with # and blank lines are ignored.
# Keys with placeholder values (containing "your-", "REPLACE_WITH", or "<") are
# skipped to avoid accidentally deploying dummy values.
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE="${1:-.env}"
[ ! -f "$ENV_FILE" ] && ENV_FILE=".dev.vars"
[ ! -f "$ENV_FILE" ] && { echo "No .env or .dev.vars found"; exit 1; }

echo "→ Deploying secrets from $ENV_FILE"

while IFS='=' read -r key value; do
  # Skip comments and blank lines
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue

  # Skip placeholder values
  if [[ "$value" =~ (your-|REPLACE_WITH|<) ]]; then
    echo "  ⏭  $key (placeholder, skipped)"
    continue
  fi

  echo "$value" | wrangler secret put "$key" "$@"
done < "$ENV_FILE"

echo "✓ Done"
