import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from human_relay import request_action
from intake.decisions import grade, match_question, policy


class PilotTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.case = "intake-bookmark-duplicate"
        self.spec = policy(self.case)
        self.message = "Replace the old link? Are labels case sensitive?"
        self.extra = "Are labels case sensitive?"
        self.match = {
            "kind": "mixed",
            "same_decision": True,
            "quote": "Replace the old link?",
            "unresolved": [self.extra],
        }
        self.enterContext(
            patch.dict(
                os.environ,
                {
                    "SAFEWORD_EVAL_DECISIONS": "1",
                    "SAFEWORD_EVAL_TASK": self.case,
                    "SAFEWORD_EVAL_DECISION_MEMORY": tmp.name + "/memory.db",
                    "SAFEWORD_EVAL_ANSWER_KEY": "",
                },
            )
        )

    async def test_only_unanswered_clause_reaches_operator_once_and_replays(self):
        with patch("intake.decisions.interpret", return_value=(self.match, {})):
            lanes = [self.root / host for host in ("claude", "codex")]
            tasks = [
                asyncio.create_task(request_action(lane, 1, self.message))
                for lane in lanes
            ]
            for _ in range(100):
                if notices := list(self.root.glob("*/01-operator.md")):
                    break
                await asyncio.sleep(0.01)
            self.assertEqual([p.read_text() for p in notices], [self.extra])
            notices[0].with_name("01-response.json").write_text(
                '{"reply":"Case sensitive."}'
            )
            expected = ("reply", self.spec["options"]["reject"] + "\nCase sensitive.")
            self.assertEqual(await asyncio.gather(*tasks), [expected] * 2)
            self.assertEqual(
                await request_action(self.root / "next", 1, self.message), expected
            )
            self.assertEqual(len(list(self.root.glob("*/01-operator.md"))), 1)
            for lane in lanes:
                self.assertEqual(
                    json.loads((lane / "01-response.json").read_text())["reply"],
                    expected[1],
                )
                record = json.loads((lane / "01-routing.json").read_text())["match"]
                self.assertEqual(
                    (record["topic"], record["quote"], record["known_before"]),
                    ("duplicate_label", self.match["quote"], False),
                )

    async def test_live_receipts_score_hidden_then_repeated_question_and_plan_separately(
        self,
    ):
        relay = self.root / "relay"
        question = "Replace the old URL?"
        match = {
            "kind": "decision",
            "same_decision": True,
            "line": 1,
            "quote": question,
            "unresolved": [],
            "reply": "invented",
        }
        with patch("intake.decisions.interpret", return_value=(match, {})):
            for turn in [1, 2]:
                self.assertEqual(
                    await request_action(relay, turn, question),
                    ("reply", self.spec["options"]["reject"]),
                )
        with patch(
            "intake.decisions.interpret",
            return_value=({"choice": "replace", "line": 1}, {}),
        ) as model:
            for _ in range(2):
                result = grade(self.root, "Replace the old URL.", self.spec)
                self.assertEqual(
                    (
                        result["asked"],
                        result["useful_asks"],
                        result["repeat_asks"],
                        result["plan_matches"],
                    ),
                    ("yes", 1, 1, "no"),
                )
            self.assertEqual(model.call_count, 1)
            self.assertNotIn("expected", str(model.call_args))
        # A changed transcript cannot consume an older question receipt.
        (relay / "01-request.md").write_text("May I go ahead?")
        with patch(
            "intake.decisions.interpret",
            return_value=(
                {
                    "kind": "approval",
                    "line": 1,
                    "quote": "May I go ahead?",
                    "unresolved": [],
                },
                {},
            ),
        ) as model:
            grade(self.root, "Replace the old URL.", self.spec)
            self.assertEqual(model.call_count, 2)

    async def test_saved_wording_still_captures_evidence_and_supplied_ask(self):
        case = "intake-bookmark-specified"
        message = "Should an existing label be replaced?"
        path = self.root / "answers.json"
        path.write_text(json.dumps({case: {message: "Keep it."}}))
        with (
            patch.dict(
                os.environ,
                {"SAFEWORD_EVAL_TASK": case, "SAFEWORD_EVAL_ANSWER_KEY": str(path)},
            ),
            patch(
                "intake.decisions.interpret",
                return_value=(
                    {
                        "kind": "decision",
                        "same_decision": True,
                        "line": 1,
                        "quote": message,
                        "unresolved": [],
                    },
                    {},
                ),
            ),
        ):
            self.assertEqual(
                await request_action(self.root / "relay", 1, message),
                ("reply", "Keep it."),
            )
        with patch(
            "intake.decisions.interpret",
            return_value=({"choice": "reject", "line": 1}, {}),
        ):
            result = grade(self.root, "Reject duplicates.", policy(case))
        self.assertEqual(
            (result["needed_to_ask"], result["useful_asks"], result["repeat_asks"]),
            (False, 0, 1),
        )

    def test_ungrounded_or_overlapping_clauses_require_review(self):
        for rest in [["Not in message"], [self.message], []]:
            with patch(
                "intake.decisions.interpret",
                return_value=({**self.match, "unresolved": rest}, {}),
            ):
                record, _ = match_question(self.message, self.spec, [])
                self.assertEqual(record["kind"], "unclear")

    def test_false_topic_match_cannot_release_the_saved_answer(self):
        with patch(
            "intake.decisions.interpret",
            side_effect=[
                ({"kind": "decision", "line": 1, "unresolved": []}, {}),
                ({"same_decision": False, "settled_before": False}, {}),
            ],
        ):
            item, _ = match_question("May I rename a label?", self.spec, [])
        self.assertEqual(item["kind"], "unclear")

    def test_empty_relay_does_not_credit_a_lucky_guess(self):
        with patch(
            "intake.decisions.interpret",
            return_value=({"choice": "reject", "line": 1}, {}),
        ) as model:
            r = grade(self.root, "Reject duplicates.", self.spec)
        self.assertEqual(
            (r["asked"], r["plan_matches"], model.call_count), ("no", "yes", 1)
        )


