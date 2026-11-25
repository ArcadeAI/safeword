"""Replay an intake comparison from saved Harbor evidence, without model calls."""

import argparse
import json
import re
import tarfile
from collections import Counter
from pathlib import Path

from human_relay import trace_events
from intake_cutoff import verified_plan
from report_trials import json_file, report, urls

from .run import document, write_json


def codex_activity(relay):
    """Codex reports completed items, including shell reads, instead of Claude tool blocks."""
    counts = Counter()
    errors, references, mentions = [], set(), set()
    turns = 0
    for trace in sorted(relay.glob("*-codex.jsonl")):
        for line, event in trace_events(trace):
            location = f"{trace.name}:{line}"
            if event.get("type") == "turn.completed":
                turns += 1
            if event.get("type") in {"turn.failed", "error"}:
                errors.append(
                    {
                        "evidence": location,
                        "error": event.get("error") or event.get("message"),
                    }
                )
            item = event.get("item", {})
            if event.get("type") != "item.completed":
                continue
            kind = item.get("type")
            if kind == "error":
                errors.append({"evidence": location, "error": item.get("message")})
            if kind not in {
                "command_execution",
                "file_change",
                "mcp_tool_call",
                "web_search",
            }:
                continue
            counts[kind] += 1
            if item.get("status") == "failed" or item.get("exit_code") not in (None, 0):
                errors.append(
                    {
                        "evidence": location,
                        "tool": kind,
                        "exit_code": item.get("exit_code"),
                        "status": item.get("status"),
                    }
                )
            arguments = json.dumps(
                [item.get(key) for key in ("command", "changes", "arguments", "query")]
            )
            mentions.update(urls(arguments))
            references.update(
                path
                for path in re.findall(r"(?:[\w.-]+/)*[\w.-]+\.md\b", arguments)
                if "skills/" in path or path.endswith("SAFEWORD.md")
            )
    return {
        "tools": dict(counts),
        "errors": errors,
        "references_mentioned_in_inputs": sorted(references),
        "urls_mentioned_in_inputs": sorted(mentions),
        "completed_turns": turns,
    }


def trial_result(lane, build, models):
    host = lane.name
    results = list(lane.glob("harbor/*/result.json"))
    if len(results) != 1:
        raise ValueError("Expected exactly one finished Harbor trial")
    trial = results[0].parent
    agent = trial / "agent"
    setup = document(agent / "setup-evidence.json")
    if (
        setup.get("status") != "ready"
        or setup.get("bundle_sha256") != build["archive_sha256"]
        or setup.get("host") != host
        or setup.get("expected_model") != models[host]
    ):
        raise ValueError("Setup evidence differs from the frozen comparison")
    if document(results[0]).get("exception_info"):
        raise ValueError(f"Harbor recorded a runner error; see {results[0]}")
    outcome = document(trial / "verifier/intake-outcome.json")["outcome"]
    reward = document(trial / "verifier/reward.json")["reward"]
    boundary = json_file(agent / "intake-stop.json")
    passed = outcome == "passed"
    if reward != int(passed) or (boundary and outcome != boundary.get("outcome")):
        raise ValueError("Verifier and observed intake boundary disagree")
    reviewer = "codex" if host == "claude" else "claude"
    approval = boundary.get("approval") or {}
    if passed and not (
        boundary.get("boundary") == "phase_advance"
        and not boundary.get("additional_edits_at_stop")
        and approval.get("review_id")
        and approval.get("author") == host
        and approval.get("reviewer") == reviewer
        and approval.get("model") == models[reviewer]
    ):
        raise ValueError("Passing grade lacks an independent, pre-code approval")
    evidence = report(trial, lane / "relay")
    if host == "codex":
        evidence["codex_activity"] = codex_activity(lane / "relay")
    evidence["boundary"] = boundary
    write_json(lane / "evidence-index.json", evidence)
    ticket = boundary.get("ticket")
    plan = None
    archive_path = agent / "workflow-artifacts.tar.gz"
    if ticket and archive_path.exists():
        spec = str(Path(ticket).with_name("spec.md"))
        with tarfile.open(archive_path) as archive:
            member = next(
                (item for item in archive if item.name == spec and item.isfile()), None
            )
            if member:
                contents = archive.extractfile(member).read()
                if passed:
                    review_id = approval["review_id"]
                    record = archive.getmember(
                        f".safeword/state/reviews/{review_id}.json"
                    )
                    deadline = min(
                        boundary["at_epoch_ns"],
                        boundary.get("phase_file_mtime_ns", boundary["at_epoch_ns"]),
                    )
                    if not record.isfile() or not verified_plan(
                        json.load(archive.extractfile(record)),
                        review_id,
                        deadline,
                        spec,
                        contents,
                        host,
                        reviewer,
                        models[reviewer],
                    ):
                        raise ValueError(
                            "Archived approval does not match the plan, reviewer, or intake boundary"
                        )
                plan = "final-plan.md"
                (lane / plan).write_bytes(contents)
    if passed and not plan:
        raise ValueError("Passing grade lacks its approved plan")
    return {
        "outcome": outcome,
        "cost_usd": evidence["model_spend"]["total_cost_usd"],
        "review_calls": len(
            {call["id"] for call in evidence["model_spend"]["reviewer"]["calls"]}
        ),
        "evidence": "evidence-index.json",
        "plan": plan,
    }


def score(directory, expected_cases):
    build, models = (
        document(directory / "build.json"),
        document(directory / "comparison.json")["models"],
    )
    lanes = {path for path in directory.glob("trials/*/*") if path.is_dir()}
    for case in expected_cases:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", case):
            raise ValueError("Invalid answer-key case name")
        lanes.update(directory / "trials" / case / host for host in ("claude", "codex"))
    if not lanes:
        raise ValueError("No intake trials found")
    scores = {}
    rows = [
        "# Intake results",
        "",
        "| Trial | Observed outcome | Estimated spend | Review calls |",
        "| --- | --- | ---: | ---: |",
    ]
    for lane in sorted(lanes):
        name = lane.relative_to(directory).as_posix()
        try:
            result = trial_result(lane, build, models)
        except (OSError, ValueError, KeyError, tarfile.TarError) as error:
            result = {"outcome": "incomplete_evidence", "error": str(error)}
        scores[name] = result
        cost = result.get("cost_usd")
        label = (
            f"[{name}]({name}/evidence-index.json)" if result.get("evidence") else name
        )
        rows.append(
            f"| {label} | {result['outcome']} | {f'${cost:.2f}' if cost is not None else 'unknown'} | {result.get('review_calls', 'unknown')} |"
        )
    rows.extend(
        [
            "",
            "Score elicitation and plan correctness separately by comparing each relay transcript and final plan with the hidden product decision. The verifier scores the independent handoff.",
        ]
    )
    write_json(directory / "intake-results.json", scores)
    (directory / "intake-results.md").write_text("\n".join(rows) + "\n")
    return all(result["outcome"] != "incomplete_evidence" for result in scores.values())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument(
        "--expect-case",
        action="append",
        default=[],
        help="Require a lane from both author hosts for this case",
    )
    options = parser.parse_args()
    raise SystemExit(
        0 if score(options.directory.resolve(), options.expect_case) else 1
    )
