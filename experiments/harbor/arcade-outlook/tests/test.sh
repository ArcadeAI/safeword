#!/bin/sh
set -eu
mkdir -p /logs/verifier
cd /app/apps/worker/toolkits/microsoft_outlook_mail
cp /tests/feature-test.py tests/test_harbor_conversation.py
cp /tests/search-regression.py tests/test_harbor_search.py
checks='blank_conversation or unknown_conversation or identifier_prefix or mailbox_wide or first_page_at_limit or complete_page_at_limit or continuation_replays or unscoped_continuation or exported_through_real_catalog'
run_checks() {
  status=0
  .venv/bin/pytest -q "$@" || status=$?
  case "$status" in
    0) ;;
    1 | 2)
      printf '0\n' > /logs/verifier/reward.txt
      exit 0
      ;;
    *)
      printf 'pytest could not run the verifier (exit %s)\n' "$status" >&2
      exit "$status"
      ;;
  esac
}
run_checks tests/test_harbor_search.py
run_checks tests/test_harbor_conversation.py -k "$checks"
printf '1\n' > /logs/verifier/reward.txt
