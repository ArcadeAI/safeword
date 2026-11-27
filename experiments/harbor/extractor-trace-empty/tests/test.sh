#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app
if [ -f /tmp/harbor-candidate-evidence.sh ]; then
  sh /tmp/harbor-candidate-evidence.sh /tmp/harbor-candidate-before.tree /logs/verifier
else
  # Offline calibration and Harbor oracle runs have no comparison-agent setup.
  base=$(git rev-list --max-parents=0 HEAD)
  git diff --binary "$base" > /logs/verifier/candidate.patch
fi
git ls-files --others --exclude-standard > /logs/verifier/untracked-files.txt
cp /tests/fixture-trace.ts packages/extractor/src/.harbor-trace.ts
set +e
bun packages/extractor/src/.harbor-trace.ts
code=$?
set -e
if [ "$code" -eq 0 ]; then
  echo 1 > /logs/verifier/reward.txt
else
  echo 0 > /logs/verifier/reward.txt
fi
