import asyncio
import json
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from human_relay import request_action


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def test_hidden_policy_is_task_scoped_and_unknown_questions_wait(self):
        with TemporaryDirectory() as directory:
            path = Path(directory)
            prompt = "What should happen to earlier rows?"
            key = path / "answers.json"
            key.write_text(json.dumps({"keep": {prompt: "Keep them."}, "discard": {prompt: "Discard them."}}))
            with patch.dict(os.environ, {"SAFEWORD_EVAL_ANSWER_KEY": str(key), "SAFEWORD_EVAL_TASK": "keep"}):
                self.assertEqual(await request_action(path, 1, prompt), ("reply", "Keep them."))
                pending = asyncio.create_task(request_action(path, 2, prompt + "\nOverwrite the destination?"))
                await asyncio.sleep(0)
                self.assertTrue((path / "02-request.md").is_file())
                self.assertFalse((path / "02-response.json").exists())
                (path / "02-response.json").write_text(json.dumps({"reply": "Ask before overwrite."}))
                self.assertEqual(await pending, ("reply", "Ask before overwrite."))
