# Verification — 2026-09-30

## Current result

**Status:** In progress. The review-specific checks and acceptance lane pass, and live authenticated reviews finish in both hosts. The signed-out Claude reviewer flow completed through browser sign-in and an independent retry in the same disposable credential home. The scenario ledger and the remaining host-level live checks below are not complete.

**PR Scope:** The committed diff contains the review MCP implementation, one-time approval setup, sign-in UI, tests, generated plugin artifacts, and ticket evidence. No pull request has been opened.

| Check | Result |
| --- | --- |
| CLI suite | 600 files passed; 10,219 tests passed; 13 skipped |
| BDD acceptance | 596 scenarios and 11,118 steps passed |
| CLI lint, Gherkin lint, typecheck | Passed |
| Generated surfaces | All four current |
| Diff whitespace | `git diff --check` passed |
| Independent scenario review | Approved, cross-agent; scenario-gate stamp recorded (`2466e9ce-8094-40e9-92ae-223c5c7b2b03`) |
| Independent source review | Approved, cross-agent (`4eaf4b2f-b51a-4240-89bc-fc34bb96ce1c`) |
| Scenario ledger | 48 scenarios defined; historical RED/GREEN/REFACTOR cycles were not recorded |
| Current-head focused review suite | 7 files, 145 tests passed on 2026-09-30 |
| Current-head BDD acceptance and proof tags | 596 scenarios, 11,118 steps, and 47 proof-tag tests passed on 2026-09-30 |
| Current-head CLI lint and typecheck | Passed on 2026-09-30 |
| Current-head generated surfaces | All four current on 2026-09-30 |
| Current-head broad run | Stopped after three unrelated timing failures; those 3 files passed in isolation (136 tests) |

## Host evidence and limits

- A disposable Codex home installed the built plugin and one-time `--approve-reviews` choice. The resulting profile granted only `start_review` and `start_reviewer_login`. A workspace-sandbox host with `on-request` approval called `start_review` without an approval event and received a signed review ID.
- Disposable signed-out Claude and Codex reviewer CLI runs printed official HTTPS sign-in URLs; Codex also printed a device code. MCP tests verify that displayed details must exactly match the review's live CLI capture, with no shell interpretation.
- A synthetic review returned a signed cross-agent Claude finding and a fresh status read verified its receipt. The read-only status and sign-in display paths now avoid writes and subprocess launches.
- On 2026-09-30, fresh disposable Claude and Codex profiles completed vendor sign-in. The built 1.0.0-rc.5 Codex plugin ran `start_review` under `workspace-write` with approval policy `never` and the two named grants. It completed as `changes_requested` with author `codex`, reviewer `claude`, `independence: cross-agent`, and findings naming the seeded `wallet.js` defect (review `072c61ba-50e9-4dd6-8923-80bb45458245`). No extra approval event appeared.
- The built 1.0.0-rc.5 Claude plugin called its namespaced `start_review` tool from a headless host with that tool explicitly allowed. It completed as `changes_requested` with author `claude`, reviewer `codex`, `independence: cross-agent`, and a finding on `wallet.js` (review `64cf0fa7-9b5f-42a6-a265-588c6d0cd88a`). Fresh status reads validated both signed receipts and source freshness.
- A direct run of the built review MCP server with a verified signed-out Claude credential home returned `REVIEW_AUTHENTICATION_REQUIRED` for signed review `758ab1b2-8a46-42f5-96be-86b7399a6c6e`; `review_status` reported `blocked` and `independent: false`. `start_reviewer_login` for that exact ID launched only the assigned Claude CLI, returned its exact HTTPS URL, and reported `browser_launch_requested: true`. Chrome opened Claude authorization tabs. The disposable Claude profile remained signed out because the Mac was locked and no user completed that browser flow before the ten-minute login session ended.
- Retrying the same project, kind, target, and context against an already authenticated Claude credential home produced a new signed review ID `970cd192-f6a2-4d1d-8323-c3f262b50e89`, `changes_requested`, author `codex`, reviewer `claude`, `independence: cross-agent`. This proves the retry path after an auth-required result when credentials are available, but uses credential-home substitution rather than completion of the launched browser flow.
- On 2026-09-30, a fresh direct run of the built MCP server with a verified signed-out disposable Claude credential home produced blocked review `94280b4d-1847-4e27-bbb0-75bd7367d51c` and `REVIEW_AUTHENTICATION_REQUIRED`. Its `start_reviewer_login` launched the assigned Claude CLI and opened Chrome. In the CLI-opened local callback tab, the user account selected `Arcade.dev` and authorized Claude Code; `claude auth status` for that exact credential home then reported `loggedIn: true`. Retrying the identical project, kind, target, and context through the same MCP server produced signed review `8c945019-be07-4c6d-a8df-393d97c89d1c`, `changes_requested`, author `codex`, reviewer `claude`, `independence: cross-agent`, and a finding that `canWithdraw(10, 1000)` incorrectly returns true. The original blocked review stayed non-independent. This completes the same-home browser sign-in and retry proof.
- The MCP Apps view's `ui/open-link` request is covered by a UI-script test. The OS browser opener was observed live and worked, so the MCP Apps fallback itself was not exercised live. Codex did not pass the test-only `CLAUDE_CONFIG_DIR` override to its plugin server, so the signed-out path was exercised by launching the built MCP server directly with that override.
- The repository-wide lint/build lanes were not rerun here. A prior root lint run hit an unchanged website `strictNullChecks` rule; the affected CLI package lint and build pass.
- The current-head root test run was stopped after timing failures in `review-wiring`, OpenCode `host-contract`, and `boundary-push` while another checkout also ran tests. All three files passed together in isolation (136 tests). This run does not provide a new full-suite pass; the previous full CLI suite pass above remains the last complete run.
- The feature source calls for two consecutive no-prompt Codex reviews and signed-out installed-host login checks in both Codex and Claude. The live evidence above covers one authenticated review per host and the signed-out Claude reviewer through the built MCP server directly. Those narrower observations cannot be called complete proof of the stronger host-level scenarios.

## Next action

Keep the ticket in progress. The 48-scenario ledger cannot be truthfully backfilled as test-first RED/GREEN/REFACTOR cycles from this branch's history. Finish the specifically required installed-host live checks before claiming their scenarios, and resolve the ledger process gap without fabricating past TDD evidence. The MCP Apps fallback remains covered by a UI-script test because the OS browser opener worked in the live run.
