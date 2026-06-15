---
id: BPB39Q
slug: strengthen-golden-path-test-quality
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:52:24.906Z
last_modified: 2026-06-15T13:52:44Z
---

# Strengthen golden-path test quality

**Goal:** Replace weak golden-path assertions and duplicated install/upgrade test shape with behavior-specific checks.

**Why:** The audit found tests that can pass while asserting only absence of crashes or object presence, reducing confidence in the setup and upgrade lanes.

**Scope:** Strengthen `packages/cli/tests/integration/golden-path.test.ts` assertions around lint-hook graceful handling and setup idempotency, and deduplicate the repeated AGENTS/CLAUDE install-upgrade pattern where it improves clarity.

**Out of Scope:** Rewriting unrelated integration tests or changing setup behavior.

**Done When:**

- [ ] `not.toThrow()` checks assert the returned hook status/output or resulting file state.
- [ ] `toBeDefined()` checks assert specific dependency names and versions/constraints where relevant.
- [ ] Repeated AGENTS/CLAUDE install-upgrade coverage is table-driven or otherwise intentionally shared.
- [ ] The targeted integration tests still pass.

## Work Log

- 2026-06-15T13:52:24.906Z Started: Created ticket BPB39Q
- 2026-06-15T13:52:44Z Intake: Audit flagged weak assertions at `golden-path.test.ts:183`, `golden-path.test.ts:190`, and `golden-path.test.ts:221`, plus duplicated AGENTS/CLAUDE install-upgrade structure around `install-upgrade.test.ts:107`.
