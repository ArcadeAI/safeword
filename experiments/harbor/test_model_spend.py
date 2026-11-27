import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from model_spend import codex_cost, model_spend
from resolve_comparison import latest_codex


class ComparisonModelsTests(unittest.TestCase):
    def test_latest_model_uses_visible_numeric_versions_within_family(self):
        catalog = [
            {"model": "gpt-6.2-sol"},
            {"model": "gpt-6.10-sol"},
            {"model": "gpt-7.1-sol", "hidden": True},
            {"model": "gpt-7.2-luna"},
        ]
        self.assertEqual(latest_codex(catalog, "sol"), "gpt-6.10-sol")
        with self.assertRaises(ValueError):
            latest_codex(catalog, "terra")


class ModelSpendTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "review-usage.jsonl"

    def record(self, *events):
        self.path.write_text("".join(json.dumps(event) + "\n" for event in events))

    def test_codex_reviewer_counts_cache_and_prices_each_retry_once(self):
        event = {"provider": "codex", "requested_model": "gpt-6.1-sol"}
        self.record(
            {**event, "id": "one", "started": True},
            {**event, "id": "one", "thread": "thread", "usage": {"inputTokens": 120, "outputTokens": 10}},
            {**event, "id": "one", "thread": "thread", "usage": {
                "inputTokens": 1000, "outputTokens": 100, "cachedInputTokens": 400,
            }},
            {**event, "id": "two", "usage": {"input_tokens": 100, "output_tokens": 10}},
        )
        report = model_spend({"agent_result": {"cost_usd": 2}}, self.path)
        self.assertEqual(len(report["reviewer"]["calls"]), 2)
        self.assertAlmostEqual(report["reviewer"]["cost_usd"], 0.00254)
        self.assertAlmostEqual(report["total_cost_usd"], 2.00254)

    def test_claude_reviewer_preserves_reported_cost_with_codex_author(self):
        self.record({"id": "review", "provider": "claude", "cost_usd": 0.013, "usage": {"output_tokens": 20}})
        report = model_spend({"agent_info": {"name": "codex"}, "agent_result": {"cost_usd": 0.75}}, self.path)
        self.assertEqual(report["author"]["agent"]["name"], "codex")
        self.assertEqual(report["reviewer"]["calls"][0]["basis"], "Claude CLI")
        self.assertEqual(report["total_cost_usd"], 0.763)

    def test_missing_usage_or_pricing_leaves_combined_cost_unknown(self):
        outcome = {"agent_result": {"cost_usd": 1}}
        self.assertIsNone(model_spend(outcome, self.path)["total_cost_usd"])
        self.record()
        self.assertEqual(model_spend(outcome, self.path)["total_cost_usd"], 1)
        self.record({"id": "review", "provider": "codex", "started": True})
        self.assertIsNone(model_spend(outcome, self.path)["total_cost_usd"])
        self.assertEqual(codex_cost("unknown", {"input_tokens": 100, "output_tokens": 20}), (None, None))
        self.assertEqual(codex_cost("gpt-6.1-sol", {"input_tokens": 300_000, "output_tokens": 20}), (None, None))

    def test_report_prefers_the_cli_total_when_an_early_ledger_never_settled(self):
        self.record({"id": "review", "provider": "codex", "cost_usd": 0.67})
        author = self.path.with_name("author-spend.json")
        author.write_text(json.dumps({"cost_usd": 1.48}))
        outcome = {"agent_result": {"cost_usd": 2.34}}
        self.assertEqual(model_spend(outcome, self.path)["total_cost_usd"], 3.01)
        author.write_text(json.dumps({"cost_usd": 2.32, "settled_delta_usd": 0.8}))
        self.assertEqual(model_spend(outcome, self.path)["total_cost_usd"], 2.99)


if __name__ == "__main__":
    unittest.main()
