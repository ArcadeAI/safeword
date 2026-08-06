---
id: 68DDPQ
slug: let-installs-unblock-safeword-commands
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1763
created: 2026-08-05T16:10:26.457Z
last_modified: 2026-08-06T14:43:51Z
---

# Let dependency installs unblock Safeword commands

**Goal:** Allow a successful dependency-install segment to unblock the guarded command sequence safely.

**Why:** The readiness gate currently blocks its own documented recovery when it is combined with a retry.

## Work Log

- 2026-08-05T16:10:26.457Z Started: Created ticket 68DDPQ
- 2026-08-05T16:10:00Z Revalidated: the current pre-tool gate blocks a compound recovery before its install segment can run.
- 2026-08-05T16:12:00Z Decided: permit only a leading recognized dependency install or exact `touch node_modules` recovery joined to its retry with `&&`; reject every other separator.
- 2026-08-05T16:37:18Z Implemented: added the narrow recovery parser, invoked it from the pre-tool hook, and added behavior tests for the permitted and blocked shell chains.
- 2026-08-05T16:37:18Z Verified: focused hook tests, typecheck, formatting, parity, and Claude-plugin release contract passed. See `verify.md` for the recorded full-plan output limitation.
- 2026-08-05T19:49:36Z Revalidated: caught the branch up to `origin/main`, confirmed the issue remains open and relevant, and re-synced the template, dogfood, and Claude-plugin hook copies.
- 2026-08-05T19:49:36Z Reviewed: source-backed quality review and scoped audit found no implementation, wiring, documentation, or dependency-boundary concerns. The generated full plan completed but its final buffered result was unavailable to this host; CI is the remaining aggregate authority.
- 2026-08-05T19:51:00Z Rechecked: the focused rebased hook-process suite passed 94/94, and byte comparisons confirmed all three shipped hook copies match.
- 2026-08-05T19:56:14Z CI: opened draft PR #1992 to run the full matrix while preserving this ticket's verify/in-progress status and keeping issue #1763 open pending confirmation.
- 2026-08-05T23:10:00Z Reviewed: an independent adversarial re-review overturned the earlier APPROVE. Two critical holes let a guarded command run against unready dependencies — `touch node_modules` was exempt while `node_modules` was *missing* (touch then creates an empty file, exits 0, and wedges readiness), and a background `&` ended the `&&` list from inside a segment so the retry ran unconditionally and concurrently.
- 2026-08-05T23:10:00Z Implemented: gated the touch recovery to `stale` readiness only, added `hasBackgroundOperator` to the shared tokenizer, and made the classifier reject any segment carrying one. Added regression pins for both plus direct unit coverage of the classifier's shell-shape edges.
- 2026-08-05T23:10:00Z Verified: 141/141 focused hook tests, full suite 6621 passed (7 root-only permission simulations fail in this sandbox and pass in CI), typecheck, lint, prettier, parity, and plugin release contract all pass. Awaiting CI on the current head.
- 2026-08-06T13:45:38Z Re-reviewed: read every PR #1992 comment and found no unresolved review threads. The prior critical fixes remain present; the two deferred concerns are still relevant and are resolved in this branch rather than merely filed.
- 2026-08-06T13:45:38Z Decided: use the shared shell tokenizer for unquoted background `&` boundaries and a shared non-reconciling-install classifier, preserving a fast fail-closed gate instead of adding a full Bash parser. See `figure-it-out-review-followups.md`.
- 2026-08-06T13:45:38Z Implemented: all tokenizer consumers now see `&` as a control operator, and direct partial/no-link install forms cannot authorize recovery or stamp readiness. Added regression coverage for dependency recovery, Cursor routing, process kills, ledger writes, architecture staging, and redirections.
- 2026-08-06T14:04:09Z Verified: focused hook tests passed 294/294; the full repository suite passed (Retro Relay 167 passed, 1 skipped; CLI 6782 passed, 5 skipped). Full lint, typecheck, formatting, parity, plugin release contract, diff hygiene, and dependency audit completed; the audit has one pre-existing no-orphans warning and no errors.
- 2026-08-06T14:22:23Z Revalidated: rebased the three ticket commits onto current `origin/main` (`cbd2700`, Bun generation pin), resolved only generated plugin-inventory conflicts, and re-ran the full suite. Results remain Retro Relay 167 passed/1 skipped and CLI 6782 passed/5 skipped; lint, formatting, parity, plugin contract, and audit remain clean.
- 2026-08-06T14:43:51Z Revalidated again: caught the branch up to subsequent `origin/main` review-agent fallback commit `7414594`, resolving only generated plugin-inventory digests. Full verification on the exact final head passed: Retro Relay 167 passed/1 skipped and CLI 6784 passed/5 skipped; lint, formatting, parity, plugin contract, and audit remain clean.
