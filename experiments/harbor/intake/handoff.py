"""Freeze and run the two-host intake handoff comparison."""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from . import decisions
from .run import HARBOR, PAIRED_TASKS, document, prepare, write_json

CASES = {"supplied": "intake-shift-specified", "hidden": "intake-shift-overlap"}
REPETITIONS = {"supplied": 3, "hidden": 1}
HOSTS = ("claude", "codex")
ARMS = ("baseline", "candidate")
BUDGET = 3


def cells():
    for kind, count in REPETITIONS.items():
        for repetition in range(1, count + 1):
            for arm in ARMS:
                for host in HOSTS:
                    yield arm, kind, repetition, host


def sha(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def fixture_hashes(directory):
    return {
        p.relative_to(directory).as_posix(): sha(p)
        for p in sorted(directory.rglob("*"))
        if p.is_file()
    }


def harness_inputs():
    # Pin the code that runs the authors, relay, reviewer meter and graders.
    names = (
        "intake/handoff.py",
        "intake/handoff_report.py",
        "intake/review_rounds.py",
        "intake/agent.py",
        "intake/decisions.py",
        "intake/run.py",
        "intake/score.py",
        "intake/supervise-codex.mjs",
        "intake/stamp_trace.py",
        "intake_cutoff.py",
        "human_relay.py",
        "model_spend.py",
        "report_trials.py",
        "review-meter.cjs",
        "supervise-claude.mjs",
        "trial-spend.cjs",
        "uv.lock",
    )
    return {name: sha(HARBOR / name) for name in names}


def freeze(directory, comparison, refs, holdout=None):
    directory.parent.mkdir(parents=True, exist_ok=True)
    if directory.exists():
        raise ValueError(f"Choose a new comparison directory: {directory}")
    revisions = {
        arm: subprocess.check_output(
            ["git", "rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}"],
            cwd=HARBOR,
            text=True,
        ).strip()
        for arm, ref in refs.items()
    }
    with TemporaryDirectory(dir=directory.parent) as temp:
        stage = Path(temp) / "comparison"
        stage.mkdir(mode=0o700)
        shutil.copyfile(comparison, stage / "comparison.json")
        shutil.copyfile(
            os.environ.get("SAFEWORD_EVAL_ANSWER_KEY", HARBOR / "answer-key.json"),
            stage / "answer-key.json",
        )
        shutil.copyfile(decisions.catalog_path(), stage / "decisions.json")
        inputs = ["comparison.json", "answer-key.json", "decisions.json"]
        if holdout:
            shutil.copyfile(holdout, stage / "holdout-plan.md")
            inputs.append("holdout-plan.md")
        manifest = {
            "protocol": "intake-handoff-v1",
            "revisions": revisions,
            "budget_usd": BUDGET,
            "grader_model": os.environ.get(
                "SAFEWORD_EVAL_DECISION_MODEL", decisions.MODEL
            ),
            "harness": harness_inputs(),
            "inputs": {n: sha(stage / n) for n in inputs},
            "harness_revision": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=HARBOR, text=True
            ).strip(),
            "groups": {},
        }
        for arm, kind, repetition, _host in cells():
            name = f"{arm}-{kind}-{repetition}"
            if name in manifest["groups"]:
                continue
            case = CASES[kind]
            folder = stage / name
            prepare(
                folder, stage / "comparison.json", revisions[arm], PAIRED_TASKS[case]
            )
            manifest["groups"][name] = {
                "case": case,
                "hosts": list(HOSTS),
                "build": document(folder / "build.json"),
                "fixture": fixture_hashes(folder / "fixture"),
            }
        write_json(stage / "protocol.json", manifest)
        stage.rename(directory)


def verify_group(directory, manifest, name):
    group = manifest["groups"][name]
    folder = directory / name
    build = group["build"]
    if (
        document(folder / "build.json") != build
        or sha(folder / "bundle.tar") != build["archive_sha256"]
        or sha(folder / "comparison.json") != manifest["inputs"]["comparison.json"]
        or fixture_hashes(folder / "fixture") != group["fixture"]
    ):
        raise ValueError(f"Prepared trial inputs changed: {name}")


def verify_protocol_inputs(directory, manifest):
    if (
        manifest["protocol"] != "intake-handoff-v1"
        or manifest["harness"] != harness_inputs()
    ):
        raise ValueError(
            f"Use the harness recorded in protocol.json ({manifest['harness_revision']})."
        )
    for name, digest in manifest["inputs"].items():
        if sha(directory / name) != digest:
            raise ValueError(f"Frozen input changed: {name}")


