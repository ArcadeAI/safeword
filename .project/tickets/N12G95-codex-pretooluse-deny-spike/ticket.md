---
id: N12G95
slug: codex-pretooluse-deny-spike
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Spike: port one safeword gate to a Codex PreToolUse deny hook

**Goal:** Prove deny-on-edit works end-to-end on Codex before committing to the full port.

**Why:** The whole Codex epic rests on "hooks can actually block." De-risk that with one real gate.

## Scope

Implement the phase gate (block an `apply_patch` edit when `test-definitions.md` is missing) as a Codex `PreToolUse` hook. Validate both signaling paths from the docs: JSON `permissionDecision: "deny"` and exit code 2 → stderr.

## Done when

- A `PreToolUse` hook denies an edit under the failing condition and allows it otherwise, observed in a real `codex` session.
- Confirmed which signal Codex honors (JSON vs exit-2) and the message surface.

## Source

developers.openai.com/codex/hooks

## Work Log

- 2026-05-31 Created from Codex research (verdict ENFORCEABLE).
