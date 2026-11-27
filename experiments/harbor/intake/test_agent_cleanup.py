import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from intake.agent import IntakeAgent


class IntakeCleanupTest(unittest.IsolatedAsyncioTestCase):
    async def run_trial(self, author_result, failing_command):
        with TemporaryDirectory() as directory:
            relay = Path(directory)
            agent = SimpleNamespace(
                relay=relay,
                host="claude",
                env={},
                author_command=Mock(return_value="author"),
                logger=Mock(),
            )
            commands = []

            async def checked(env, command):
                commands.append(command)
                if failing_command in command:
                    raise RuntimeError("collection failed")

            agent.checked = checked
            env = AsyncMock()
            env.exec.side_effect = [author_result, SimpleNamespace(return_code=0)]
            try:
                await IntakeAgent.run(agent, "fixture", env, None)
            finally:
                self.commands = commands
                self.logger = agent.logger

    async def test_git_diagnostic_failure_still_collects_required_artifacts(self):
        await self.run_trial(SimpleNamespace(return_code=0), "git diff HEAD")
        self.assertTrue(
            any("workflow-artifacts.tar.gz" in cmd for cmd in self.commands)
        )
        self.logger.warning.assert_called()

    async def test_archive_failure_preserves_primary_error(self):
        with self.assertRaisesRegex(RuntimeError, "original author error") as caught:
            await self.run_trial(
                RuntimeError("original author error"), "workflow-artifacts.tar.gz"
            )
        self.assertTrue(
            any("collection failed" in note for note in caught.exception.__notes__)
        )

    async def test_required_archive_failure_is_visible_after_success(self):
        with self.assertRaisesRegex(RuntimeError, "collection failed"):
            await self.run_trial(
                SimpleNamespace(return_code=0), "workflow-artifacts.tar.gz"
            )
