"""Materialize the routing fixtures and verify starter/reference behavior."""

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture_grader import calibrate, grade_script


def prepare(root, fixture):
    task = root / fixture["id"]
    environment = task / "environment"
    tests = task / "tests"
    environment.mkdir(parents=True, exist_ok=True)
    tests.mkdir(exist_ok=True)
    (task / "instruction.md").write_text(fixture["prompt"] + "\n")
    (task / "task.toml").write_text(
        'version = "1.0"\n\n[verifier]\ntimeout_sec = 45\n'
    )
    (environment / "Dockerfile").write_text(
        "FROM safeword-harbor-proof-base:1.1.0\nWORKDIR /app\n"
        "RUN unlink public-test.mjs && npm pkg delete scripts.test\n"
        "COPY task.mjs ./\n"
        "RUN git add -A && "
        "git -c user.name=Harbor -c user.email=fixture@example.invalid "
        'commit -qm "Frozen fixture"\n'
    )
    starter = fixture["starter"] + "\n"
    if contract := fixture.get("api"):
        starter = f"// {contract}\n" + starter
    (environment / "task.mjs").write_text(starter)
    grader = tests / "grade.mjs"
    grader.write_text(grade_script(fixture["functional"], fixture["preservation"]))
    (tests / "test.sh").write_text(
        '#!/bin/sh\nset -eu\nmkdir -p /logs/verifier\n'
        'node /tests/grade.mjs /app/task.mjs /logs/verifier/reward.json\n'
    )
    return starter, grader


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()
fixtures = json.loads(Path(__file__).with_name("fixtures.json").read_text())
for fixture in fixtures:
    starter, grader = prepare(args.output.resolve(), fixture)
    reference = starter + "\n" + fixture["reference"] if fixture.get("api") else fixture["reference"]
    calibrate(args.output.resolve() / "calibration" / fixture["id"], grader, starter, reference)
    print(f'{fixture["split"]:8} {fixture["route"]:7} {fixture["id"]}: starter 0, reference 1')
