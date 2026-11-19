---
id: VRJ93G
slug: prevent-catalogue-install-test-stalls
type: task
subtype: bug-investigated
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/6371
scope:
  - isolate the failed OpenCode catalogue installation check on exact main
  - remove unrelated registry work from this catalogue-only proof if explicitly approved
out_of_scope:
  - changing production installation behavior or package-manager timeouts
  - weakening catalogue assertions, raising the test timeout, or skipping coverage
  - changing review routes, qualification, deferred cases, or dispute implementation
done_when:
  - the slow boundary and unconfirmed CI-specific details are recorded honestly
  - an approved minimal repair passes the original catalogue assertions and relevant profile controls
  - original failed runs remain preserved and verification limits are explicit
created: 2026-11-12T00:19:43.585Z
last_modified: 2026-11-12T17:34:00Z
---

# Keep OpenCode catalogue installation checks reliable

**Goal:** Investigate the 60-second OpenCode catalogue installation timeout and remove unnecessary package-download coupling without weakening catalogue assertions; the exact historical CI stall remains unconfirmed.

**Why:** Both Node jobs failed on main e49310a74 after exact-tree PR CI passed; preserve the failures and isolate the slow boundary.

## Work Log

- 2026-11-12 Pacific: Closed this bounded task after complete verification passed and independent complete-packet review 497a1254 approved. Earned the supported verify-phase stamp using the coordinator's actual cross-agent Claude/opus metadata and receipt. Diff-scoped audit passed with no dependency violations; only the catalogue test and task records are in scope. No new scenarios or RGR credit, beneficial structural refactor or wider test hardening warranted. Answered remaining warnings: 60s timeout is unchanged in vitest.config.ts; online failure/latency is not covered by this offline proof; exact CI cause remains unknown. Clarified the goal accordingly. Task completion does not mark the Draft PR Ready, merge it, or finish #4200.

- Final record review 59f881e0 independently approved the evidence records; code was separately approved by 61babf97. Fixed its historical-heading/current-head clarity warnings and refreshed last_modified. The unrelated Claude release timeout remains an unresolved timing observation here and in preserved CI attempt-one logs; one successful rerun does not establish its cause or justify more retries. No repair or test-hardening scope added.

- 2026-11-12 Pacific: Complete post-update packaged verification exited 0. Each full CLI pass: 719 files / 11629 passed / 14 skipped; relay 198 passed / 1 skipped, collector 153 passed; all 599 acceptance scenarios, 52 proof checks, builds, lint/typechecks and JavaScript/Python audits pass. Go has zero reachable vulnerabilities; notices retained. Current-head real offline probe verifies all 50 asset bytes with no package manager; fresh cross-agent review 61babf97 approves the test (model alias opus). CI 43260512508 passes after exactly one unchanged-head rerun of Node 22: its first CLI pass succeeded but the separate Claude-plugin release check timed out at 30s; rerun passes all 81 release checks. Every prior failure, missing RED and 33 deferred cases remain preserved. Final record review and supported ticket closure remain; no Ready or merge authority.

- 2026-11-12 Pacific: PR #7201 merged as main 8daeec44c. Merged current main cleanly into this branch at f7081a0ea; PR scope remains the original catalogue setup flag/comment plus task records. Installed from the unchanged accepted lock with pinned Bun 1.4.4; changed-file ESLint and diff checks pass. Started a fresh full packaged verification invocation, logged at /tmp/VRJ93G-main-verify.log. Relay 198 passed / 1 skipped and collector 153 passed; CLI is queued on the shared test lock. Prior failed full runs, missing local RED and all 33 deferred cases remain preserved. No Ready promotion or merge authorized or performed.

- Verification outcome, November 11 Pacific: Full local plan exited 1. CLI pass one: 2 failed / 11,626 passed / 14 skipped; pass two: 1 different failure / 11,627 passed / 14 skipped. The three failed cases all pass unchanged in an isolated 3-case run (207 filtered out); neither failed full pass is erased. All 599 acceptance scenarios, 11,786 steps, 52 proof checks, build and typecheck lanes pass. Local Bun/uv audits still report inherited findings; locks and production dependencies were not edited here. Existing Draft #7201 addresses those dependencies separately and remains unmerged. Keep VRJ93G at verify/in_progress and #7190 Draft; no closure approval/receipt, Ready promotion or merge. Full logs and the bounded Figure It Out recovery decision are preserved in the permanent trial archive.

