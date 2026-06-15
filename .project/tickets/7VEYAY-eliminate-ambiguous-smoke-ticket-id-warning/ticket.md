---
id: 7VEYAY
slug: eliminate-ambiguous-smoke-ticket-id-warning
type: patch
phase: intake
status: in_progress
created: 2026-06-15T13:52:20.282Z
last_modified: 2026-06-15T13:52:44Z
---

# Eliminate ambiguous smoke ticket ID warning

**Goal:** Remove or intentionally isolate the duplicate `7K9M3P` fixture warning from smoke-fast output.

**Why:** Passing smoke tests should not emit ambiguous ticket ID warnings unless the warning is the behavior under test.

**Scope:** Identify the fixture or test setup that creates both `7K9M3P` and `7K9M3P-spurious`, then either scope the warning assertion to its test or rename the fixture so unrelated smoke runs are quiet.

**Out of Scope:** Changing duplicate ticket ID production behavior.

**Done When:**

- [ ] `bun run test:smoke:fast` passes without the ambiguous ticket ID warning in normal output.
- [ ] Any test that intentionally validates ambiguous IDs still asserts that behavior locally.

## Work Log

- 2026-06-15T13:52:20.282Z Started: Created ticket 7VEYAY
- 2026-06-15T13:52:44Z Intake: Smoke-fast passed 482/482 but printed `Ambiguous ticket ID "7K9M3P": 7K9M3P, 7K9M3P-spurious`.
