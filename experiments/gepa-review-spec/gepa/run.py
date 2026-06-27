"""
Phase 4 — GEPA optimization of the review-spec skill against the TS eval harness.

GEPA (Python) drives the loop; our TS `gepa-eval.ts` is the metric (it owns the
model call and the scorer, the single source of truth). The reflection LM is a
stdlib Anthropic call — no litellm dependency, keeping the spike isolated.

Objective (set in gepa-eval.ts): hard recall floor (a missed must-fix scores 0)
with false-alarm reduction as the gradient above it. GEPA optimizes ONLY the
train split; the held-out test split is never passed in (validated separately in
Phase 5).

Run (spends tokens — wrap in `op run` so both the reflector and the TS task calls
get ANTHROPIC_API_KEY):

    op run --env-file=... -- ./gepa/.venv/bin/python gepa/run.py --max-metric-calls 250
"""
# Research script (not library code): prints are the CLI output, and the
# subprocess/urlopen calls take only harness-controlled inputs.
# ruff: noqa: T201, S603, S310, PERF203, PLW1510

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import gepa

HERE = Path(__file__).resolve().parent
EXPERIMENT_DIR = HERE.parent
SKILL_PATH = EXPERIMENT_DIR.parent.parent / ".claude" / "skills" / "review-spec" / "SKILL.md"
EVAL_SCRIPT = EXPERIMENT_DIR / "gepa-eval.ts"
BUN = os.environ.get("BUN_BIN", "bun")
TASK_MODEL = os.environ.get("SAFEWORD_EVAL_MODEL", "claude-sonnet-4-6")
REFLECTION_MODEL = os.environ.get("SAFEWORD_REFLECTION_MODEL", "claude-sonnet-4-6")


def anthropic_complete(prompt) -> str:
    """Reflection LM: a minimal Anthropic Messages call (stdlib only)."""
    key = os.environ["ANTHROPIC_API_KEY"]
    messages = [{"role": "user", "content": prompt}] if isinstance(prompt, str) else prompt
    body = json.dumps(
        {"model": REFLECTION_MODEL, "max_tokens": 8192, "messages": messages}
    ).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
            return "".join(b.get("text", "") for b in data["content"])
        except Exception as exc:
            if attempt == 3:
                raise
            print(f"  [reflection retry {attempt + 1}: {exc}]", file=sys.stderr)
    return ""


class ReviewSpecAdapter(gepa.GEPAAdapter):
    """Shell out to the TS metric for a batch of fixtures under one candidate prompt."""

    def evaluate(self, batch, candidate, capture_traces=False):
        prompt_file = HERE / ".candidate.txt"
        prompt_file.write_text(candidate["system_prompt"], encoding="utf8")
        proc = subprocess.run(
            [
                BUN,
                str(EVAL_SCRIPT),
                "--candidate",
                str(prompt_file),
                "--fixtures",
                ",".join(batch),
            ],
            cwd=str(EXPERIMENT_DIR),
            capture_output=True,
            text=True,
            env={**os.environ, "SAFEWORD_EVAL_MODEL": TASK_MODEL},
        )
        if proc.returncode != 0:
            raise RuntimeError(f"gepa-eval.ts failed: {proc.stderr[-2000:]}")
        by_name = {r["name"]: r for r in json.loads(proc.stdout)}
        results = [by_name[name] for name in batch]
        scores = [float(r["score"]) for r in results]
        trajectories = results if capture_traces else None
        return gepa.EvaluationBatch(outputs=results, scores=scores, trajectories=trajectories)

    def make_reflective_dataset(self, candidate, eval_batch, components_to_update):
        records = [
            {
                "Feature reviewed": r["name"],
                "Score (higher is better)": r["score"],
                "What you got right / wrong": r["feedback"],
            }
            for r in (eval_batch.trajectories or [])
        ]
        return dict.fromkeys(components_to_update, records)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-metric-calls", type=int, default=250)
    parser.add_argument("--minibatch", type=int, default=3)
    parser.add_argument("--run-dir", default=str(HERE / "runs" / "latest"))
    args = parser.parse_args()

    sys.path.insert(0, str(EXPERIMENT_DIR))
    # Train fixture NAMES are GEPA's data instances; the held-out split is excluded.
    train_names = json.loads(
        subprocess.run(
            [BUN, "-e", _LIST_TRAIN_JS],
            cwd=str(EXPERIMENT_DIR),
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )
    print(f"GEPA train fixtures ({len(train_names)}): {', '.join(train_names)}")

    seed = SKILL_PATH.read_text(encoding="utf8")
    Path(args.run_dir).mkdir(parents=True, exist_ok=True)

    result = gepa.optimize(
        seed_candidate={"system_prompt": seed},
        trainset=train_names,
        valset=train_names,  # NOT the held-out split — that is Phase 5 only
        adapter=ReviewSpecAdapter(),
        reflection_lm=anthropic_complete,
        max_metric_calls=args.max_metric_calls,
        reflection_minibatch_size=args.minibatch,
        display_progress_bar=False,
        track_best_outputs=True,
        seed=0,
        run_dir=args.run_dir,
    )

    winner = result.best_candidate["system_prompt"]
    out = HERE / "winner.md"
    out.write_text(winner, encoding="utf8")
    print("\n=== GEPA done ===")
    print(f"best val score: {getattr(result, 'val_aggregate_scores', '?')}")
    print(f"winner written to: {out}")
    print(f"seed chars: {len(seed)}  winner chars: {len(winner)}")


_LIST_TRAIN_JS = (
    "import {loadFixtures,trainSplit} from './src/dataset.ts';"
    "process.stdout.write(JSON.stringify(trainSplit(loadFixtures()).map(f=>f.name)));"
)

if __name__ == "__main__":
    main()