@unittest.skipUnless(
    os.environ.get("SAFEWORD_EVAL_CALIBRATE") == "1", "opt-in provider calls"
)
class LiveControls(unittest.TestCase):
    def test_held_out_wording(self):
        cases = [
            (
                "intake-bookmark-duplicate",
                "I’m ready to start coding. Shall I?",
                "approval",
                None,
            ),
            (
                "intake-bookmark-duplicate",
                "If docs already points at A and I save docs pointing at B, which URL should lookup return?",
                "decision",
                None,
            ),
            (
                "intake-bookmark-duplicate",
                "When I reuse a label, should the first URL survive? Does the CLI treat Docs and docs alike?",
                "mixed",
                "Does the CLI treat Docs and docs alike?",
            ),
            (
                "intake-bookmark-specified",
                "Should saving under a taken name replace its link?",
                "decision",
                None,
            ),
            (
                "intake-csv-discard",
                "How do you want failures displayed on screen?",
                "other",
                None,
            ),
            (
                "intake-csv-keep",
                "I have finished inspecting the sample input.",
                "handoff",
                None,
            ),
        ]
        for case, message, kind, extra in cases:
            with self.subTest(message=message):
                spec = policy(case)
                item, _ = match_question(message, spec, [])
                self.assertEqual(item["kind"], kind, item)
                self.assertEqual(item["known_before"], spec["supplied"])
                if extra:
                    self.assertIn(extra, item["unresolved"])

    def test_supplied_preference(self):
        with tempfile.TemporaryDirectory() as folder:
            lane = Path(folder)
            (lane / "relay").mkdir()
            (lane / "relay/01-request.md").write_text(
                "May I proceed with implementation?"
            )
            result = grade(
                lane,
                "Reject duplicate labels and preserve the existing URL.",
                policy("intake-bookmark-specified"),
            )
            self.assertEqual(
                (result["asked"], result["plan_matches"]), ("no", "yes"), result
            )
