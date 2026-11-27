"""Build a fixture-only Claude plugin variant from a committed Safeword revision."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile


GUIDANCE = (
    "If the logic you’re changing also controls behavior that should stay the same, "
    "reuse a check that passes before the fix and would fail if that behavior changed. "
    "Add a focused check only if coverage is missing, then rerun it after the fix. "
    "This check is separate from the failing test for the bug."
)
SKILL = "plugin/skills/debug/SKILL.md"
INVENTORY = "plugin/inventory.json"
IDENTITY = "plugin/identity.json"


def digest(content):
    return hashlib.sha256(content).hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2) + "\n").encode()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--routing", action="store_true", help="Test debug routing instead of preservation wording")
parser.add_argument("revision")
parser.add_argument("output", type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
archive = subprocess.check_output(
    ["git", "-C", str(repo), "archive", args.revision, "plugin", ".claude-plugin/marketplace.json"]
)
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    target_path = "plugin/resources/SAFEWORD.md" if args.routing else SKILL
    original = source.extractfile(target_path).read()
    if args.routing:
        anchor = b"### 3. Build\n\n"
        guidance = (
            "For a reported bug whose cause is unclear or whose behavior depends on interactions between components, "
            "load the debug skill before editing. For an obvious, localized fix, use the normal patch or task workflow."
        )
    else:
        anchor = b"#### 2. Implement Fix\n\n"
        guidance = GUIDANCE
    if original.count(anchor) != 1:
        raise ValueError("Could not find a unique guidance insertion point")
    updated = original.replace(anchor, anchor + (guidance + "\n\n").encode())
    inventory = json.load(source.extractfile(INVENTORY))
    asset, = [a for a in inventory["assets"] if a["path"] == target_path.removeprefix("plugin/")]
    if asset["sha256"] != digest(original):
        raise ValueError("Original asset digest does not match the plugin inventory")
    asset["sha256"] = digest(updated)
    identity = json.load(source.extractfile(IDENTITY))
    replacements = {target_path: updated, INVENTORY: json_bytes(inventory)}
    identity["inventory_sha256"] = digest(replacements[INVENTORY])
    replacements[IDENTITY] = json_bytes(identity)

    with args.output.open("xb") as target, tarfile.open(fileobj=target, mode="w") as output:
        for member in source:
            if member.name in replacements:
                content = replacements[member.name]
                member.size = len(content)
                output.addfile(member, io.BytesIO(content))
            else:
                output.addfile(member, source.extractfile(member) if member.isfile() else None)
