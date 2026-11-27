"""Summarize Harbor traces and close drafts with an observed creation receipt."""

import argparse
import json
import math
import re
import shlex
import shutil
import subprocess
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from human_relay import unique_trace_events
from model_spend import METER_LOG, model_spend

URL = re.compile(r"https?://[^\s<>\"'`\\)\]]+")
DRAFT = re.compile(r"https://github\.com/[\w.-]+/[\w.-]+/pull/[1-9][0-9]*")
ERROR = re.compile(
    r"^.*(?:exit code [1-9]\d*|missing script|script not found|"
    r"did not match any test files|0 test files matching|"
    r"assertionerror|(?:^|\s)error:|test failure\(s\)|traceback "
    r"\(most recent call last\)|timed out|permission denied).*$",
    re.IGNORECASE | re.MULTILINE,
)
REFERENCE_TOOLS = {"Read", "ReadFile", "read_file"}
FETCH_TOOLS = {"WebFetch", "web_fetch", "mcp__playwright__browser_navigate"}
SHELL_FETCH = re.compile(r"(?:^|[;&|]\s*)(?:curl|wget)\s")


def json_file(path):
    return json.loads(path.read_text()) if path.is_file() else {}


def content_text(content):
    if isinstance(content, str):
        return content
    return "\n".join(
        item.get("text", "") for item in content or [] if isinstance(item, dict)
    )


def urls(text):
    for url in URL.findall(text):
        try:
            parts = urlsplit(url.rstrip(".,;"))
        except ValueError:
            continue
        if parts.hostname:
            # Query strings, fragments, and user info can carry credentials.
            yield f"{parts.scheme}://{parts.hostname}{parts.path}"


def is_draft_command(command):
    # Cleanup requires the output of one gh invocation. Command lists and
    # substitutions can print a different PR's URL after the creation call.
    if any(ch in command for ch in "\n\r;&|`$<>()"):
        return False
    try:
        args = shlex.split(command)
    except ValueError:
        return False
    return args[:3] == ["gh", "pr", "create"] and any(
        arg in {"--draft", "-d"} for arg in args[3:]
    )


def trace_paths(trial, relay):
    agent = trial / "agent"
    return [
        *sorted(relay.glob("*-claude.jsonl")),
        agent / "claude-code.txt",
        *sorted((agent / "sessions" / "projects").rglob("*.jsonl")),
    ]


def trial_events(trial, relay):
    yield from unique_trace_events(trace_paths(trial, relay))


def report(trial, relay):
    tools = Counter()
    hooks = Counter()
    calls = {}
    results = set()
    skills, files, requested_urls, mentioned_urls, drafts = (set() for _ in range(5))
    tool_errors = []
    questions = []
    stops = []
    for event, evidence in trial_events(trial, relay):
        if event.get("subtype") == "hook_response":
            hooks[(event.get("hook_name"), event.get("outcome"))] += 1
        if event.get("type") == "result":
            stops.append(
                {
                    "subtype": event.get("subtype"),
                    "stop_reason": event.get("stop_reason"),
                    "is_error": event.get("is_error"),
                    "evidence": evidence,
                }
            )
        message = event.get("message")
        blocks = message.get("content", []) if isinstance(message, dict) else []
        for item in blocks if isinstance(blocks, list) else []:
            if not isinstance(item, dict):
                continue
            kind = item.get("type")
            if kind == "tool_use" and item.get("id") not in calls:
                name, args = item["name"], item.get("input", {})
                tools[name] += 1
                calls[item["id"]] = (name, args)
                if name == "AskUserQuestion":
                    questions.append(
                        {"questions": args.get("questions"), "evidence": evidence}
                    )
                mentioned_urls.update(urls(json.dumps(args)))
            if kind != "tool_result" or (call_id := item.get("tool_use_id")) in results:
                continue
            if call_id not in calls:
                continue
            results.add(call_id)
            name, args = calls[call_id]
            output = content_text(item.get("content"))
            if not item.get("is_error"):
                if name == "Skill" and args.get("skill"):
                    skills.add(args["skill"])
                if name in REFERENCE_TOOLS and args.get("file_path"):
                    files.add(args["file_path"])
            mentioned_urls.update(urls(output))
            if name in FETCH_TOOLS:
                requested_urls.update(urls(args.get("url", "")))
            if name == "Bash" and SHELL_FETCH.search(args.get("command", "")):
                requested_urls.update(urls(args["command"]))
            error = ERROR.search(output) if name == "Bash" else None
            if item.get("is_error") or error:
                tool_errors.append(
                    {
                        "tool": name,
                        "detail": (
                            error.group()
                            if error
                            else output.splitlines()[0]
                            if output
                            else "Tool reported an error"
                        )[:450],
                        "evidence": evidence,
                    }
                )
            if (
                name == "Bash"
                and not item.get("is_error")
                and is_draft_command(args.get("command", ""))
            ):
                lines = [part.strip() for part in output.splitlines() if part.strip()]
                if len(lines) == 1 and DRAFT.fullmatch(lines[0]):
                    drafts.add(lines[0])

    for path in sorted(relay.glob("*-request.md")):
        response = path.with_name(path.name.replace("-request.md", "-response.json"))
        questions.append(
            {
                "checkpoint": path.name[:2],
                "message": path.read_text(),
                "decision": json_file(response),
            }
        )
    phase_log = trial / "agent" / "ticket-phases.txt"
    snapshots = phase_log.read_text().splitlines() if phase_log.is_file() else []
    phases = {}
    for line in snapshots:
        ticket, marker, phase = line.partition(":phase:")
        if marker:
            history = phases.setdefault(ticket, [])
            if not history or history[-1] != phase.strip():
                history.append(phase.strip())
    outcome = json_file(trial / "result.json")
    return {
        "trial": trial.name,
        "model_spend": model_spend(outcome, trial / "agent" / METER_LOG),
        "verdict": outcome.get("verifier_result"),
        "runner_error": outcome.get("exception_info"),
        "agent_stops": stops,
        "trial_window": [outcome.get("started_at"), outcome.get("finished_at")],
        "tools": dict(tools),
        "skills": sorted(skills),
        "files_read": sorted(files),
        "hook_responses": [
            {"hook": name, "outcome": status, "count": count}
            for (name, status), count in hooks.items()
        ],
        "safeword_phase_snapshots": [
            line for line in snapshots if not line.startswith("commit: ")
        ],
        "safeword_phases_by_ticket": phases,
        "trial_commits": sorted(
            {
                line.removeprefix("commit: ")
                for line in snapshots
                if line.startswith("commit: ")
            }
        ),
        "url_requests_visible_in_trace": sorted(requested_urls),
        "urls_seen_in_tool_calls_or_output": sorted(mentioned_urls),
        "tool_errors": tool_errors,
        "human_checkpoints": questions,
        "draft_prs": sorted(drafts),
    }


