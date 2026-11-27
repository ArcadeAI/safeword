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
cp /tests/fixture-page-text.ts packages/extractor/src/.harbor-page-text.ts
reward=1
for scenario in "Supporting: the thin line judges the delivered text" "A page exactly on the thin line keeps Readability's text" "Supporting: a code block keeps its whitespace"; do
  if bun packages/extractor/src/.harbor-page-text.ts "$scenario"; then
    printf 'PASS %s\n' "$scenario"
  else
    printf 'FAIL %s\n' "$scenario"
    reward=0
  fi
done
printf '%s\n' "$reward" > /logs/verifier/reward.txt
