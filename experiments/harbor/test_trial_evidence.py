import asyncio
import json
import os
import shlex
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from harbor.agents.installed.claude_code import ClaudeCode
from harbor.models.agent.context import AgentContext
from harbor_langsmith.plugin import LangSmithPlugin

from comparison_agent import ComparisonAgent
from completion_feedback import CompletionFeedback
from report_trials import close_draft, is_draft_command, report


class TrialEvidenceTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.trial = Path(temp.name)
        self.logs = self.trial / "agent"
        self.repo = self.trial / "project"
        self.logs.mkdir()
        self.repo.mkdir()
        self.agent = object.__new__(ComparisonAgent)
        self.agent.environment_logs_dir = self.logs
        self.agent.logs_dir = self.logs
        self.agent.reviewer_auth = None

    def test_only_clean_claude_terminal_result_receives_completion_feedback(self):
        plugin = object.__new__(CompletionFeedback)
        for result, capped, expected in [
            ({"subtype": "success", "is_error": False}, False, 1),
            ({"subtype": "error_max_budget_usd", "is_error": True}, False, 0),
            ({"subtype": "success", "is_error": False}, True, 0),
            ({}, False, 0),
        ]:
            with (
                self.subTest(result=result, capped=capped),
                patch.object(ClaudeCode, "populate_context_post_run"),
                patch.object(LangSmithPlugin, "_create_feedback"),
                patch.object(plugin, "_request") as post,
            ):
                (self.logs / "claude-code.txt").write_text(
                    json.dumps({"type": "result", **result})
                )
                marker = self.logs / "budget-stop.json"
                if capped:
                    marker.write_text('{"reason":"combined_cap"}')
                else:
                    marker.unlink(missing_ok=True)
                context = AgentContext()
                self.agent.populate_context_post_run(context)
                plugin._create_feedback(
                    "123",
                    SimpleNamespace(
                        agent_result=context,
                        exception_info=None,
                        agent_execution=SimpleNamespace(finished_at=True),
                    ),
                )
                self.assertEqual(post.call_args.kwargs["json"]["score"], expected)

    def test_cleanup_requires_a_single_creation_command(self):
        self.assertTrue(is_draft_command('gh pr create --draft --title "sample"'))
        for command in [
            "gh pr create --draft ; echo url",
            "gh pr create --draft && echo url",
            "gh pr create --draft\necho url",
            "gh pr create --draft | cat",
        ]:
            self.assertFalse(is_draft_command(command))

    def test_cleanup_checks_trial_commits_and_draft_state_with_real_git(self):
        def git(*args):
            return subprocess.check_output(
                [
                    "git",
                    "-c",
                    "commit.gpgsign=false",
                    "-c",
                    "user.name=Eval",
                    "-c",
                    "user.email=eval@example.invalid",
                    *args,
                ],
                cwd=self.repo,
                text=True,
            ).strip()

        git("init", "-q")
        git("commit", "--allow-empty", "-qm", "fixture")
        start = git("rev-parse", "HEAD")

        async def local_exec(command, **kwargs):
            # Stand in for Harbor's Docker process boundary.
            run = subprocess.run(
                [
                    "sh",
                    "-c",
                    command.replace("cd /app", "cd " + shlex.quote(str(self.repo))),
                ],
                capture_output=True,
                text=True,
            )
            return SimpleNamespace(return_code=run.returncode, stdout=run.stdout)

        async def make_commit(*args, **kwargs):
            git("commit", "--allow-empty", "-qm", "trial")

        with (
            patch.dict(os.environ, {"SAFEWORD_EVAL_HUMAN_RELAY": "0"}),
            patch.object(ClaudeCode, "run", AsyncMock(side_effect=make_commit)),
        ):
            asyncio.run(
                self.agent.run(
                    "Build it", SimpleNamespace(exec=local_exec), AgentContext()
                )
            )

        commits = report(self.trial, self.logs)["trial_commits"]
        self.assertEqual(commits, [git("rev-parse", "HEAD")])
        url = "https://github.com/example/fixture/pull/123"
        window = ["2026-01-01T00:00:00Z", "2026-01-01T02:00:00Z"]
        info = {"url": url, "state": "OPEN", "createdAt": "2026-01-01T01:00:00Z"}
        for head, draft, should_close in [
            (commits[0], True, True),
            (start, True, False),
            (commits[0], False, False),
        ]:
            with (
                self.subTest(head=head, draft=draft),
                patch("report_trials.shutil.which", return_value="gh"),
                patch(
                    "report_trials.subprocess.run",
                    return_value=SimpleNamespace(
                        stdout=json.dumps(
                            {**info, "headRefOid": head, "isDraft": draft}
                        )
                    ),
                ) as run,
            ):
                status = close_draft(url, commits, window)
                self.assertEqual(status == "closed", should_close)
                self.assertEqual(run.call_count, 2 if should_close else 1)

    def test_report_cli_writes_incomplete_evidence_and_accepts_a_zero_reward(self):
        case = self.trial / "case"
        case.mkdir()
        result = case / "result.json"
        cli = [
            sys.executable,
            str(Path(__file__).with_name("report_trials.py")),
            str(self.trial),
            "--arm",
            "checkout",
        ]
        for outcome, expected, succeeds in [
            ({"verifier_result": {"rewards": {"reward": 0}}}, 1, True),
            ({"verifier_result": {"rewards": {"reward": 1}}}, 2, False),
            (
                {
                    "verifier_result": {"rewards": {"reward": 1}},
                    "exception_info": {"exception_type": "AgentError"},
                },
                1,
                False,
            ),
            ({"verifier_result": None}, 1, False),
        ]:
            with self.subTest(outcome=outcome, expected=expected):
                result.write_text(json.dumps(outcome))
                run = subprocess.run(
                    [*cli, "--expected-trials", str(expected)],
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(run.returncode == 0, succeeds, run.stderr)
                data = json.loads((self.trial / "trial-report.json").read_text())
                self.assertEqual(len(data["trials"]), 1)
                self.assertEqual(len(data["problems"]) == 0, succeeds)

    def test_candidate_patch_includes_new_files_and_preserves_author_staging(self):
        helper = Path(__file__).with_name("candidate-evidence.sh")
        baseline = self.trial / "initial.tree"

        def git(*args):
            return subprocess.check_output(
                [
                    "git",
                    "-c",
                    "commit.gpgsign=false",
                    "-c",
                    "user.name=Eval",
                    "-c",
                    "user.email=eval@example.invalid",
                    *args,
                ],
                cwd=self.repo,
                text=True,
            ).strip()

        git("init", "-q")
        (self.repo / "existing").write_text("starter")
        git("add", "existing")
        git("commit", "-qm", "fixture")
        (self.repo / "lock").write_text("installed by the harness")
        (self.repo / ".gitignore").write_text("ignored\n")
        (self.repo / "ignored").write_text("private-test-marker")
        subprocess.run(["sh", str(helper), str(baseline)], cwd=self.repo, check=True)
        self.assertEqual(git("diff", "--cached", "--name-only"), "")
        (self.repo / "existing").write_text("from commit")
        git("commit", "-qam", "author")
        (self.repo / "staged").write_text("staged")
        git("add", "staged")
        (self.repo / "staged").write_text("working copy changed")
        (self.repo / "new").write_text("untracked work")
        before = git("status", "--porcelain")
        sha = git("rev-parse", "HEAD")
        subprocess.run(
            ["sh", str(helper), str(baseline), str(self.logs)],
            cwd=self.repo,
            check=True,
        )
        self.assertEqual(git("rev-parse", "HEAD"), sha)
        self.assertEqual(git("status", "--porcelain"), before)
        self.assertEqual(git("show", ":staged"), "staged")
        diff = (self.logs / "candidate.patch").read_text()
        for text in ("from commit", "untracked work", "working copy changed"):
            self.assertIn(text, diff)
        for text in (".gitignore", "installed by the harness", "private-test-marker"):
            self.assertNotIn(text, diff)
