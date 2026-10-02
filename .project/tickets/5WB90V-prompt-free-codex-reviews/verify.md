# Verification — 2026-09-30

## Current result

**Status:** In progress. The review-specific checks, acceptance lane, and current-head CI test matrix pass. Live host checks cover two consecutive no-prompt Codex reviews and signed-out reviewer login links in both hosts. The scenario ledger remains incomplete; headless hosts did not prove MCP Apps panel rendering.

**PR Scope:** Draft PR #5143 contains the review MCP implementation, one-time approval setup, sign-in UI, tests, generated plugin artifacts, and ticket evidence. Dependency-audit remediation is isolated in draft PR #5144.

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
| PR #5143 CI at `48e789415` | Node 22 and 24 tests, lint, CLI contract, parity, and conformance passed; dependency audit failed on vulnerabilities inherited from `origin/main` |
| PR #5144 CI at `c81fb2fa9` | Node 22 and 24 tests, lint, dependency audit, CLI contract, parity, and conformance passed |

## Host evidence and limits

- A disposable Codex home installed the built plugin and one-time `--approve-reviews` choice. The resulting profile granted only `start_review` and `start_reviewer_login`. A workspace-sandbox host with `on-request` approval called `start_review` without an approval event and received a signed review ID.
- Disposable signed-out Claude and Codex reviewer CLI runs printed official HTTPS sign-in URLs; Codex also printed a device code. MCP tests verify that displayed details must exactly match the review's live CLI capture, with no shell interpretation.
- A synthetic review returned a signed cross-agent Claude finding and a fresh status read verified its receipt. The read-only status and sign-in display paths now avoid writes and subprocess launches.
- On 2026-09-30, fresh disposable Claude and Codex profiles completed vendor sign-in. The built 1.0.0-rc.5 Codex plugin ran `start_review` under `workspace-write` with approval policy `never` and the two named grants. It completed as `changes_requested` with author `codex`, reviewer `claude`, `independence: cross-agent`, and findings naming the seeded `wallet.js` defect (review `072c61ba-50e9-4dd6-8923-80bb45458245`). No extra approval event appeared.
- The built 1.0.0-rc.5 Claude plugin called its namespaced `start_review` tool from a headless host with that tool explicitly allowed. It completed as `changes_requested` with author `claude`, reviewer `codex`, `independence: cross-agent`, and a finding on `wallet.js` (review `64cf0fa7-9b5f-42a6-a265-588c6d0cd88a`). Fresh status reads validated both signed receipts and source freshness.
- A direct run of the built review MCP server with a verified signed-out Claude credential home returned `REVIEW_AUTHENTICATION_REQUIRED` for signed review `758ab1b2-8a46-42f5-96be-86b7399a6c6e`; `review_status` reported `blocked` and `independent: false`. `start_reviewer_login` for that exact ID launched only the assigned Claude CLI, returned its exact HTTPS URL, and reported `browser_launch_requested: true`. Chrome opened Claude authorization tabs. The disposable Claude profile remained signed out because the Mac was locked and no user completed that browser flow before the ten-minute login session ended.
- Retrying the same project, kind, target, and context against an already authenticated Claude credential home produced a new signed review ID `970cd192-f6a2-4d1d-8323-c3f262b50e89`, `changes_requested`, author `codex`, reviewer `claude`, `independence: cross-agent`. This proves the retry path after an auth-required result when credentials are available, but uses credential-home substitution rather than completion of the launched browser flow.
- On 2026-09-30, a fresh direct run of the built MCP server with a verified signed-out disposable Claude credential home produced blocked review `94280b4d-1847-4e27-bbb0-75bd7367d51c` and `REVIEW_AUTHENTICATION_REQUIRED`. Its `start_reviewer_login` launched the assigned Claude CLI and opened Chrome. In the CLI-opened local callback tab, the user account selected `Arcade.dev` and authorized Claude Code; `claude auth status` for that exact credential home then reported `loggedIn: true`. Retrying the identical project, kind, target, and context through the same MCP server produced signed review `8c945019-be07-4c6d-a8df-393d97c89d1c`, `changes_requested`, author `codex`, reviewer `claude`, `independence: cross-agent`, and a finding that `canWithdraw(10, 1000)` incorrectly returns true. The original blocked review stayed non-independent. This completes the same-home browser sign-in and retry proof.
- On 2026-10-01, a disposable Codex home installed the built `1.0.0-rc.5` plugin from this branch and ran with `workspace-write`, approval policy `never`, and only `start_review`/`start_reviewer_login` approved. One Codex host invocation completed two consecutive reviews of the same `wallet.js` defect: `c9d938c6-03da-4d8d-9dc1-eafdf61b8ac7` and `d299d5fd-6ddb-4d75-ac3f-1c5a6c2c5140`. Both terminal status reads reported `changes_requested` and `independent: true`; both named the defect; neither call produced an approval event. The fixture's SHA-256 stayed `0b3f5e34274a341ec6afef94f85b657a3e238898d3caec9b181f5e9653a326c3`.
- In that installed Codex host, an isolated `HOME` made the assigned Claude reviewer genuinely signed out. Review `8961d484-bf5e-4d19-bb0e-62633b509277` ended `blocked`, `independent: false`, with `REVIEW_AUTHENTICATION_REQUIRED`; `start_reviewer_login` returned the Claude CLI's official HTTPS URL and requested browser launch without an approval prompt. Setting only `CLAUDE_CONFIG_DIR` on the outer Codex process did not isolate the reviewer in an earlier attempt; that attempt completed an authenticated review and was not counted as a sign-in check.
- A headless Claude host loaded the built plugin from `plugin/` and explicitly allowed its three namespaced review tools. With an empty `CODEX_HOME`, review `2ccf044d-0b6c-4fd4-8256-a45aa21dc22f` ended `blocked`, `independent: false`, with `REVIEW_AUTHENTICATION_REQUIRED`; `start_reviewer_login` returned the official Codex device URL and device code together. No permission prompt occurred. This proves the Claude host tool path, although the plugin was loaded with `--plugin-dir` for this run rather than installed into a persistent Claude profile.
- The MCP Apps view's `ui/open-link` request is covered by a UI-script test. The headless Codex and Claude logs show text links and tool calls, but do not reveal whether a graphical MCP Apps panel rendered. The OS browser opener was observed live earlier and worked, so the UI fallback itself was not exercised live.
- The repository-wide lint/build lanes were not rerun here. A prior root lint run hit an unchanged website `strictNullChecks` rule; the affected CLI package lint and build pass.
- The current-head root test run was stopped after timing failures in `review-wiring`, OpenCode `host-contract`, and `boundary-push` while another checkout also ran tests. All three files passed together in isolation (136 tests). This run does not provide a new full-suite pass; the previous full CLI suite pass above remains the last complete run.
- The remaining host limit is graphical MCP Apps rendering and persistent Claude-profile installation in the signed-out Codex reviewer run; the headless Claude plugin load exercised the same built tool but not that installation lifecycle.

## Next action

Keep the ticket in progress. The 48-scenario ledger cannot be truthfully backfilled as test-first RED/GREEN/REFACTOR cycles from this branch's history. Resolve that process gap explicitly without fabricating past TDD evidence. Graphical MCP Apps rendering remains a separate release-level observation; the text link and browser opener paths have live proof.
