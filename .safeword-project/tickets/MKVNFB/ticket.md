---
id: MKVNFB
slug: phase-skip-reason
type: feature
phase: intake
status: blocked
created: 2026-05-20T14:39:14.352Z
last_modified: 2026-05-20T14:39:14.352Z
depends_on: [J7VBGJ]
scope:
  - Extend the existing artifact-existence checks in packages/cli/templates/hooks/pre-tool-quality.ts so that gated phase artifacts may be satisfied by either (a) real content, or (b) a single line of the form `skip: <non-empty reason>`.
  - Apply to decomposition.md and dimensions.md (the two BDD phases currently implicit-skip-possible per the audit done 2026-05-20).
  - Reject empty or whitespace-only skip reasons with a system-reminder explaining the rule.
  - Add one line to the bdd skill describing the skip syntax so the agent knows the escape valve exists.
out_of_scope:
  - The TDD SHA-on-checkbox feature (separate ticket — this ticket depends on its skip-reason machinery landing first).
  - Adding new artifact gates for phases that don't currently have one (intake, scenario-gate, etc.).
  - Commit-message conventions or RED/GREEN/REFACTOR prefixes.
  - Auto-skip heuristics (the agent must write the skip line; the hook only validates).
  - Categorized skip reasons / allowlists — free-form non-empty string is the rule.
  - Migration / grandfathering of pre-existing tickets.
done_when:
  - A decomposition.md containing only `skip: single task — no split needed` passes the gate.
  - A dimensions.md containing only `skip: <reason>` passes the gate.
  - An artifact containing `skip:` with no reason or whitespace-only reason fails the gate with a clear message.
  - A normal content-bearing artifact still passes (no regressions).
  - The full safeword test suite stays green.
  - New tests cover skip-accept and empty-reason-reject paths for both artifacts.
  - The bdd skill mentions the skip syntax in one line.
---

# Skip-with-reason for implicit-skip BDD phase artifacts

**Goal:** Give BDD phases that are _gated by artifact existence today_ (decomposition, dimensions) a deliberate escape valve — `skip: <reason>` — instead of the current silent implicit skip.

**Why:** A 2026-05-20 audit of safeword's full phase ledger found that decomposition.md and dimensions.md are gated by file-existence checks but offer no way for the agent to record "I considered this phase and chose to omit it, because X." Today the only options are "produce the artifact" or "bypass the gate by tricking the prerequisite chain." The escape valve mirrors the skip-with-reason pattern landing in the [tdd-sha-checkbox-ledger] feature and reuses the same mechanic so the agent learns one syntax, not two.

## Dependency

**Blocked on:** the TDD SHA-on-checkbox feature shipping first. That feature introduces the `skip: <non-empty reason>` parser and validation helper; this ticket reuses it. Starting this ticket before that one ships would either duplicate the helper or create a merge conflict.

## Context anchor

The audit that surfaced this gap is in this session's research; the relevant findings:

- `packages/cli/templates/hooks/pre-tool-quality.ts:69` gates `test-definitions.md` on scope frontmatter — already strict, no skip needed.
- `packages/cli/templates/hooks/pre-tool-quality.ts:116` gates `test-definitions.md` on `dimensions.md` existing — **implicit-skip-possible today**, in scope here.
- `decomposition.md` is checked by the bdd skill flow but has no hard gate — needs both a gate AND skip-acceptance added together (or, simpler, just keep it advisory; revisit during build phase whether to harden the gate as part of this feature).

Anthropic's May 2026 agent design guidance favors environmental-fact verification over agent-maintained ledgers — this ticket stays inside that philosophy: the artifact (file content) is the proof; the hook reads it.

## Work Log

- 2026-05-20T14:39:14.352Z Started: Created ticket MKVNFB
- 2026-05-20T14:40:00Z Scoped: filled scope / out_of_scope / done_when from the 2026-05-20 research session; noted dependency on the TDD SHA-checkbox feature (slug pending — referenced as [tdd-sha-checkbox-ledger]); deferred ticket to await that dependency.
