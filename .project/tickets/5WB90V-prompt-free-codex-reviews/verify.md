# Verification — 2026-09-30

## Current result

**Status:** In progress. Automated checks and independent reviews pass; authenticated reviews finish in both live hosts. A real auth-required review, plugin login launch, and authenticated retry of the same target packet have been observed. Completing the browser sign-in into that exact disposable credential home remains unverified.

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
| Scenario ledger | 48 scenarios defined; RED/GREEN/REFACTOR boxes remain unchecked pending the live demo |

## Host evidence and limits

- A disposable Codex home installed the built plugin and one-time `--approve-reviews` choice. The resulting profile granted only `start_review` and `start_reviewer_login`. A workspace-sandbox host with `on-request` approval called `start_review` without an approval event and received a signed review ID.
- Disposable signed-out Claude and Codex reviewer CLI runs printed official HTTPS sign-in URLs; Codex also printed a device code. MCP tests verify that displayed details must exactly match the review's live CLI capture, with no shell interpretation.
- A synthetic review returned a signed cross-agent Claude finding and a fresh status read verified its receipt. The read-only status and sign-in display paths now avoid writes and subprocess launches.
- On 2026-09-30, fresh disposable Claude and Codex profiles completed vendor sign-in. The built 1.0.0-rc.5 Codex plugin ran `start_review` under `workspace-write` with approval policy `never` and the two named grants. It completed as `changes_requested` with author `codex`, reviewer `claude`, `independence: cross-agent`, and findings naming the seeded `wallet.js` defect (review `072c61ba-50e9-4dd6-8923-80bb45458245`). No extra approval event appeared.
- The built 1.0.0-rc.5 Claude plugin called its namespaced `start_review` tool from a headless host with that tool explicitly allowed. It completed as `changes_requested` with author `claude`, reviewer `codex`, `independence: cross-agent`, and a finding on `wallet.js` (review `64cf0fa7-9b5f-42a6-a265-588c6d0cd88a`). Fresh status reads validated both signed receipts and source freshness.
- A direct run of the built review MCP server with a verified signed-out Claude credential home returned `REVIEW_AUTHENTICATION_REQUIRED` for signed review `758ab1b2-8a46-42f5-96be-86b7399a6c6e`; `review_status` reported `blocked` and `independent: false`. `start_reviewer_login` for that exact ID launched only the assigned Claude CLI, returned its exact HTTPS URL, and reported `browser_launch_requested: true`. Chrome opened Claude authorization tabs. The disposable Claude profile remained signed out because the Mac was locked and no user completed that browser flow before the ten-minute login session ended.
- Retrying the same project, kind, target, and context against an already authenticated Claude credential home produced a new signed review ID `970cd192-f6a2-4d1d-8323-c3f262b50e89`, `changes_requested`, author `codex`, reviewer `claude`, `independence: cross-agent`. This proves the retry path after an auth-required result when credentials are available, but uses credential-home substitution rather than completion of the launched browser flow.
- The MCP Apps view's `ui/open-link` request is covered by a UI-script test. The OS browser opener was observed live; the MCP Apps fallback itself and same-credential-home browser completion remain unobserved. Codex did not pass the test-only `CLAUDE_CONFIG_DIR` override to its plugin server, so the signed-out path was exercised by launching the built MCP server directly with that override.
- The repository-wide lint/build lanes were not rerun here. A prior root lint run hit an unchanged website `strictNullChecks` rule; the affected CLI package lint and build pass.

## Next action

With the Mac unlocked, repeat the signed-out browser flow in the disposable credential home and retry the same target packet there. Exercise the MCP Apps fallback only if the OS opener cannot launch. Then check the scenario ledger and close the ticket.
