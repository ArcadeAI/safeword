import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path

from intake.review_rounds import rounds


class ReviewRoundsTest(unittest.TestCase):
    def test_starts_jobs_and_independent_verdicts_have_separate_denominators(self):
        with tempfile.TemporaryDirectory() as folder:
            lane = Path(folder) / "claude"
            agent = lane / "harbor" / "fixture" / "agent"
            agent.mkdir(parents=True)
            (agent.parent / "result.json").write_text("{}")
            with tarfile.open(agent / "workflow-artifacts.tar.gz", "w:gz") as archive:
                for key, reviewer, independence, status, verdict in [
                    (
                        "1",
                        "codex",
                        "cross-agent",
                        "changes_requested",
                        "request_changes",
                    ),
                    ("2", "claude", "reduced", "approved", "approve"),
                    ("3", "codex", "cross-agent", "approved", "approve"),
                ]:
                    data = {
                        "actual_reviewer": reviewer,
                        "author_agent": "claude",
                        "independence": independence,
                        "status": status,
                        "reviewer_output": {
                            "reviewer_agent": reviewer,
                            "verdict": verdict,
                        },
                        "review_routes": [
                            {
                                "reviewer": "codex",
                                "status": "attempted",
                                "failure": "process_failed",
                            }
                        ]
                        if key == "2"
                        else [],
                    }
                    blob = json.dumps(
                        {
                            "id": key,
                            "started_at": key,
                            "state": "completed",
                            "source_fingerprint": "initial"
                            if key == "1"
                            else "revised",
                            "result": {"data": data},
                        }
                    ).encode()
                    info = tarfile.TarInfo(f".safeword/state/reviews/{key}.json")
                    info.size = len(blob)
                    archive.addfile(info, io.BytesIO(blob))
            self.assertIsNone(rounds(lane)["meter"])
            meter = agent / "review-usage.jsonl"
            meter.write_text(
                "\n".join(
                    json.dumps({"provider": "codex", **event})
                    for event in [
                        {"id": "a", "started": True},
                        {"id": "a", "cost_usd": 0.1},
                        {"id": "a", "cost_usd": 0.2},
                        {"id": "b", "started": True},
                        {"id": "c", "started": True},
                        {"id": "c", "cost_usd": 0.1},
                    ]
                )
            )
            report = rounds(lane)
            self.assertEqual(report["archived_review_jobs"], 3)
            self.assertEqual(report["distinct_source_fingerprints"], 2)
            self.assertEqual(report["independent_verdicts"], 2)
            self.assertEqual(
                report["independent_outcomes"], {"changes_requested": 1, "approved": 1}
            )
            self.assertIsNone(report["jobs"][1]["independent_verdict"])
            self.assertEqual(
                report["jobs"][1]["route_failures"][0]["failure"], "process_failed"
            )
            self.assertEqual(report["meter"]["process_starts"], 3)
            self.assertEqual(report["meter"]["start_ids_without_usage_sample"], ["b"])
            self.assertIsNone(report["meter"]["reviewer_cost_usd"])
            self.assertAlmostEqual(report["meter"]["known_reviewer_cost_usd"], 0.3)
