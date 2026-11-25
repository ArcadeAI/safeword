"""Stop a Harbor author at the observed boundary of feature intake."""

import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

WORKSPACE = Path("/app")
LOG = Path("/logs/agent")
TICKETS = Path(".project/tickets")
CODE = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs", ".sh"}
PACKAGE_FILES = {
    Path("package.json"),
    Path("package-lock.json"),
    Path("bun.lock"),
    Path("bun.lockb"),
}


def workspace_files():
    selected = set()
    code_dirs = {
        "src",
        "lib",
        "bin",
        "app",
        "test",
        "tests",
        "scripts",
        "features",
        "steps",
    }
    for root, directories, files in os.walk("."):
        directories[:] = [
            name
            for name in directories
            if not name.startswith(".") and name not in {"node_modules", "__pycache__"}
        ]
        for name in files:
            path = Path(root, name)
            if (
                path.parts[0] in code_dirs
                or path.suffix in CODE | {".feature"}
                or path in PACKAGE_FILES
            ):
                selected.add(path)
    selected.update(TICKETS.glob("*/test-definitions.md"))
    selected.update(TICKETS.rglob("*.feature"))
    return {
        str(path): hashlib.sha256(
            os.fsencode(path.readlink()) if path.is_symlink() else path.read_bytes()
        ).hexdigest()
        for path in selected
        if path.is_symlink() or path.is_file()
    }


def phases():
    result = {}
    for ticket in TICKETS.glob("*/ticket.md"):
        header = ticket.read_text().split("---", 2)
        if len(header) != 3:
            continue
        phase = re.search(r"^phase:[ \t]*(\S+)[ \t]*$", header[1], re.MULTILINE)
        kind = re.search(r"^type:[ \t]*feature[ \t]*$", header[1], re.MULTILINE)
        if phase and kind:
            result[str(ticket)] = phase[1]
    return result


def changed_paths(before, current):
    return sorted(
        path
        for path in before.keys() | current.keys()
        if before.get(path) != current.get(path)
    )


def observe_boundary(before, seen, read_phases, read_files):
    phases_before = read_phases()
    changes = changed_paths(before, read_files())
    # Recheck after observing an edit. The phase could have changed while files
    # were being read, so the first phase snapshot alone cannot prove an early write.
    phases_after = read_phases() if changes else phases_before
    seen.update(
        ticket
        for snapshot in (phases_before, phases_after)
        for ticket, phase in snapshot.items()
        if phase == "intake"
    )
    advanced = sorted(
        ticket
        for ticket in seen
        if phases_before.get(ticket) == "define-behavior"
        or phases_after.get(ticket) == "define-behavior"
    )
    if changes and advanced:
        return {
            "boundary": "concurrent_boundary",
            "ticket": advanced[0],
            "changed": changes,
        }
    if changes:
        return {"boundary": "downstream_edit", "changed": changes}
    if advanced:
        return {"boundary": "phase_advance", "ticket": advanced[0]}
    return None


def classify(observed, approval):
    if observed["boundary"] == "concurrent_boundary":
        return "order_unverified"
    if observed["boundary"] == "phase_advance":
        return "passed" if approval else "phase_without_current_approval"
    return "downstream_edit"


def stop_author_pipeline(supervisor_pid):
    rows = [
        tuple(map(int, line.split()))
        for line in subprocess.check_output(
            ["ps", "-eo", "pid=,ppid=,pgid="], text=True
        ).splitlines()
    ]
    descendants = {supervisor_pid}
    while True:
        extended = descendants | {
            pid for pid, parent, _ in rows if parent in descendants
        }
        if extended == descendants:
            break
        descendants = extended
    groups = {
        group
        for pid, _, group in rows
        if pid in descendants and group != supervisor_pid
    }
    for group in groups:
        try:
            os.killpg(group, signal.SIGTERM)
        except ProcessLookupError:
            pass


def receipt(ticket, runtime, author, reviewer, model):
    log = Path(".project/skill-invocations.log")
    scope = f"review:{Path(ticket).parent.name}:phase@intake"
    if not log.exists():
        return None
    for line in reversed(log.read_text().splitlines()):
        fields = line.split()
        if scope not in fields or "independence:cross-agent" not in fields:
            continue
        review_id = next(
            (
                value.removeprefix("review-id:")
                for value in fields
                if value.startswith("review-id:")
            ),
            None,
        )
        if review_id is None:
            continue
        run = subprocess.run(
            ["bun", runtime, "--json", "review", "status", review_id],
            capture_output=True,
            text=True,
            check=False,
        )
        try:
            data = json.loads(run.stdout).get("data") or {}
        except ValueError:
            continue
        if (
            data.get("status") == "approved"
            and data.get("review_id") == review_id
            and data.get("review_kind") == "quality-review"
            and data.get("independence") == "cross-agent"
            and data.get("author_agent") == author
            and data.get("actual_reviewer") == reviewer
            and (data.get("confirmed_reviewer_model") or {}).get("model") == model
            and data.get("review_targets") == [str(Path(ticket).with_name("spec.md"))]
        ):
            return {
                "review_id": review_id,
                "model": model,
                "author": author,
                "reviewer": reviewer,
                "stamp": line,
            }
    return None


def main():
    runtime, author, reviewer, model, *command = sys.argv[1:]
    os.chdir(WORKSPACE)
    before = workspace_files()
    seen = {ticket for ticket, phase in phases().items() if phase == "intake"}
    process = subprocess.Popen(command, start_new_session=True)
    observed = None
    while True:
        try:
            observed = observe_boundary(before, seen, phases, workspace_files)
        except FileNotFoundError:
            # An atomic replacement can remove a path between the scan and read.
            time.sleep(0.05)
            continue
        if observed:
            observed["at_epoch_ns"] = time.time_ns()
            stop_author_pipeline(process.pid)
            break
        if process.poll() is not None:
            break
        time.sleep(0.05)
    code = process.wait()
    if not observed:
        return code
    approval = None
    if "ticket" in observed:
        approval = receipt(observed["ticket"], runtime, author, reviewer, model)
    observed["approval"] = approval
    observed["additional_edits_at_stop"] = changed_paths(before, workspace_files())
    if observed["boundary"] == "phase_advance" and observed["additional_edits_at_stop"]:
        observed["boundary"] = "concurrent_boundary"
    observed["outcome"] = classify(observed, approval)
    observed["passed"] = observed["outcome"] == "passed"
    observed["observed_intake_tickets"] = sorted(seen)
    (LOG / "intake-stop.json").write_text(json.dumps(observed, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
