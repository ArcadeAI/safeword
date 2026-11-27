"""Compare two handbooks on focused decisions using the pinned Harbor image and meters."""

import argparse
import json
import os
import shlex
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
HOSTS = ("claude", "codex")
BUG = """from pathlib import Path

def load_names(path):
    try:
        return Path(path).read_text().splitlines()
    except OSError:
        return []
"""
CASES = {
    "clarify-open": "We are choosing how our bookmarks CLI should handle saving a second URL under an existing label. I care about avoiding silent data loss. What do you recommend?",
    "clarify-supplied": "We decided that saving under an existing bookmark label must fail and preserve the old URL. In one sentence, what will someone see when they try?",
    "bug": "Our names loader returns an empty list when the path is a directory. That hides a real read error. Only a missing file should mean no names. Fix it.",
    "typo": "The welcome message says Welocme. Fix the spelling.",
    "design": "Our public export API takes a bare list of names. Two released clients use it. We need to add a cursor without interrupting either client. Work out your recommendation and record the design. Stop before implementation.",
    "accept": "Continue ticket STALE1. Yes, check whether the plan still holds before proceeding. Give me the verdict first.",
    "decline": "Continue ticket STALE1. Skip checking whether the plan is still current. Just tell me the next recorded step.",
}
TICKET = "---\nid: STALE1\nphase: plan-implementation\nstatus: in_progress\n---\n# Export names\nNext step: document the paging contract for the two existing clients.\nReferenced files: api.py and clients.md.\n"


def git(cwd, *args):
    return subprocess.check_output(["git", "-C", str(cwd), *args])


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)


def verify_work(image, work, out, case):
    if case == "bug":
        verify = """import tempfile, pathlib
from names import load_names
with tempfile.TemporaryDirectory() as d:
    p=pathlib.Path(d); assert load_names(p/'absent')==[]
    (p/'ok').write_text('Ada\\nJan\\n'); assert load_names(p/'ok')==['Ada','Jan']
    try: load_names(p)
    except IsADirectoryError: pass
    else: raise AssertionError('swallowed directory error')
"""
    elif case == "typo":
        verify = "import subprocess; assert subprocess.check_output(['python3','hello.py']) == b'Welcome\\n'"
    else:
        verify = ""
    verified = None
    if verify:
        checked = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                "--read-only",
                "--tmpfs",
                "/tmp",
                "--entrypoint",
                "python3",
                "-v",
                f"{work}:/work:ro",
                "-w",
                "/work",
                image,
                "-B",
                "-c",
                verify,
            ],
            capture_output=True,
            check=False,
        )
        (out / "verification.log").write_bytes(checked.stderr)
        if checked.returncode in (125, 126, 127):
            raise RuntimeError(
                f"Cannot execute hidden verifier. See {out / 'verification.log'}"
            )
        verified = checked.returncode == 0
    return verified


