---
id: AF88QB
slug: keep-independent-reviews-authenticated-in-codex
type: task
subtype: bug-investigated
phase: intake
status: in_progress
created: 2026-09-08T16:05:06.142Z
last_modified: 2026-09-08T16:05:06.142Z
---

# Keep independent reviews authenticated in Codex

**Goal:** Ensure Codex dispatches independent reviewers through their authenticated network boundary and reports login failures accurately.

**Why:** Restricted review launches silently degraded cross-agent coverage and mislabeled recoverable authentication failures as process crashes.

**Type:** Bug

**Scope:** Make every Codex-authored independent-review workflow request the
authenticated network boundary before dispatch, and classify reviewer login
errors emitted on stdout or stderr as authentication failures.

**Out of Scope:** Changing reviewer selection, authentication providers,
review rubrics, sandbox implementation, or the contents of #4200's product
plan.

**Done When:**

- [x] Codex review guidance requests the authenticated boundary before dispatch.
- [x] Authentication failures on stdout produce `not_authenticated`, not `process_failed`.
- [x] Generated Claude and Codex plugin assets remain in sync with canonical templates.
- [x] A real bounded review completes with cross-agent provenance.

**Tests:**

- [x] Public review wiring recognizes a Claude-style stdout login envelope.
- [x] All four review workflows carry the Codex authenticated-boundary instruction.
- [x] Focused suites, lint, typecheck, Gherkin lint, and CLI contract pass.
- [x] Live review `1d8fa728-c1ff-48c6-ad7d-f91e21f57d0a` records Claude as the actual reviewer with `independence: cross-agent`.

## Root Cause

The coordinator was invoked inside Codex's restricted command sandbox. Its
Claude and Codex subprocesses could not use their normal authenticated network
boundary and exited before reviewing. Claude wrote its login failure inside a
structured stdout envelope, while Safeword classified authentication only from
stderr, so the receipt reported `process_failed` instead of the recoverable
authentication condition.

Confirmed with the same harmless structured-output request: it failed inside
the restricted sandbox in 0.19 seconds and succeeded through the authenticated
boundary in 4 seconds. After the fix, the real 171 KB bounded #4200 packet
reached Claude and returned a substantive cross-agent verdict.

Ruled out:

- **Missing installations:** Claude 2.1.261 and Codex 0.153.4 are installed.
- **Unsupported flags:** both CLIs advertise the required flags; Claude completed with them.
- **Packet preparation:** the original durable job record contained a valid fingerprint and targets.
- **Semantic rejection:** the failed routes returned no verdict in about 1.2 seconds total.

## Work Log

- 2026-09-08T16:05:06.142Z Started: Created ticket AF88QB
- 2026-09-08T16:06:00.000Z RED: Reproduced the Claude stdout authentication envelope inside Codex's restricted sandbox; existing classification returned `process_failed`.
- 2026-09-08T16:07:00.000Z GREEN: Classified authentication from both output streams and added explicit authenticated-boundary dispatch guidance to all four review workflows.
- 2026-09-08T16:08:00.000Z Verified: 98 focused tests pass; lint, typecheck, Gherkin lint, generated plugins, and CLI contract pass. Live review 1d8fa728-c1ff-48c6-ad7d-f91e21f57d0a completed with cross-agent Claude provenance and substantive findings.
