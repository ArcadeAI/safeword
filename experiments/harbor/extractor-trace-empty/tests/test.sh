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
# Run the existing regression suite in its normal module-resolution context.
test -s /tests/trace-regressions.ts
fixture=$(mktemp packages/extractor/src/.harbor-trace-XXXXXX.ts)
trap 'rm -f "$fixture"' EXIT
cp /tests/trace-regressions.ts "$fixture"
regressions=0
if bun "$fixture"; then regressions=1; fi
rm -f "$fixture"
python3 /tests/grade_trace.py "$regressions"
# Supplemental inspection has its own allowance. A slow mentioned commit must
# never prevent Harbor from publishing the final checkout's reward.
timeout -k 1 25 python3 /tests/grade_trace.py mentions || echo "Supplemental replay incomplete" >&2
