#!/bin/sh
set -eu
cd "$(dirname "$0")"
repo=${1:-"$HOME/Projects/bdd-extractor"}
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
git -C "$repo" show feb9475ffd837891897901e7c3f3867d38b0348a:packages/extractor/src/test-trace.ts \
  > "$scratch/fixture-trace.ts"

# Apply just the benchmark's assertions to the pinned private test at prepare time.
python3 - "$scratch/fixture-trace.ts" <<'PYTHON'
from hashlib import sha256
from pathlib import Path
import sys

fixture = Path(sys.argv[1])
source = fixture.read_bytes()
if sha256(source).hexdigest() != "504620f40b27f9708ea51a315a5e3034c02d60d655d6dcf08fe8262d9c2c1d3b":
    raise SystemExit("Trace verifier upstream source changed")
lines = source.decode().splitlines()
lines[323:324] = [
    '      nothingCompared,',
]
lines[317:318] = [
    '      zeroMatches,',
]
lines[231:234] = [
    '  return readReport();',
]
lines[229:230] = [
    '    if (!zeroMatches.test(message) && !nothingCompared.test(message)) throw error;',
    '',
    '    const report = readReport();',
    '    if (report.matched.length > 0 || report.errors.length > 0) throw error;',
    '    return report;',
]
lines[225:225] = [
    '  const readReport = () =>',
    '    JSON.parse(',
    "      fs.readFileSync(path.join(directory, 'output', 'trace-report.json'), 'utf8'),",
    '    ) as TraceReport;',
    '',
]
lines[216:216] = [
    '// The CLI contract specifies the reason, without requiring the historical wording.',
    'const zeroMatches = /nothing matched|no matches|zero matches|0 matched/i;',
    'const nothingCompared = /nothing (?:was compared|to compare)|no (?:areas? (?:has|have|had|with) both|overlapping areas)|no areas were compared/i;',
    '',
]
fixture.write_text("\n".join(lines) + "\n")
PYTHON
./prepare-extractor-snapshot.sh "$repo" 893a2376ece7114d86a994665157bc8096acf92a extractor-trace-empty
mv "$scratch/fixture-trace.ts" extractor-trace-empty/tests/fixture-trace.ts
