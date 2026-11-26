"""Prepare a frozen intake comparison and run one blind preference in Harbor."""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from .decisions import policy as decision_policy

HERE = Path(__file__).resolve().parent
HARBOR = HERE.parent
PAIRED_TASKS = {
    "intake-cafe-waitlist": "cafe-waitlist",
    "intake-bookmark-duplicate": "bookmark",
    "intake-bookmark-specified": "bookmark-specified",
    "intake-shift-overlap": "shift",
    "intake-shift-specified": "shift-specified",
}
BUILTIN = ("csv", "parcel", "parcel-specified", "equipment-loans", *PAIRED_TASKS.values())
BUNDLE_PATHS = (
    "plugin",
    "packages/cli/codex-plugin",
    ".claude-plugin/marketplace.json",
    ".agents/plugins/marketplace.json",
)


def document(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def materialize_fixture(snapshot, destination, task):
    if task in BUILTIN:
        shutil.copytree(HERE / "csv", destination)
        if task != "csv":
            prompt_name = (
                task.removesuffix("-specified")
                if task in PAIRED_TASKS.values()
                else task
            )
            shutil.copyfile(
                HERE / "prompts" / f"{prompt_name}.md",
                destination / "instruction.md",
            )
            if task in PAIRED_TASKS.values() and task.endswith("-specified"):
                spec = decision_policy(f"intake-{task}")
                with (destination / "instruction.md").open("a") as prompt:
                    prompt.write("\n" + spec["options"][spec["expected"]] + "\n")
            write_json(
                destination / "environment/package.json",
                {
                    "name": {
                        "bookmark": "bookmarks",
                        "shift": "shift-scheduler",
                        "cafe-waitlist": "cafe-waitlist",
                        "equipment-loans": "equipment-loans",
                    }.get(prompt_name, "parcel-shelf"),
                    "private": True,
                },
            )
    else:
        source = Path(task).resolve(strict=True)
        if not all(
            (source / path).is_file()
            for path in (
                "task.toml",
                "instruction.md",
                "environment/Dockerfile",
                "tests/test.sh",
            )
        ):
            raise ValueError(
                "A custom intake task must have a Harbor fixture, Dockerfile and verifier"
            )
        shutil.copytree(source, destination)
    dockerfile = destination / "environment/Dockerfile"
    text = dockerfile.read_text()
    for host in ("claude", "codex"):
        version = snapshot["versions"][host]
        if not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError(f"Invalid {host} CLI version")
        if snapshot["models"][host] not in snapshot["pricing"]["models"]:
            raise ValueError(f"No frozen price for {host}")
        text = text.replace(
            f"ARG {host.upper()}_VERSION\n", f"ARG {host.upper()}_VERSION={version}\n"
        )
    dockerfile.write_text(text)


def prepare(directory, comparison, revision, task):
    directory.parent.mkdir(parents=True, exist_ok=True)
    if directory.exists():
        raise FileExistsError(f"Choose a new comparison directory: {directory}")
    sha = subprocess.check_output(
        ["git", "rev-parse", "--verify", "--end-of-options", f"{revision}^{{commit}}"],
        cwd=HARBOR,
        text=True,
    ).strip()
    repo = subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"], cwd=HARBOR, text=True
    ).strip()
    with TemporaryDirectory(dir=directory.parent) as temp:
        stage = Path(temp) / "prepared"
        stage.mkdir(mode=0o700)
        shutil.copyfile(comparison, stage / "comparison.json")
        snapshot = document(stage / "comparison.json")
        materialize_fixture(snapshot, stage / "fixture", task)
        bundle = stage / "bundle.tar"
        with bundle.open("wb") as archive:
            subprocess.run(
                ["git", "archive", sha, *BUNDLE_PATHS],
                cwd=repo,
                stdout=archive,
                check=True,
            )
        with bundle.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        write_json(
            stage / "build.json",
            {"verified_commit": sha, "archive_sha256": digest, "fixture": task},
        )
        stage.rename(directory)


