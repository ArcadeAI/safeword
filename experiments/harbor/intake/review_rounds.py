"""Explain one intake lane's reviewer process starts and archived verdicts offline."""

import argparse
import json
import tarfile
from collections import Counter
from pathlib import Path, PurePosixPath

from human_relay import trace_events
from model_spend import METER_LOG, reviewer_spend


def meter_counts(path):
    if not path.is_file():
        return None
    started, sampled = set(), set()
    for _, event in trace_events(path):
        if event.get("provider") in {"claude", "codex"} and event.get("id"):
            (started if event.get("started") else sampled).add(event["id"])
    spend = reviewer_spend(path)
    return {
        "process_starts": len(started),
        "start_ids_without_usage_sample": sorted(started - sampled),
        "usage_ids_without_start": sorted(sampled - started),
        "reviewer_cost_usd": spend["cost_usd"],
        "known_reviewer_cost_usd": sum(c["cost_usd"] or 0 for c in spend["calls"]),
    }


def archived_reviews(archive):
    seen = set()
    for member in archive:
        path = PurePosixPath(member.name)
        if (
            not member.isfile()
            or path.parent != PurePosixPath(".safeword/state/reviews")
            or path.suffix != ".json"
        ):
            continue
        receipt = json.load(archive.extractfile(member))
        if receipt["id"] != path.stem:
            raise ValueError(f"Review ID differs from receipt name: {member.name}")
        if path.stem in seen:
            raise ValueError("Duplicate review ID in archive")
        seen.add(path.stem)
        yield receipt


def rounds(lane):
    results = list(lane.glob("harbor/*/result.json"))
    if len(results) != 1:
        raise ValueError("Expected one finished Harbor trial in the supplied lane")
    agent = results[0].parent / "agent"
    jobs = []
    with tarfile.open(agent / "workflow-artifacts.tar.gz") as archive:
        for receipt in archived_reviews(archive):
            data = (receipt.get("result") or {}).get("data") or {}
            reviewer = data.get("actual_reviewer")
            status = data.get("status")
            output = data.get("reviewer_output") or {}
            independent = (
                receipt["state"] == "completed"
                and data.get("independence") == "cross-agent"
                and data.get("author_agent") == lane.name
                and reviewer
                and reviewer != lane.name
                and output.get("reviewer_agent") == reviewer
                and (status, output.get("verdict"))
                in {("approved", "approve"), ("changes_requested", "request_changes")}
            )
            jobs.append(
                {
                    "id": receipt["id"],
                    "started_at": receipt["started_at"],
                    "fingerprint": receipt.get("source_fingerprint"),
                    "state": receipt["state"],
                    "status": status,
                    "reviewer": reviewer,
                    "independence": data.get("independence"),
                    "independent_verdict": status if independent else None,
                    "summary": output.get("summary"),
                    "route_failures": [
                        route
                        for route in data.get("review_routes", [])
                        if route.get("failure")
                    ],
                }
            )
    verdicts = Counter(
        job["independent_verdict"] for job in jobs if job["independent_verdict"]
    )
    return {
        "meter": meter_counts(agent / METER_LOG),
        "archived_review_jobs": len(jobs),
        "distinct_source_fingerprints": len(
            {j["fingerprint"] for j in jobs if j["fingerprint"]}
        ),
        "independent_verdicts": sum(verdicts.values()),
        "independent_outcomes": dict(verdicts),
        "jobs": sorted(jobs, key=lambda job: (job["started_at"], job["id"])),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lane", type=Path)
    try:
        print(json.dumps(rounds(parser.parse_args().lane.resolve()), indent=2))
    except (OSError, ValueError, KeyError, tarfile.TarError) as error:
        parser.exit(1, f"{error}\n")