- Closure follow-through, November 11 Pacific: Draft #7190 is published at 1c54c4a78. CI 43130744212 passed on its first attempt, including both Node suites; main failure 43090952840 remains preserved. User requested verification and ticket closure, not Ready promotion or merge. Intake record review 79871443 approved with a cross-agent Claude Sonnet fallback; the first stamp lacked independence metadata and correctly did not authorize transition. The authenticated stamp with the actual reviewer metadata succeeded. Code review 21cd5c4d used Claude Opus and remains the unchanged-test review. Full local verification is running before closure.
- Timing clarification: 632ms was the first offline installation-only probe. The later 667ms probe included byte-for-byte validation of all 50 catalogue assets. Neither is a CI timing bound. This test intentionally proves local catalogue installation, not online package-download success; its original assertions did not check download success. Production online installation is unchanged, and this patch does not claim new online-network coverage.

- 2026-11-11 Pacific: User explicitly approved the test-only offline setup. Changed only offline:false to offline:true plus its explanatory comment; original installer, catalogue/filesystem assertions and 60s timeout remain. Catalogue/profile checks pass 28/28, changed-file lint passes and independent cross-agent review 21cd5c4d approves. Existing assertion-strength warnings were retained, not expanded into this patch. No production source, generated surface, dependency, route, qualification, deferred case, GitHub issue or main branch changed. Full-suite/CI verification and ticket closure are not claimed.

## Root Cause

The catalogue-only test selected online project setup. Before writing the
profile catalogue, that path invokes a real package manager for unrelated
development tools, with a 120s subprocess ceiling inside a 60s test. Direct
instrumentation confirmed this external boundary dominates local duration:
online 11.854s including npm 10.746s; offline 0.667s including byte-for-byte
checks of all 50 catalogue assets, with no npm process. The existing test has
no dependency-download success assertion. Its catalogue contract is preserved
by the supported offline installation path.

Ruled out as the dominant local cause: catalogue generation/file writes
(all complete under one second offline), and shared profile-lock contention
(fresh isolated profile roots and a 500ms lock-wait bound). The exact CI stall
is not reconstructed: unchanged local tests pass 5/5 in 8.45s. Historical CI
run 43090952840 remains a real failure on both Node versions. The repair removes
the unnecessary external dependency; it does not prove a particular registry
outage, clear every #6371 timeout, or claim a deterministic new RED.

- Diagnostic checkpoint: unchanged targeted file passes 5/5 locally in 8.45s, so the historical CI timeout is not locally reproduced. An offline direct lifecycle probe verifies all 50 generated catalogue assets byte-for-byte in 667ms with no npm process. Production permits package-manager work up to 120s, while this catalogue test times out at 60s. The confirmed proof defect is coupling catalogue checks to unrelated registry installation; exact historical CI subprocess timing remains unknown. The proposed test-only offline setup awaits the explicit test-edit approval required by the Testing guide; no existing test has changed.

- 2026-11-11 Pacific: Investigation on exact main e49310a74. Existing #6371 tracks broader setup timeouts; this task isolates the OpenCode catalogue case. Main CI 43090952840 failed both Node jobs on catalogue.test.ts:86 at 60s; earlier same-tree PR CI passed. No timeout increase, skip or rerun campaign.
- Competing causes: external dependency installation; profile-lock contention; local catalogue/reconciliation work. Real Node subprocess instrumentation shows npm installing seven unrelated development tools (10.746s locally), then attempting safeword@1.2.0 (249ms, unsuccessful), before profile installation. Online completes in 11.854s, offline in 632ms with no npm calls; both return errors:[] and state changed. Profile lock has a 500ms retry ceiling and isolated roots; it cannot alone explain a 60s wait. Exact CI subprocess timing remains unavailable; local timeout itself has not reproduced.

- 2026-11-12T00:19:43.585Z Started: Created ticket VRJ93G
