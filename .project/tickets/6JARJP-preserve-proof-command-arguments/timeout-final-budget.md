# Final bounded timeout repair

The original 600-second Codex value was a configured budget, not a documented
fixed Stop ceiling. Treating it as immutable led to an unnecessary concurrency
experiment. Current official hook documentation describes configurable per-hook
timeouts in seconds; 600 is Codex's ordinary default.

The final choice keeps serial execution and every scenario, assertion, tag
filter, review requirement and rejection rule. Root BDD delegation stays
deduplicated. Only time allowances and diagnostic handling change.

## Policy and evidence

- Fast test commands remain capped at 60 seconds.
- BDD receives 1200 seconds, based on the complete passing 596-scenario /
  11118-step serial run taking 712.41 seconds on this busy host. The earlier
  480-second attempt failed after 536.646 seconds overall; it was insufficient.
- Completion callbacks receive 2400 seconds. One source constant supplies Claude,
  Cursor, Codex generation and OpenCode's closing dispatcher. This leaves room
  for fast lanes, plan resolution and Codex's separately bounded 600-second
  retrospective work. It is a per-callback allowance, not a universal deadline
  proof for arbitrarily large workspace graphs.
- Timeouts still reject completion. Synchronous ETIMEDOUT recognition and
  preserved failure diagnostics remain. The misleading old no-zombies comment
  was removed; process-tree cleanup was not redesigned.
- Two runner-budget cases failed RED, and four physical native-manifest cases
  failed RED. The updated runner, native metadata, generated OpenCode budget and
  existing real OpenCode dispatcher integration then passed: 198 tests, 8 files.
  CLI typecheck passed. All five generated surfaces regenerated and verified.
- Dogfood native JSON timeout fields were synchronized from source while
  preserving the pre-existing Claude settings bytes outside that owned field.
  Only the owned timeout edit will be staged from the partially changed file.

The normal source adapter must still pass under its matching 2400-second outer
budget. Fresh final-head CI is required before promotion or the authorized
admin merge. No completion status or readiness receipt is written by hand.

## Rejected parallel experiment

The complete two-worker run took 685.98 seconds overall and failed two unchanged
five-second `check --offline` steps: feature-tag precedence and invalid-feature
syntax reporting. It ran 596 scenarios (594 passed, 2 failed) and 11118 steps
(11111 passed, 5 skipped after failures, 2 failed). It did not establish a passing
or sufficiently fast completion lane. Its implementation was restored to HEAD;
the patch, RED/GREEN/failed runs and conditional independent reviews are
historical evidence only, not shipping work or current approvals.

The experiment's separate stable-worker profiles, loader changes and extra
scenario-discovery cases are not in the final change. No existing scenario was
removed to make the suite pass. The shared marker harness also exposed variable
Bun startup latency: Node returned in 32ms while a trivial Bun script sometimes
exceeded 5 seconds; both shell modes were affected. Its unchanged final recheck
passed all 34 tests. These observations do not prove a Bun defect or claim an
unrelated host repair.

## Current primary sources

- [Codex hooks](https://developers.openai.com/codex/hooks/): timeout is configured
  per handler; ordinary default is 600 seconds. The explicit three-second cap
  applies to SessionEnd/Interrupt, not this Stop handler.
- [Claude Code hook reference](https://code.claude.com/docs/en/hooks): command
  handlers expose a configurable timeout.
- [Cursor hooks](https://cursor.com/docs/hooks): per-script timeout is a number
  measured in seconds, with failClosed retained for the blocking edit gate.

Separate installed-host long-duration journeys were not performed. Native
configuration/static gates and the direct Codex adapter execution are distinct
evidence; the latter's actual result is recorded in timeout-results.md.