def frozen_environment(directory, manifest):
    verify_protocol_inputs(directory, manifest)
    groups = manifest["groups"]
    expected = {f"{a}-{k}-{n}": (a, CASES[k]) for a, k, n, _ in cells()}
    if set(groups) != set(expected) or manifest["budget_usd"] != BUDGET:
        raise ValueError(
            "Frozen budget or comparison groups differ from this protocol."
        )
    for name, (arm, case) in expected.items():
        group = groups[name]
        if (
            group["case"] != case
            or group["hosts"] != list(HOSTS)
            or group["build"]["verified_commit"] != manifest["revisions"][arm]
            or group["build"]["fixture"] != PAIRED_TASKS[case]
        ):
            raise ValueError(f"Frozen case, hosts or revision changed: {name}")
    env = dict(
        os.environ,
        SAFEWORD_EVAL_DECISIONS="1",
        SAFEWORD_EVAL_DECISION_MODEL=manifest["grader_model"],
        SAFEWORD_EVAL_DECISION_CATALOG=str(directory / "decisions.json"),
        SAFEWORD_EVAL_ANSWER_KEY=str(directory / "answer-key.json"),
        SAFEWORD_EVAL_DECISION_MEMORY=str(directory / "operator-answers.sqlite3"),
    )
    for name in manifest["groups"]:
        verify_group(directory, manifest, name)
    return env


def trial_command(folder, host, case, budget, env):
    print(
        f"Running {folder.name} on {host}. Watch {folder / 'trials' / case / host / 'relay'} for operator questions.",
        flush=True,
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "intake.run",
            "trial",
            str(folder),
            host,
            case,
            "--budget",
            str(budget),
        ],
        cwd=HARBOR,
        env=env,
        check=True,
    )


def run(directory, grade=False):
    manifest = document(directory / "protocol.json")
    env = frozen_environment(directory, manifest)
    incomplete = []
    for name, group in manifest["groups"].items():
        folder = directory / name
        case = group["case"]
        if grade:
            for attempt in [
                folder,
                *sorted((directory / "retries").glob(f"**/{name}")),
            ]:
                expect = ["--expect-case", case] if attempt == folder else []
                result = subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "intake.score",
                        str(attempt),
                        *expect,
                        "--product",
                    ],
                    cwd=HARBOR,
                    env=env,
                    check=False,
                )
                if result.returncode:
                    incomplete.append(str(attempt))
            continue
        for host in group["hosts"]:
            lane = folder / "trials" / case / host
            if lane.exists():
                if len(list(lane.glob("harbor/*/result.json"))) == 1 or any(
                    lane.glob("harbor/*/exception.txt")
                ):
                    continue
                raise ValueError(
                    f"Inspect the existing unfinished trial before resuming: {lane}"
                )
            trial_command(folder, host, case, manifest["budget_usd"], env)
    if incomplete:
        raise ValueError("Inspect incomplete scoring in " + ", ".join(incomplete))


def retry(directory, name, host):
    from .handoff_report import read_attempt

    manifest = document(directory / "protocol.json")
    env = frozen_environment(directory, manifest)
    group = manifest["groups"][name]
    original = directory / name
    lane = f"trials/{group['case']}/{host}"
    attempts = sorted((directory / "retries").glob(f"**/{name}"))
    previous = next((a for a in reversed(attempts) if (a / lane).exists()), original)
    measured = read_attempt(previous, lane)
    if not measured or measured.status not in {"meter interrupted", "runner error"}:
        raise ValueError(
            "Grade the original and retry only a recorded harness or meter interruption."
        )
    root = directory / "retries"
    root.mkdir(exist_ok=True)
    # Reserve a new attempt directory even if another operator starts a retry.
    index = 1 + max(
        (int(p.name) for p in root.iterdir() if p.name.isdigit()), default=0
    )
    target = root / f"{index:04}" / name
    target.parent.mkdir()
    target.mkdir()
    for file in ("build.json", "comparison.json", "bundle.tar"):
        shutil.copyfile(original / file, target / file)
    shutil.copytree(original / "fixture", target / "fixture")
    trial_command(target, host, group["case"], manifest["budget_usd"], env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    setup = subs.add_parser(
        "prepare", help="Freeze the comparison inputs without running an agent"
    )
    setup.add_argument("directory", type=Path)
    setup.add_argument("--comparison", required=True, type=Path)
    setup.add_argument(
        "--holdout",
        type=Path,
        help="Private new-feature request and its observable success criteria",
    )
    for arm in ARMS:
        setup.add_argument(f"--{arm}", required=True)
    for command in ("run", "grade"):
        subs.add_parser(command).add_argument("directory", type=Path)
    repeat = subs.add_parser(
        "retry", help="Replace one measured infrastructure interruption"
    )
    repeat.add_argument("directory", type=Path)
    repeat.add_argument(
        "group", choices=list(dict.fromkeys(f"{a}-{k}-{n}" for a, k, n, _ in cells()))
    )
    repeat.add_argument("host", choices=HOSTS)
    args = parser.parse_args()
    try:
        directory = args.directory.resolve()
        if args.command == "prepare":
            freeze(
                directory,
                args.comparison,
                {arm: getattr(args, arm) for arm in ARMS},
                args.holdout,
            )
        elif args.command == "retry":
            retry(directory, args.group, args.host)
        else:
            run(directory, grade=args.command == "grade")
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
