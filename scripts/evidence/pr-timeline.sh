#!/usr/bin/env bash
# Lists the Lab 4 pull requests with their merge times, oldest first.
cd "$(dirname "$0")/../.." || exit 1
mkdir -p artifacts/lab-04/evidence
{
  echo "Pull requests, oldest merge first (generated $(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo
  gh pr list --state all --limit 100 --json number,title,baseRefName,headRefName,state,mergedAt,createdAt \
    --jq 'sort_by(.number) | .[] | select(.number >= 54) | "#\(.number) \(.state) base=\(.baseRefName) head=\(.headRefName) created=\(.createdAt) merged=\(.mergedAt // "-") | \(.title)"'
} | tee artifacts/lab-04/evidence/pr-timeline.txt
