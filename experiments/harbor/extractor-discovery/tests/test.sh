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
cp /tests/verify-discovery.ts packages/extractor/src/.harbor-discovery.ts
bun packages/extractor/src/.harbor-discovery.ts
