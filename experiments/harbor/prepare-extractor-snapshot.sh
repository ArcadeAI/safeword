#!/bin/sh
set -eu
cd "$(dirname "$0")"
repo=${1:-"$HOME/Projects/bdd-extractor"}
revision=$2
fixture=$3
scratch=$(mktemp -d)
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1])" "$scratch"' EXIT
launcher="$PWD/../../scripts/dev"
export COPYFILE_DISABLE=1
git -C "$repo" archive "$revision" > "$scratch/source.tar"
mkdir "$scratch/source"
tar -xf "$scratch/source.tar" -C "$scratch/source"
python3 - "$scratch/source" << 'PY'
import json
from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1])
for name in (".project", ".safeword", ".claude", ".agents", ".codex", ".cursor", "CLAUDE.md", ".mcp.json"):
    path = root / name
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)

for path in root.rglob("AGENTS.md"):
    lines = path.read_text().splitlines()
    markers = ("safeword", "loc gate", ".claude/skills")
    path.write_text("\n".join(line for line in lines if not any(marker in line.lower() for marker in markers)) + "\n")

path = root / "package.json"
package = json.loads(path.read_text())
package["devDependencies"].pop("safeword", None)
package["scripts"].pop("lint:gherkin", None)
path.write_text(json.dumps(package, indent=2) + "\n")
PY
(cd "$scratch/source" && "$launcher" bun install --lockfile-only --ignore-scripts)
tar -czf "$scratch/snapshot.tar.gz" -C "$scratch/source" .
# Materialize treatment dependencies from the same snapshot as the baseline.
# Freeze the resolution date used to build the comparison's public dependencies.
age=$(python3 -c 'from datetime import datetime, timezone; cutoff = datetime(2026, 11, 21, tzinfo=timezone.utc); print(max(0, int((datetime.now(timezone.utc) - cutoff).total_seconds())))')
(cd "$scratch/source" && "$launcher" bun add --minimum-release-age "$age" --dev --exact --lockfile-only --ignore-scripts safeword@1.1.0)
python3 - "$scratch/source" <<'PYTHON'
from hashlib import sha256
from pathlib import Path
import sys

root = Path(sys.argv[1])
expected = {
    "package.json": "2981016507abd539a58726e8aa37b9cde221a3d047cb24febdeb832f5a4d8845",
    "bun.lock": "b20e7ba7dda378c7881e897c36ec87260353d3664da22eac4c23ce5c808267e1",
}
for name, digest in expected.items():
    if sha256((root / name).read_bytes()).hexdigest() != digest:
        raise SystemExit(f"Generated {name} differs from the frozen treatment dependency set")
PYTHON
mv "$scratch/source/package.json" "$fixture/environment/treatment-package.json"
mv "$scratch/source/bun.lock" "$fixture/environment/treatment-bun.lock"
mv "$scratch/snapshot.tar.gz" "$fixture/environment/snapshot.tar.gz"
