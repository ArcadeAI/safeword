import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from grade_workflow import primary_trace_events
from report_trials import trial_events


class TraceSourcesTest(unittest.TestCase):
    def test_grader_uses_author_trace_and_report_includes_nested_sessions(self):
        with TemporaryDirectory() as tmp:
            trial = Path(tmp)
            relay = trial / "relay"
            nested = trial / "agent/sessions/projects/task"
            nested.mkdir(parents=True)
            relay.mkdir()
            events = [{"uuid": "one"}, {"value": 2}]
            (relay / "01-claude.jsonl").write_text("\n".join(map(json.dumps, events)))
            (nested / "child.jsonl").write_text('{"uuid":"one"}\n{"value":3}\n{"uuid":"nested"}')
            self.assertEqual([e for e, _ in primary_trace_events(trial, relay)], events)
            self.assertEqual([e for e, _ in trial_events(trial, relay)],
                             events + [{"value": 3}, {"uuid": "nested"}])