def launch(directory, host, policy, budget):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", policy):
        raise ValueError("Use an answer-key case name, without path separators")
    if not math.isfinite(budget) or budget <= 0:
        raise ValueError("Budget must be a positive, finite USD amount")
    snapshot = document(directory / "comparison.json")
    auth = (
        Path(os.environ["SAFEWORD_EVAL_CODEX_REVIEW_AUTH"])
        .expanduser()
        .resolve(strict=True)
    )
    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        raise ValueError("Export CLAUDE_CODE_OAUTH_TOKEN for the local Claude account")
    answer_key = Path(
        os.environ.get("SAFEWORD_EVAL_ANSWER_KEY", HARBOR / "answer-key.json")
    ).resolve(strict=True)
    if policy in PAIRED_TASKS:
        expected_fixture = PAIRED_TASKS[policy]
        if document(directory / "build.json")["fixture"] != expected_fixture:
            raise ValueError(f"{policy} requires the {expected_fixture} fixture")
    if not document(answer_key).get(policy) and not (
        os.getenv("SAFEWORD_EVAL_DECISIONS") == "1" and decision_policy(policy)
    ):
        raise ValueError(f"Missing answer key for {policy}")
    env = dict(
        os.environ,
        INTAKE_RUN=str(directory),
        ASSESS_HOST=host,
        SAFEWORD_EVAL_CODEX_REVIEW_AUTH=str(auth),
        ASSESS_BUDGET=str(budget),
        SAFEWORD_EVAL_TASK=policy,
        SAFEWORD_EVAL_ANSWER_KEY=str(answer_key),
        LANGSMITH_TRACING="false",
        CLAUDE_FORCE_OAUTH="1",
        PYTHONPATH=str(HARBOR),
    )
    for name in (
        "OPENAI_API_KEY",
        "CODEX_API_KEY",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "CLAUDECODE",
        "CLAUDE_CODE_MAX_TURNS",
    ):
        env.pop(name, None)
    lane = directory / "trials" / policy / host
    lane.mkdir(parents=True, exist_ok=False)
    env["ASSESS_RELAY"] = str(lane / "relay")
    fixture = directory / "fixture"
    with (lane / "launch.log").open("w") as log:
        result = subprocess.run(
            [
                "uv",
                "run",
                "--locked",
                "harbor",
                "run",
                "--path",
                str(fixture),
                "--agent",
                "intake.agent:IntakeAgent",
                "--model",
                snapshot["models"][host],
                "--env",
                "docker",
                "-k",
                "1",
                "--jobs-dir",
                str(lane),
                "--job-name",
                "harbor",
            ],
            env=env,
            cwd=HARBOR,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
    if (
        result.returncode
        or list(lane.glob("harbor/*/exception.txt"))
        or len(list(lane.glob("harbor/*/verifier/reward.json"))) != 1
    ):
        raise RuntimeError(
            f"Harbor did not complete this trial; see {lane / 'launch.log'}"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    setup = subs.add_parser("prepare")
    setup.add_argument("directory", type=Path)
    setup.add_argument("--comparison", required=True, type=Path)
    setup.add_argument("--revision", default="HEAD")
    setup.add_argument(
        "--task",
        default="csv",
        help="csv, parcel, parcel-specified, bookmark, bookmark-specified, shift, shift-specified, cafe-waitlist, equipment-loans, or path to a trusted Harbor intake task",
    )
    trial = subs.add_parser("trial")
    trial.add_argument("directory", type=Path)
    trial.add_argument("host", choices=("claude", "codex"))
    trial.add_argument("policy", help="Exact host-side answer-key case")
    trial.add_argument("--budget", type=float, default=3)
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            prepare(args.directory.resolve(), args.comparison, args.revision, args.task)
        else:
            launch(args.directory.resolve(), args.host, args.policy, args.budget)
    except (
        ValueError,
        RuntimeError,
        OSError,
        KeyError,
        subprocess.CalledProcessError,
    ) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
