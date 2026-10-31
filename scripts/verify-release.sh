#!/usr/bin/env bash
# Checks that the Lab 4 submission is complete (handout §12 and the contract's definition of done).
# Prints every problem, then exits non-zero if there was any.
cd "$(dirname "$0")/.." || exit 1
problems=0
fail() { echo "PROBLEM: $1"; problems=$((problems + 1)); }
need() { [ -e "$1" ] || fail "missing $1"; }

for f in specification tests ui-spec api-spec reviewer ai-use; do need "docs/lab-04/$f.md"; done
for f in actions-taken ticket-workflow requester-dashboard staff-dashboard; do need "server/tests/lab-04/$f.api.test.ts"; done
for f in StaffDashboard RequesterDashboard ActionsTaken TicketWorkflow; do need "client/tests/lab-04/$f.test.tsx"; done
for f in actions-taken-flow ticket-resolution dashboards; do need "e2e/lab-04/$f.spec.ts"; done
need "artifacts/lab-04/regression/server-repeat.txt"

planned=$(grep -c "| Planned |" docs/lab-04/tests.md)
[ "$planned" -eq 0 ] || fail "docs/lab-04/tests.md still has $planned Planned rows"
open=$(cat docs/lab-04/tests.md docs/lab-04/ui-spec.md | grep -c '^- \[ \]')
[ "$open" -eq 0 ] || fail "$open unchecked checklist boxes in tests.md or ui-spec.md"

grep -q "0 of 10 runs" artifacts/lab-04/regression/server-repeat.txt 2>/dev/null || fail "server-repeat.txt does not show 0 of 10 bad runs"

index="artifacts/lab-04/screenshots/INDEX.md"
if [ -f "$index" ]; then
  listed=$(grep -oE '[a-z0-9-]+/[a-z0-9-]+-(desktop|tablet|mobile)\.png' "$index" | sort -u)
  [ -n "$listed" ] || fail "$index lists no screenshots"
  for rel in $listed; do [ -f "artifacts/lab-04/screenshots/$rel" ] || fail "screenshot in the index is missing: $rel"; done
  for group in staff-dashboard requester-dashboard actions-taken; do
    count=$(echo "$listed" | grep -c "^$group/")
    [ "$count" -gt 0 ] || fail "no screenshots for $group"
  done
else
  fail "missing $index (run npm run screenshots)"
fi

git check-ignore -q server/uploads || fail "server/uploads is not ignored"
git check-ignore -q server/.env || fail "server/.env is not ignored"
git check-ignore -q test-results || fail "test-results is not ignored"
tracked_uploads=$(git ls-files server/uploads server/src/uploads | wc -l | tr -d ' ')
[ "$tracked_uploads" -eq 0 ] || fail "$tracked_uploads uploaded files are tracked"
tracked_env=$(git ls-files | grep -cE '(^|/)\.env$')
[ "$tracked_env" -eq 0 ] || fail "a .env file is tracked"

for f in artifacts/lab-04/evidence/pr-timeline.txt artifacts/lab-04/evidence/dashboard-vs-database.txt artifacts/lab-04/regression/server-output.txt artifacts/lab-04/regression/client-output.txt artifacts/lab-04/regression/e2e-output.txt; do need "$f"; done
grep -q "Every number agrees" artifacts/lab-04/evidence/dashboard-vs-database.txt 2>/dev/null || fail "dashboard-vs-database.txt does not say every number agrees"
prompts=$(grep -cE '^\| [0-9]+ \|' docs/lab-04/ai-use.md 2>/dev/null)
{ [ "${prompts:-0}" -ge 6 ] && [ "${prompts:-0}" -le 10 ]; } || fail "ai-use.md has ${prompts:-0} prompt rows, the handout wants 6 to 10"

grep -q "docs/lab-04" README.md || fail "README does not point at docs/lab-04"
grep -qi "npm run check" README.md || fail "README does not mention npm run check"

if [ "$problems" -eq 0 ]; then echo "verify-release: everything is in place"; else echo "verify-release: $problems problem(s)"; exit 1; fi
