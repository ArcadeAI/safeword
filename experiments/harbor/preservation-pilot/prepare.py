"""Materialize and calibrate a set of Harbor bug-fix fixtures."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture_grader import calibrate, grade_script

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
for spec in json.loads((root / "fixtures.json").read_text()):
    task = root / "tasks" / spec["id"]
    (task / "environment").mkdir(parents=True, exist_ok=True)
    (task / "tests").mkdir(exist_ok=True)
    (task / "instruction.md").write_text("Fix this bug in `task.mjs`.\n\n" + spec["request"] + "\n")
    (task / "task.toml").write_text(
        'version = "1.0"\n[verifier]\ntimeout_sec = 45\n'
    )
    (task / "environment/Dockerfile").write_text(
        "FROM safeword-harbor-proof-base:1.1.0\nWORKDIR /app\n"
        "RUN unlink public-test.mjs && npm pkg delete scripts.test\nCOPY task.mjs ./\n"
    )
    grader = task / "tests/grade.mjs"
    grader.write_text(grade_script(spec["fix"], spec["preserve"]))
    script = task / "tests/test.sh"
    script.write_text(
        "#!/bin/sh\nset -eu\nmkdir -p /logs/verifier\ncd /app\n"
        "node /tests/grade.mjs /app/task.mjs /logs/verifier/reward.json\n"
        "find . -maxdepth 4 -type f \\( -name '*.mjs' -o -name '*.js' -o -name '*.ts' -o -name '*.feature' \\) "
        "! -path './node_modules/*' ! -path './.git/*' ! -path './.safeword/*' ! -path './.claude/*' "
        "-print0 | tar -czf /logs/verifier/proof.tar.gz --null -T -\n"
    )
    script.chmod(0o755)
    with TemporaryDirectory(prefix="harbor-calibration-") as scratch:
        calibrate(Path(scratch) / spec["id"], grader, spec["before"], spec["fixed"])
    (task / "environment/task.mjs").write_text(spec["before"] + "\n")
    print(spec["id"], "calibrated")
