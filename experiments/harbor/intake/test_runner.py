import json
import os
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from intake.run import launch, materialize_fixture, prepare, write_json
from intake.score import score, trial_result


class IntakeRunnerTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()
        self.snapshot = {
            "models": {"claude": "claude-test", "codex": "codex-test"},
            "versions": {"claude": "1.2.3", "codex": "4.5.6"},
            "pricing": {"models": {"claude-test": {}, "codex-test": {}}},
        }
        self.snapshot_file = self.root / "comparison.json"
        write_json(self.snapshot_file, self.snapshot)

    def test_prepare_pins_native_plugins_and_builds_unhinted_fixture(self):
        import tarfile

        output = self.root / "run"
        prepare(output, self.snapshot_file, "HEAD", "csv")
        with tarfile.open(output / "bundle.tar") as bundle:
            for path in (
                "plugin/skills/bdd/SKILL.md",
                "packages/cli/codex-plugin/skills/bdd/SKILL.md",
            ):
                self.assertTrue(bundle.getmember(path).isfile())
        docker = (output / "fixture/environment/Dockerfile").read_text()
        self.assertIn("ARG CODEX_VERSION=4.5.6", docker)
        self.assertNotIn(
            "intake-csv-keep", (output / "fixture/instruction.md").read_text()
        )
        with self.assertRaises(FileExistsError):
            prepare(output, self.snapshot_file, "HEAD", "csv")

    def test_specified_control_has_the_same_starting_project(self):
        for name in ("parcel", "parcel-specified"):
            materialize_fixture(self.snapshot, self.root / name, name)
        self.assertNotIn(
            "tracking number", (self.root / "parcel/instruction.md").read_text()
        )
        self.assertIn(
            "tracking number",
            (self.root / "parcel-specified/instruction.md").read_text(),
        )
        for relative in (
            "environment/Dockerfile",
            "environment/package.json",
            "tests/test.sh",
        ):
            self.assertEqual(
                (self.root / "parcel" / relative).read_bytes(),
                (self.root / "parcel-specified" / relative).read_bytes(),
            )

    def test_launch_keeps_key_on_host_and_uses_distinct_cases(self):
        key, auth = self.root / "key.json", self.root / "auth.json"
        write_json(
            key, {"keep": {"Question?": "Keep."}, "discard": {"Question?": "Discard."}}
        )
        write_json(auth, {})

        def harbor(command, **kwargs):
            env = kwargs["env"]
            self.assertNotIn("OPENAI_API_KEY", env)
            self.assertIn("intake.agent:IntakeAgent", command)
            self.assertEqual(Path(env["SAFEWORD_EVAL_ANSWER_KEY"]), key)
            lane = Path(env["ASSESS_RELAY"]).parent
            self.assertEqual(lane.parent.name, env["SAFEWORD_EVAL_TASK"])
            rewards = lane / "harbor" / "trial" / "verifier"
            rewards.mkdir(parents=True)
            write_json(rewards / "reward.json", {"reward": 0})
            return subprocess.CompletedProcess(command, 0)

        with (
            patch.dict(
                os.environ,
                {
                    "SAFEWORD_EVAL_CODEX_REVIEW_AUTH": str(auth),
                    "SAFEWORD_EVAL_ANSWER_KEY": str(key),
                    "CLAUDE_CODE_OAUTH_TOKEN": "test",
                    "OPENAI_API_KEY": "test",
                },
            ),
            patch("intake.run.subprocess.run", side_effect=harbor),
        ):
            for case in ("keep", "discard"):
                launch(self.root, "codex", case, 3)
            with self.assertRaises(FileExistsError):
                launch(self.root, "codex", "keep", 3)

    def test_replay_preserves_missing_lanes_and_rejects_self_approval(self):
        write_json(self.root / "build.json", {"archive_sha256": "fixture"})
        lane = self.root / "trials" / "case" / "claude"
        trial = lane / "harbor" / "trial"
        agent, verifier = trial / "agent", trial / "verifier"
        agent.mkdir(parents=True)
        verifier.mkdir()
        write_json(trial / "result.json", {})
        write_json(
            agent / "setup-evidence.json",
            {
                "status": "ready",
                "bundle_sha256": "fixture",
                "host": "claude",
                "expected_model": "claude-test",
            },
        )
        write_json(verifier / "reward.json", {"reward": 1})
        write_json(verifier / "intake-outcome.json", {"outcome": "passed"})
        write_json(
            agent / "intake-stop.json",
            {
                "boundary": "phase_advance",
                "outcome": "passed",
                "approval": {
                    "author": "claude",
                    "reviewer": "claude",
                    "review_id": "r",
                    "model": "claude-test",
                },
            },
        )
        with self.assertRaisesRegex(ValueError, "pre-code approval"):
            trial_result(lane, {"archive_sha256": "fixture"}, self.snapshot["models"])
        self.assertFalse(score(self.root, ["case"]))
        results = json.loads((self.root / "intake-results.json").read_text())
        self.assertEqual(len(results), 2)
        self.assertTrue(
            all(row["outcome"] == "incomplete_evidence" for row in results.values())
        )

        outcome = "phase_without_current_approval"
        write_json(verifier / "reward.json", {"reward": 0})
        write_json(verifier / "intake-outcome.json", {"outcome": outcome})
        write_json(
            agent / "intake-stop.json",
            {"ticket": ".project/tickets/ABC/ticket.md", "outcome": outcome},
        )
        self.assertEqual(
            trial_result(lane, {"archive_sha256": "fixture"}, self.snapshot["models"])[
                "outcome"
            ],
            outcome,
        )

    def test_codex_spend_includes_distinct_sessions_and_deduplicates_resume(self):
        from shutil import copyfile

        scripts = Path(__file__).resolve().parent
        for source in (
            scripts / "supervise-codex.mjs",
            scripts.parent / "trial-spend.cjs",
        ):
            copyfile(source, self.root / source.name)
        sessions = self.root / "home/sessions"
        sessions.mkdir(parents=True)
        snapshot = self.snapshot
        snapshot["pricing"]["models"]["codex-test"] = {
            "input": 1,
            "output": 2,
            "cached": 0,
            "write_short": 0,
            "write_long": 0,
        }
        write_json(self.snapshot_file, snapshot)
        for filename, session, outputs in (
            ("one", "one", 15),
            ("resumed", "one", 20),
            ("two", "two", 30),
        ):
            events = [
                {"type": "session_meta", "payload": {"id": session}},
                {"type": "turn_context", "payload": {"model": "codex-test"}},
                {
                    "type": "event_msg",
                    "payload": {
                        "info": {
                            "total_token_usage": {
                                "input_tokens": 100,
                                "output_tokens": outputs,
                                "total_tokens": 100 + outputs,
                            }
                        }
                    },
                },
            ]
            (sessions / (filename + ".jsonl")).write_text(
                "".join(json.dumps(e) + "\n" for e in events)
            )
        subprocess.run(
            [
                "node",
                str(self.root / "supervise-codex.mjs"),
                "true",
                str(self.snapshot_file),
                "0.00025",
                str(self.root / "home"),
            ],
            check=True,
        )
        spend = json.loads((self.root / "author-spend.json").read_text())
        self.assertAlmostEqual(spend["cost_usd"], 0.0003)
        self.assertEqual(spend["usage"]["total_tokens"], 250)
        self.assertEqual(
            json.loads((self.root / "budget-stop.json").read_text())["reason"],
            "combined_cap",
        )

    def test_live_receipt_and_offline_archive_prove_the_same_review(self):
        import hashlib
        import io
        import tarfile
        from contextlib import chdir

        from intake_cutoff import receipt

        ticket = Path(".project/tickets/ABC-parcel/ticket.md")
        spec = ticket.with_name("spec.md")
        content = b"Record the tracking number."
        reviewer = {
            "status": "approved",
            "review_kind": "quality-review",
            "independence": "cross-agent",
            "author_agent": "claude",
            "actual_reviewer": "codex",
            "confirmed_reviewer_model": {"model": "codex-test"},
            "review_targets": [str(spec)],
        }
        review = {
            "id": "r",
            "state": "completed",
            "updated_at": "1970-01-01T00:00:01Z",
            "result": {"data": reviewer},
            "review_identity": {
                "targets": [
                    {"path": str(spec), "digest": hashlib.sha256(content).hexdigest()}
                ]
            },
        }
        rr = Path(".safeword/state/reviews/r.json")
        lane = self.root / "trials" / "case" / "claude"
        trial = lane / "harbor" / "trial"
        agent = trial / "agent"
        verifier = trial / "verifier"
        agent.mkdir(parents=True)
        verifier.mkdir()
        write_json(trial / "result.json", {})
        write_json(
            agent / "setup-evidence.json",
            {
                "status": "ready",
                "bundle_sha256": "fixture",
                "host": "claude",
                "expected_model": "claude-test",
            },
        )
        write_json(verifier / "reward.json", {"reward": 1})
        write_json(verifier / "intake-outcome.json", {"outcome": "passed"})
        with chdir(self.root):
            spec.parent.mkdir(parents=True)
            spec.write_bytes(content)
            Path(".project/skill-invocations.log").write_text(
                "review:ABC-parcel:phase@intake independence:cross-agent review-id:r\n"
            )
            rr.parent.mkdir(parents=True)
            write_json(rr, review)
            cli = subprocess.CompletedProcess(
                [], 0, stdout=json.dumps({"data": {**reviewer, "review_id": "r"}})
            )
            with patch("intake_cutoff.subprocess.run", return_value=cli):
                proof = receipt(
                    str(ticket),
                    "runtime",
                    "claude",
                    "codex",
                    "codex-test",
                    2_000_000_000,
                )
                self.assertEqual(proof["reviewer"], "codex")
                self.assertIsNone(
                    receipt(
                        str(ticket),
                        "runtime",
                        "claude",
                        "codex",
                        "wrong-model",
                        2_000_000_000,
                    )
                )
        write_json(
            agent / "intake-stop.json",
            {
                "outcome": "passed",
                "boundary": "phase_advance",
                "ticket": str(ticket),
                "at_epoch_ns": 2_000_000_000,
                "approval": proof,
            },
        )
        for name, edits, contents in (
            ("valid", {}, content),
            ("self", {"actual_reviewer": "claude"}, content),
            ("wrong target", {"review_targets": ["other"]}, content),
            ("changed plan", {}, b"different requirements"),
        ):
            with self.subTest(name=name):
                saved = {**review, "result": {"data": {**reviewer, **edits}}}
                with tarfile.open(
                    agent / "workflow-artifacts.tar.gz", "w:gz"
                ) as archive:
                    for path, blob in (
                        (str(spec), contents),
                        (str(rr), json.dumps(saved).encode()),
                    ):
                        entry = tarfile.TarInfo(path)
                        entry.size = len(blob)
                        archive.addfile(entry, io.BytesIO(blob))
                if name == "valid":
                    result = trial_result(
                        lane, {"archive_sha256": "fixture"}, self.snapshot["models"]
                    )
                    self.assertEqual((lane / result["plan"]).read_bytes(), content)
                else:
                    with self.assertRaisesRegex(ValueError, "Archived approval"):
                        trial_result(
                            lane, {"archive_sha256": "fixture"}, self.snapshot["models"]
                        )
