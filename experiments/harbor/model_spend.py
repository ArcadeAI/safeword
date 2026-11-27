"""Report API-equivalent spend for the author and the reviewer processes."""

import json
import re
from decimal import Decimal
from functools import cache
from importlib.metadata import PackageNotFoundError, distribution

from human_relay import trace_events

METER_LOG = "review-usage.jsonl"


@cache
def bundled_prices():
    try:
        package = distribution("litellm")
        prices = package.locate_file("litellm/model_prices_and_context_window_backup.json")
        return json.loads(prices.read_text(), parse_float=Decimal), f"litellm {package.version} bundled prices"
    except (PackageNotFoundError, FileNotFoundError):
        return {}, None


def codex_cost(model, usage):
    prices, source = bundled_prices()
    rates = prices.get(model) or prices.get(f"openai/{model}")
    counts = [usage.get(name, usage.get(alias, 0)) for name, alias in (
        ("input_tokens", "inputTokens"), ("output_tokens", "outputTokens"),
        ("cached_input_tokens", "cachedInputTokens"),
        ("cache_write_input_tokens", "cacheWriteInputTokens"),
    )]
    if not rates or any(type(count) is not int or count < 0 for count in counts):
        return None, None
    inputs, outputs, reads, writes = counts
    if not any(key in usage for key in ("input_tokens", "inputTokens")) or not any(
        key in usage for key in ("output_tokens", "outputTokens")
    ) or reads + writes > inputs:
        return None, None
    # Codex totals may cover several requests. Once they cross a rate boundary,
    # an aggregate alone can't establish how many requests used the higher rate.
    for key in rates:
        limit = re.fullmatch(r"input_cost_per_token_above_(\d+)(k?)_tokens", key)
        if limit and inputs > int(limit[1]) * (1000 if limit[2] else 1):
            return None, None
    unit_counts = {
        "input_cost_per_token": inputs - reads - writes, "output_cost_per_token": outputs,
        "cache_read_input_token_cost": reads, "cache_creation_input_token_cost": writes,
    }
    if any(count and key not in rates for key, count in unit_counts.items()):
        return None, None
    cost = sum(count * rates.get(key, 0) for key, count in unit_counts.items())
    return float(cost), source


def reviewer_spend(path):
    # A process may emit multiple cumulative updates for the same thread.
    # Keep the latest point for each thread and include every distinct retry.
    executions = {}
    for _, event in trace_events(path):
        if not event.get("id") or event.get("provider") not in {"claude", "codex"}:
            continue
        execution = executions.setdefault(event["id"], {"start": event, "samples": {}})
        if not event.get("started"):
            execution["samples"][event.get("thread")] = event

    calls = []
    for execution in executions.values():
        start = execution["start"]
        for event in list(execution["samples"].values()) or [start]:
            reported_models = list(event.get("model_usage") or {})
            reported = event.get("model") or (reported_models[0] if len(reported_models) == 1 else None)
            requested = event.get("requested_model")
            model = reported or requested
            usage = event.get("usage") or {}
            cost = event.get("cost_usd")
            basis = event.get("basis") or (f"{start['provider'].title()} CLI" if cost is not None else None)
            if event.get("unpriced"):
                cost, basis = None, None
            elif start["provider"] == "codex" and cost is None:
                cost, basis = codex_cost(model, usage)
            calls.append({
                "id": event["id"], "thread": event.get("thread"), "provider": start["provider"],
                "model": model, "model_usage": event.get("model_usage"), "usage": usage,
                "cost_usd": cost, "basis": basis,
                "model_basis": event.get("model_basis") or (
                    "CLI-reported" if reported else "CLI-requested" if requested else None
                ),
            })
    complete = path.is_file() and all(call["cost_usd"] is not None for call in calls)
    cost = float(sum(Decimal(str(call["cost_usd"])) for call in calls)) if complete else None
    return {"cost_usd": cost, "metered": path.is_file(), "calls": calls}


def model_spend(outcome, path):
    author = outcome.get("agent_result") or {}
    reviewer = reviewer_spend(path)
    def artifact(filename):
        file = path.with_name(filename)
        return json.loads(file.read_text()) if file.is_file() else None

    live_author = artifact("author-spend.json")
    comparison = artifact("comparison.json")
    cli_cost = author.get("cost_usd")
    author_cost, basis = cli_cost, "CLI estimate" if cli_cost is not None else None
    if live_author and (cli_cost is None or "settled_delta_usd" in live_author):
        author_cost = live_author["cost_usd"]
        basis = f"provider rates {comparison['pricing']['verified_on']}" if comparison else None
    reviewer_cost = reviewer["cost_usd"]
    total = None
    if author_cost is not None and reviewer_cost is not None:
        total = float(Decimal(str(author_cost)) + Decimal(str(reviewer_cost)))
    return {
        "author": {
            "agent": outcome.get("agent_info"), "cost_usd": author_cost,
            "cli_cost_usd": cli_cost, "basis": basis,
            "model_usage": author.get("model_usage"),
            "input_tokens": author.get("n_input_tokens"), "output_tokens": author.get("n_output_tokens"),
        },
        "reviewer": reviewer, "total_cost_usd": total,
        "comparison": comparison, "budget_stop": artifact("budget-stop.json"),
        "safeword_runtime": artifact("safeword-runtime.json"),
    }
