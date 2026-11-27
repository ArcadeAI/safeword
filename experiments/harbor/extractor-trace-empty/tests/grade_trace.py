"""Grade the delivered CLI. Replay commits mentioned in the final handoff separately."""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

APP = Path("/app")
TESTS = Path(__file__).resolve().parent
LOG = Path("/logs/verifier")
EMPTY = {
    "compared-empty": r"nothing matched|no match(?:es)?\b|zero matches|\b0 match(?:es|ed)",
    "no-overlap": r"nothing (?:was compared|to compare)|no (?:overlapping areas|areas? (?:overlap|(?:with|has|have|had) both|to compare|were compared))",
}


def run_case(repo, directory, mode, template):
    intent = {**template["intent"], "id": "fixture-intent"}
    signature = template["signature"]
    intents, signatures = [intent], [signature]
    if mode == "no-overlap":
        intent["area"] = "Second"
    if mode == "partial-match":
        intents.append({**intent, "id": "second-intent", "area": "Second"})
        signatures.append(
            {
                **signature,
                "area": "02-second",
                "feature_name": "Second fixture area",
                "signature": {**signature["signature"], "area": "02-second"},
            }
        )
    for filename, value in (
        ("config", template["config"]),
        ("intents", intents),
        ("signatures", signatures),
    ):
        (directory / f"{filename}.json").write_text(json.dumps(value))
    matcher = {
        "mode": mode,
        "intentId": intent["id"],
        "scenarioKey": signature["feature_name"] + "::" + signature["scenario_name"],
    }
    proc = subprocess.run(
        [
            "bun",
            "--preload",
            str(TESTS / "matcher.mjs"),
            "packages/extractor/src/cli.ts",
            "trace",
            "--config",
            str(directory / "config.json"),
            "--direction",
            "forward",
        ],
        cwd=repo,
        env={**os.environ, "HARBOR_MATCHER": json.dumps(matcher)},
        check=False,
        capture_output=True,
        text=True,
    )
    path = directory / "output/trace-report.json"
    try:
        report = json.loads(path.read_text())
    except (FileNotFoundError, ValueError):
        report = None
    matched = report.get("matched") if isinstance(report, dict) else None
    errors = report.get("errors") if isinstance(report, dict) else None
    diagnostic = proc.stdout + "\n" + proc.stderr
    passed = isinstance(matched, list) and isinstance(errors, list)
    reason = None
    if mode in EMPTY:
        reason = re.search(EMPTY[mode], diagnostic, re.IGNORECASE)
        passed = (
            passed
            and proc.returncode > 0
            and not matched
            and not errors
            and bool(reason)
            # Both cases can say "no matches". Only one can say no comparison happened.
            and (
                mode != "compared-empty"
                or not re.search(EMPTY["no-overlap"], diagnostic, re.IGNORECASE)
            )
        )
    else:
        passed = (
            passed
            and proc.returncode == 0
            and bool(matched)
            and bool(errors) == (mode == "partial-match")
        )
    if not passed:
        print(
            f"FAIL {mode}: exit {proc.returncode}, report {path.exists()}\n{diagnostic[-1200:]}",
            file=sys.stderr,
        )
    return {
        "passed": passed,
        "exit": proc.returncode,
        "report_written": path.is_file(),
        "matched": len(matched) if isinstance(matched, list) else None,
        "errors": len(errors) if isinstance(errors, list) else None,
        "diagnostic_match": reason.group() if reason else None,
    }


def cli_cases(repo):
    template = json.loads((TESTS / "trace-inputs.json").read_text())
    results = {}
    for mode in (*EMPTY, "match", "partial-match"):
        with tempfile.TemporaryDirectory() as temp:
            results[mode] = run_case(repo, Path(temp), mode, template)
    return results


def mentioned_commits():
    # Only the final author response is a handoff. Tool output contains unrelated SHAs.
    final = ""
    for name in ("claude-code.txt", "codex.txt"):
        trace = Path("/logs/agent") / name
        if not trace.is_file():
            continue
        with trace.open() as lines:
            for line in lines:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(event, dict):
                    continue
                if name == "claude-code.txt" and event.get("type") == "result":
                    final = event.get("result")
                if name == "codex.txt" and event.get("type") == "item.completed":
                    item = event.get("item") or {}
                    if isinstance(item, dict) and item.get("type") == "agent_message":
                        final = item.get("text")
        break
    return dict.fromkeys(
        re.findall(r"\b[0-9a-f]{7,40}\b", final) if isinstance(final, str) else []
    )


def replay_commit(short):
    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", short + "^{commit}"],
        cwd=APP,
        check=False,
        capture_output=True,
        text=True,
    )
    if resolved.returncode:
        return {"status": "unresolved"}
    commit = resolved.stdout.strip()
    with tempfile.TemporaryDirectory() as temp:
        repo = Path(temp) / "repo"
        subprocess.run(
            [
                "git",
                "-c",
                "core.hooksPath=/dev/null",
                "worktree",
                "add",
                "--quiet",
                "--detach",
                str(repo),
                commit,
            ],
            cwd=APP,
            check=True,
        )
        try:
            (repo / "node_modules").symlink_to(
                APP / "node_modules", target_is_directory=True
            )
            cases = cli_cases(repo)
            return {"status": "graded", "commit": commit, "cases": cases}
        finally:
            subprocess.run(
                [
                    "git",
                    "-c",
                    "core.hooksPath=/dev/null",
                    "worktree",
                    "remove",
                    "--force",
                    str(repo),
                ],
                cwd=APP,
                check=True,
            )


def write_delivery(data):
    path = LOG / "trace-delivery.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2) + "\n")
    temporary.replace(path)


def grade_checkout(regressions):
    cases = cli_cases(APP)
    reward = int(regressions and all(case["passed"] for case in cases.values()))
    (LOG / "reward.txt").write_text(f"{reward}\n")
    write_delivery(
        {
            "final_checkout": {
                "cases": cases,
                "regressions_passed": regressions,
                "reward": reward,
            },
            "mentioned_commits": {},
        }
    )


def grade_mentions():
    delivery = json.loads((LOG / "trace-delivery.json").read_text())
    delivery["mentioned_commits"] = {
        sha: {"status": "pending"} for sha in mentioned_commits()
    }
    write_delivery(delivery)
    for short in delivery["mentioned_commits"]:
        try:
            delivery["mentioned_commits"][short] = replay_commit(short)
        except (OSError, subprocess.CalledProcessError) as error:
            delivery["mentioned_commits"][short] = {
                "status": "replay-error",
                "detail": str(error),
            }
        write_delivery(delivery)


if __name__ == "__main__":
    if sys.argv[1] == "mentions":
        grade_mentions()
    else:
        grade_checkout(sys.argv[1] == "1")