def run(args, arm, revision, host, case):
    lane = args.out / arm / case / host
    work = lane / "work"
    work.mkdir(parents=True)
    for f in (
        "SAFEWORD.md",
        "guides/planning-guide.md",
        "guides/architecture-guide.md",
    ):
        content = git(HERE, "show", f"{revision}:packages/cli/templates/{f}").decode()
        write(work / ".safeword" / f, content)
    (work / ("CLAUDE.md" if host == "claude" else "AGENTS.md")).write_text(
        (work / ".safeword/SAFEWORD.md").read_text()
    )
    if case == "bug":
        write(work / "names.py", BUG)
        write(
            work / "test_names.py",
            "import unittest\nfrom names import load_names\n\nclass NamesTest(unittest.TestCase):\n    def test_missing(self):\n        self.assertEqual(load_names('absent'), [])\n",
        )
    elif case == "typo":
        write(work / "hello.py", 'print("Welocme")\n')
    elif case in ("design", "accept", "decline"):
        write(work / "api.py", "def export(names):\n    return list(names)\n")
        write(
            work / "clients.md",
            "Desktop and CLI both expect a JSON list. Both can select a new endpoint at their next release.\n",
        )
    if case in ("accept", "decline"):
        write(work / ".project/tickets/STALE1-export/ticket.md", TICKET)
    git(work, "init", "-q", "-b", "main")
    for key, value in (
        ("user.name", "Harbor"),
        ("user.email", "fixture@example.invalid"),
        ("commit.gpgsign", "false"),
    ):
        git(work, "config", key, value)
    git(work, "add", ".")
    git(work, "commit", "-qm", "Create fixture")
    if case in ("accept", "decline"):
        write(
            work / "clients.md",
            "The desktop client has retired. The released CLI requires a JSON list and cannot select a different endpoint.\n",
        )
        git(work, "commit", "-qam", "Update supported clients")
    base = git(work, "rev-parse", "HEAD").decode().strip()
    prompt = CASES[case]
    if case in ("accept", "decline"):
        prompt = (
            "Resume check: 1 commit(s) touched files referenced by STALE1 since the last session.\n\n"
            + prompt
        )
    snapshot = json.loads(args.comparison.read_text())
    model = snapshot["models"][host]
    out = lane / "log"
    out.mkdir()
    shutil.copyfile(args.comparison, out / "comparison.json")
    for source in (
        HERE / "trial-spend.cjs",
        HERE / "supervise-claude.mjs",
        HERE / "intake/supervise-codex.mjs",
    ):
        shutil.copyfile(source, out / source.name)
    env = dict(os.environ)
    docker = [
        "docker",
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-w",
        "/work",
        "-v",
        f"{work}:/work",
        "-v",
        f"{out}:/log",
    ]
    if host == "claude":
        docker += ["-e", "CLAUDE_CODE_OAUTH_TOKEN"]
        argv = [
            "claude",
            "-p",
            "--model",
            model,
            "--verbose",
            "--output-format=stream-json",
            "--strict-mcp-config",
            "--permission-mode",
            "acceptEdits",
            "--allowedTools",
            "Read,Write,Edit,Bash,Agent,Glob,Grep",
            "--max-budget-usd",
            "3",
            "--",
            prompt,
        ]
        supervisor = [
            "node",
            "/log/supervise-claude.mjs",
            shlex.join(argv),
            "60",
            "/log/comparison.json",
            "3",
            model,
        ]
        setup = ""
    else:
        docker += ["-v", f"{Path.home()}/.codex/auth.json:/login/auth.json:ro"]
        argv = [
            "codex",
            "-a",
            "never",
            "-c",
            "sandbox_mode=danger-full-access",
            "exec",
            "--trust",
            "-c",
            "web_search=disabled",
            "--model",
            model,
            "--json",
            "--",
            prompt,
        ]
        supervisor = [
            "node",
            "/log/supervise-codex.mjs",
            shlex.join(argv),
            "/log/comparison.json",
            "3",
            "/root/.codex",
        ]
        setup = "mkdir -p /root/.codex; cp /login/auth.json /root/.codex/auth.json; "
    with (
        (out / "trace.jsonl").open("w") as stdout,
        (out / "stderr.log").open("w") as stderr,
    ):
        result = subprocess.run(
            docker + [args.image, "-ec", setup + "exec " + shlex.join(supervisor)],
            env=env,
            check=False,
            stdout=stdout,
            stderr=stderr,
        )
    verified = verify_work(args.image, work, out, case)
    (out / "diff.patch").write_bytes(git(work, "diff", base))
    (out / "files.txt").write_bytes(
        git(work, "ls-files", "--others", "--exclude-standard")
    )
    write(
        out / "result.json",
        json.dumps(
            {
                "revision": revision,
                "host": host,
                "case": case,
                "exit": result.returncode,
                "verified": verified,
                "base": base,
            },
            indent=2,
        ),
    )
    print(arm, case, host, result.returncode, verified, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("base", "candidate", "image"):
        parser.add_argument("--" + flag, required=True)
    for flag in ("comparison", "out"):
        parser.add_argument("--" + flag, type=Path, required=True)
    parser.add_argument("--case", choices=CASES, action="append")
    args = parser.parse_args()
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=False, mode=0o700)
    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        raise SystemExit("Set the local Claude account token first")
    with ThreadPoolExecutor(4) as pool:
        futures = [
            pool.submit(run, args, arm, revision, host, case)
            for case in (args.case or CASES)
            for host in HOSTS
            for arm, revision in (("base", args.base), ("candidate", args.candidate))
        ]
        for future in futures:
            future.result()


if __name__ == "__main__":
    main()
