"""Build the frozen Claude Code bundle used in the compact routing experiment."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent
REVISION = "72165cde6"
INVENTORY = "plugin/inventory.json"
IDENTITY = "plugin/identity.json"
HANDBOOK = "plugin/resources/SAFEWORD.md"
SKILLS = ("plugin/skills/bdd/SKILL.md", "plugin/templates/skills/bdd/SKILL.md")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(data):
    return (json.dumps(data, indent=2) + "\n").encode()


def skill_digest(payload):
    header, body = payload.decode()[4:].split("\n---\n", 1)
    description = re.search(r"(?m)^description: ([^\n]+)(?:\n  [^\n]+)*", header)[0]
    description = " ".join(line.strip() for line in description[13:].splitlines())
    if description.startswith('"'):
        description = json.loads(description)
    contract = [{"allowed-tools": "*", "description": description, "name": "bdd"}, body]
    return sha(json.dumps(contract, ensure_ascii=False, separators=(",", ":")).encode())


def pack(output):
    payload = subprocess.check_output(
        ["git", "archive", REVISION, "plugin", ".claude-plugin/marketplace.json"],
        cwd=ROOT.parents[2],
    )
    handbook = (ROOT / "compact/SAFEWORD.md").read_bytes()
    skill = (ROOT / "compact/BDD.md").read_bytes()
    replacements = {HANDBOOK: handbook, **dict.fromkeys(SKILLS, skill)}
    with tarfile.open(fileobj=io.BytesIO(payload)) as source:
        inventory = json.load(source.extractfile(INVENTORY))
        identity = json.load(source.extractfile(IDENTITY))
        assets = {asset["path"]: asset for asset in inventory["assets"]}
        for path, content in replacements.items():
            asset = assets[path.removeprefix("plugin/")]
            old = source.extractfile(path).read()
            if asset["sha256"] != sha(old):
                raise ValueError(f"Original asset digest differs for {path}")
            asset["sha256"] = sha(content)
            if "skill_sha256" in asset:
                if asset["skill_sha256"] != skill_digest(old):
                    raise ValueError(f"Original skill digest differs for {path}")
                asset["skill_sha256"] = skill_digest(content)
        replacements[INVENTORY] = encoded(inventory)
        identity["inventory_sha256"] = sha(replacements[INVENTORY])
        replacements[IDENTITY] = encoded(identity)
        with tarfile.open(output, "w") as target:
            for member in source:
                if member.name in replacements:
                    content = replacements[member.name]
                    member.size = len(content)
                    target.addfile(member, io.BytesIO(content))
                else:
                    target.addfile(member, source.extractfile(member) if member.isfile() else None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    pack(parser.parse_args().output)
