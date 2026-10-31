#!/usr/bin/env bash
# REG-04: run the whole server suite N times (default 10) and keep a log.
# A run counts as bad if vitest exits non-zero or its summary mentions a failed or skipped test.
set -u
RUNS="${1:-10}"
LOG="artifacts/lab-04/regression/server-repeat.txt"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
bad=0
for i in $(seq 1 "$RUNS"); do
  out=$(npm test -w server 2>&1)
  status=$?
  summary=$(echo "$out" | grep -E "^ +Tests " | sed 's/^ *//')
  echo "run $i: ${summary:-no summary line}" | tee -a "$LOG"
  if [ "$status" -ne 0 ] || echo "$summary" | grep -qE "failed|skipped" || [ -z "$summary" ]; then
    bad=$((bad + 1))
    echo "$out" | grep -E "FAIL|×|Error" | head -10 >> "$LOG"
  fi
done
echo "$bad of $RUNS runs had a failure or a skipped test" | tee -a "$LOG"
[ "$bad" -eq 0 ]
