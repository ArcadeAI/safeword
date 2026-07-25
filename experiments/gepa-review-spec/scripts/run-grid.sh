#!/usr/bin/env bash
# Review-spec eval — model roster + grid runner (ticket 21RAT9).
#
# The single source of truth for "which models the eval sweeps" — previously
# ad-hoc inline bash. Runs baseline.ts once per ACTIVE roster model at one
# effort level. Keys come from the environment; wrap with op:
#
#   op run --env-file=/Users/alex/.env.op.zshrc-migration -- \
#     experiments/gepa-review-spec/scripts/run-grid.sh [effort]
#
# effort (SAFEWORD_EVAL_EFFORT): off (default) | low | medium | high | xhigh | max
# For a low-vs-high sweep, run it twice with each level.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
EFFORT="${1:-off}"

run() { # short-name  vendor  model-id
  echo "########## $1  (effort=$EFFORT) ##########"
  if [ "$2" = openai ]; then
    SAFEWORD_EVAL_VENDOR=openai SAFEWORD_EVAL_OPENAI_MODEL="$3" SAFEWORD_EVAL_EFFORT="$EFFORT" bun src/baseline.ts
  else
    SAFEWORD_EVAL_VENDOR=anthropic SAFEWORD_EVAL_MODEL="$3" SAFEWORD_EVAL_EFFORT="$EFFORT" bun src/baseline.ts
  fi
}

run opus48 anthropic claude-opus-4-8
run sonnet5 anthropic claude-sonnet-5
# run fable5  anthropic claude-fable-5   # PLACEHOLDER — Fable is dropped for now
#   (cost: $10/$50 per MTok, the priciest tier). Uncomment to re-enable: it is the
#   only model that reliably catches determinism-order, so bring it back when that
#   catch decides a candidate. Runner support (task.ts: /fable|mythos/ floors at
#   adaptive-low, never disabled) stays in place, so re-enabling is just this line.
run sol openai gpt-5.6-sol
run terra openai gpt-5.6-terra