def close_draft(url, commits, trial_window):
    gh = shutil.which("gh")
    if not gh or not commits or not all(trial_window) or not DRAFT.fullmatch(url):
        return "skipped: missing GitHub client or trial commit evidence"
    try:
        view = subprocess.run(  # noqa: S603 — fixed argv and validated GitHub PR URL
            [gh, "pr", "view", url, "--json", "url,isDraft,state,headRefOid,createdAt"],
            capture_output=True,
            text=True,
            check=True,
            timeout=20,
        )
        info = json.loads(view.stdout)
        start, end = (datetime.fromisoformat(value) for value in trial_window)
        created = datetime.fromisoformat(info["createdAt"])
        if (
            info["url"] != url
            or not info["isDraft"]
            or info["state"] != "OPEN"
            or info["headRefOid"] not in commits
            or not start.replace(microsecond=0) <= created <= end
        ):
            return "skipped: no matching open draft from this trial"
        subprocess.run(  # noqa: S603 — validated draft with matching trial commit
            [gh, "pr", "close", url], capture_output=True, check=True, timeout=20
        )
        return "closed"
    except (OSError, subprocess.SubprocessError, ValueError):
        return "failed: could not verify or close the draft"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("--relay", type=Path)
    parser.add_argument("--arm", required=True)
    parser.add_argument("--expected-trials", type=int)
    parser.add_argument("--close-drafts", action="store_true")
    args = parser.parse_args()
    if args.expected_trials is not None and args.expected_trials < 1:
        parser.error("--expected-trials must be positive")
    problems = []
    trials = []
    for trial in sorted(path.parent for path in args.job.glob("*/result.json")):
        relay = args.relay / args.arm / trial.name if args.relay else trial / "agent"
        item = report(trial, relay)
        item["draft_cleanup"] = (
            {
                url: close_draft(url, item["trial_commits"], item["trial_window"])
                for url in item["draft_prs"]
            }
            if args.close_drafts
            else {}
        )
        trials.append(item)
        if item["runner_error"] is not None:
            problems.append(f"{trial.name}: Harbor runner error")
        rewards = (item["verdict"] or {}).get("rewards") or {}
        reward = rewards.get("reward")
        if type(reward) not in (int, float) or not math.isfinite(reward):
            problems.append(f"{trial.name}: missing finite verifier reward")
    if not trials or (args.expected_trials is not None and len(trials) != args.expected_trials):
        problems.append(f"Expected {args.expected_trials or 'at least one'} trial(s), found {len(trials)}")
    (args.job / "trial-report.json").write_text(
        json.dumps(
            {
                "arm": args.arm,
                "problems": problems,
                "trials": trials,
                "coverage": "Trace evidence only. URLs contacted by child processes may be absent.",
            },
            indent=2,
        )
        + "\n"
    )
    if problems:
        raise SystemExit("\n".join(problems))


if __name__ == "__main__":
    main()
