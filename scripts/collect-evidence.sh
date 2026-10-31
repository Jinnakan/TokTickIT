#!/usr/bin/env bash
# Runs every suite and saves its output with the commit it ran on.
# Usage: collect-evidence.sh [output-dir]. Pass a folder outside the repository (for example when run on main)
# so a run on another branch does not rewrite the committed copies.
set -o pipefail
cd "$(dirname "$0")/.." || exit 1
out="${1:-artifacts/lab-04/regression}"
mkdir -p "$out"
commit=$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo ' plus uncommitted changes')
branch=$(git branch --show-current)
stamp() { echo "commit $commit on $branch, $(date -u +%Y-%m-%dT%H:%M:%SZ)"; }
status=0

{ stamp; (cd server && npm run prisma:seed >/dev/null 2>&1; npx vitest run --reporter=verbose 2>&1) ; } > "$out/server-output.txt" || status=1
{ stamp; (cd client && npx vitest run --reporter=verbose 2>&1) ; } > "$out/client-output.txt" || status=1
{ stamp; (cd server && npm run prisma:seed >/dev/null 2>&1); npx playwright test 2>&1 ; } > "$out/e2e-output.txt" || status=1
{ stamp; npm run check 2>&1 | tail -40 ; } > "$out/check-output.txt"; [ "${PIPESTATUS[0]}" -eq 0 ] || status=1

for f in server client e2e check; do
  echo "$f: $(grep -E '^ +Tests |passed|failed' "$out/$f-output.txt" | tail -1 | sed 's/^ *//')"
done
exit $status
