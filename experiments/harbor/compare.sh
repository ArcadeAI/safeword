#!/bin/sh
set -eu
cd "$(dirname "$0")"
export PYTHONPATH="$PWD"
export LANGSMITH_TRACING=false
if [ "$#" -eq 0 ]; then set -- baseline checkout; fi
task=${SAFEWORD_EVAL_TASK:-edit-preservation}
task_path="$task"
case "$task" in
  edit-preservation) dataset=safeword-edit-preservation-v2 ;;
  reservation) dataset=safeword-reservation-v3 ;;
  extractor-trace-empty) dataset=safeword-extractor-trace-empty-v3 ;;
  extractor-discovery) dataset=safeword-extractor-discovery-v2 ;;
  extractor-thin-text) dataset=safeword-extractor-thin-text-v2 ;;
  false-done | simple-fix | behavior-proof | regression-proof | eval-proof | arcade-outlook | www-home) dataset="safeword-$task-v1" ;;
  preservation-pilot/tasks/*)
    task="${task##*/}"
    dataset="safeword-preservation-pilot-$task-v2"
    ;;
  jobs/workflow-routing-fixtures/*)
    task="${task##*/}"
    dataset="safeword-workflow-routing-$task-v1"
    ;;
  debug-routing/tasks/*)
    task="${task##*/}"
    dataset="safeword-debug-routing-$task-v1"
    ;;
  *)
    printf 'Unknown eval task: %s\n' "$task" >&2
    exit 2
    ;;
esac
case "$task" in
  simple-fix | obvious-label) task_budget=0.50 ;;
  reservation | extractor-discovery | arcade-outlook | www-home) task_budget=3.00 ;;
  extractor-trace-empty | extractor-thin-text | lost-import-rows | stale-dashboard) task_budget=2.00 ;;
  *) task_budget=1.00 ;;
esac
budget=${SAFEWORD_EVAL_BUDGET_USD:-$task_budget}
export SAFEWORD_EVAL_TASK="$task"
unset CLAUDE_CODE_MAX_TURNS
condition=default
if [ -n "${SAFEWORD_EVAL_DEBUG_TASK_PATH:-}" ]; then
  task_path="$SAFEWORD_EVAL_DEBUG_TASK_PATH"
  dataset="$dataset-debug-loaded"
  condition=debug-loaded
fi
if [ "${SAFEWORD_EVAL_READY_DEPS:-0}" = 1 ]; then condition=ready-deps; fi
if [ "${SAFEWORD_EVAL_HUMAN_RELAY:-0}" = 1 ]; then
  : "${SAFEWORD_EVAL_RELAY_DIR:?Set an absolute host directory for relay files}"
  dataset="$dataset-human"
  condition="$condition-human"
  export SAFEWORD_EVAL_ANSWER_KEY="${SAFEWORD_EVAL_ANSWER_KEY:-$PWD/answer-key.json}"
fi
for arm; do
  case "$arm" in
    baseline | checkout | release | preservation | routing) ;;
    *)
      printf 'Unknown comparison arm: %s\n' "$arm" >&2
      exit 2
      ;;
  esac
done
if [ ! -f "$task_path/task.toml" ]; then
  printf 'Missing Harbor task at %s. Prepare the fixture first.\n' "$task_path" >&2
  exit 2
fi
if [ -z "${SAFEWORD_EVAL_COMPARISON:-}" ]; then
  mkdir -p jobs
  comparison_dir=$(mktemp -d "$PWD/jobs/comparison.XXXXXXXX")
  export SAFEWORD_EVAL_COMPARISON="$comparison_dir/comparison.json"
  python3 resolve_comparison.py "$SAFEWORD_EVAL_COMPARISON"
fi
author_model=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["models"]["author"])' "$SAFEWORD_EVAL_COMPARISON")
revision=${SAFEWORD_EVAL_REVISION:-$(git rev-parse HEAD)}
archive=$(mktemp)
trap 'unlink "$archive"' EXIT
git -C ../.. archive "$revision" plugin .claude-plugin/marketplace.json > "$archive"
export SAFEWORD_EVAL_ARCHIVE="$archive"
suite_status=0
for arm; do
  trial_archive="$archive"
  trial_condition="$condition"
  if [ "$arm" = preservation ]; then
    : "${SAFEWORD_EVAL_PRESERVATION_ARCHIVE:?Build the preservation archive first}"
    trial_archive="$SAFEWORD_EVAL_PRESERVATION_ARCHIVE"
    trial_condition="$condition-preservation"
    arm=checkout
  elif [ "$arm" = routing ]; then
    : "${SAFEWORD_EVAL_ROUTING_ARCHIVE:?Build the routing archive first}"
    trial_archive="$SAFEWORD_EVAL_ROUTING_ARCHIVE"
    trial_condition="$condition-routing"
    arm=checkout
  fi
  image_target=baseline
  if [ "$task" = extractor-discovery ] || [ "$task" = extractor-trace-empty ]; then
    # Both arms start with the same locked dependencies. Only the checkout loads the plugin.
    image_target=treatment
  elif [ "${task#extractor-}" != "$task" ] && [ "$arm" != baseline ]; then
    image_target=treatment
  fi
  set --
  if [ "${SAFEWORD_EVAL_LOCAL_ONLY:-0}" != 1 ]; then
    set -- --plugin completion_feedback:CompletionFeedback --pk "dataset_name=$dataset" --pk fail_fast=true
  fi
  mkdir -p jobs
  job_dir=$(mktemp -d "$PWD/jobs/$task-$arm-$trial_condition-$(git rev-parse --short "$revision").XXXXXXXX")
  job_name=${job_dir##*/}
  run_status=0
  SAFEWORD_EVAL_ARCHIVE="$trial_archive" SAFEWORD_EXTRACTOR_IMAGE_TARGET="$image_target" SAFEWORD_EVAL_ARM="$arm" uv run --locked harbor run --path "$task_path" --env docker --n-concurrent "${SAFEWORD_EVAL_CONCURRENCY:-3}" -k "${SAFEWORD_EVAL_ATTEMPTS:-3}" \
    --agent comparison_agent:ComparisonAgent --model "$author_model" \
    --ak "max_budget_usd=$budget" \
    --job-name "$job_name" \
    "$@" || run_status=$?
  set -- --arm "$arm" --close-drafts
  if [ "${SAFEWORD_EVAL_HUMAN_RELAY:-0}" = 1 ]; then set -- "$@" --relay "$SAFEWORD_EVAL_RELAY_DIR"; fi
  if ! uv run --locked python report_trials.py "$job_dir" "$@" --expected-trials "${SAFEWORD_EVAL_ATTEMPTS:-3}"; then
    if [ "$run_status" -eq 0 ]; then run_status=1; fi
  fi
  if [ -f "$job_dir/trial-report.json" ] && [ -n "${SAFEWORD_EVAL_REPORT_INDEX:-}" ]; then
    printf '%s\n' "$job_dir/trial-report.json" >> "$SAFEWORD_EVAL_REPORT_INDEX"
  fi
  if [ "$run_status" -ne 0 ]; then suite_status="$run_status"; fi
done
exit "$suite_status"
