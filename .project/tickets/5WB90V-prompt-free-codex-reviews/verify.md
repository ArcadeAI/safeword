# Verification — 2026-09-30

## Current result

**Status:** In progress. Automated checks and independent reviews pass; authenticated reviews now finish in both live hosts. The same-review sign-in continuation and MCP Apps browser handoff remain unverified.

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
- The MCP Apps view's `ui/open-link` request is covered by a UI-script test. Browser handoff from the MCP Apps view and a retry of the same review after an authentication-required result have not been observed live. Both completed host reviews started after sign-in; they do not prove this continuation. This remains the completion gate.
- The repository-wide lint/build lanes were not rerun here. A prior root lint run hit an unchanged website `strictNullChecks` rule; the affected CLI package lint and build pass.

## Next action

Complete the live signed-out → sign-in → same-review retry and MCP Apps browser handoff demonstrations in disposable Claude and Codex profiles, then check the scenario ledger and close the ticket.
