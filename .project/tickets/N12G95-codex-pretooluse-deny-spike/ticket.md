---
id: N12G95
slug: codex-pretooluse-deny-spike
type: feature
phase: done
status: done
epic: codex-changelog-alignment
relates_to: QM5G9M
scope:
  - Add a narrow Codex PreToolUse adapter that reuses the existing safeword phase-gate behavior for supported Codex edit tool calls.
  - Validate the adapter denies missing-intake artifacts through the documented JSON `permissionDecision: "deny"` shape.
  - Validate the same denial can be surfaced through Codex's documented exit-code-2 stderr fallback.
  - Keep this as a spike: prove hook signaling and shape, not full Codex setup/generation.
out_of_scope:
  - Full Codex install generation (`AGENTS.md`, `.codex/config.toml`, `.agents/skills`) belongs to 5DEJ8V.
  - Lifecycle mapping beyond this one PreToolUse edit gate belongs to HPP49X.
  - Enterprise managed hooks and command rules belong to JV6D1W.
  - Plugin packaging belongs to 6WJ1RS.
done_when:
  - A focused automated test proves the Codex adapter denies creating `test-definitions.md` when required intake artifacts are missing.
  - A focused automated test proves the Codex adapter allows the same edit once the existing safeword intake prerequisites are satisfied.
  - A focused automated test proves the exit-code-2 fallback emits the same blocking reason on stderr.
  - The spike documents any unsupported or untested Codex tool path instead of claiming complete enforcement.
---

# Spike: port one safeword gate to a Codex PreToolUse deny hook

**Goal:** Prove deny-on-edit works end-to-end on Codex before committing to the full port.

**Why:** The whole Codex epic rests on "hooks can actually block." De-risk that with one real gate.

## Scope

Implement the phase gate (block an `apply_patch` edit when `test-definitions.md` is missing) as a Codex `PreToolUse` hook. Validate both signaling paths from the docs: JSON `permissionDecision: "deny"` and exit code 2 → stderr.

Current revalidation adds one constraint: Codex's current hooks docs call `PreToolUse` a guardrail, not a complete enforcement boundary, because interception is incomplete for newer shell execution paths and does not cover non-shell/non-MCP tools such as web search. The spike should prove the supported paths safeword needs first (`apply_patch` / `Edit` / `Write` and simple `Bash`) and explicitly record any escape paths it observes.

## Done when

- A `PreToolUse` hook denies an edit under the failing condition and allows it otherwise, observed in a real `codex` session.
- Confirmed which signal Codex honors (JSON vs exit-2) and the message surface.

## Source

developers.openai.com/codex/hooks

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide the smallest spike that proves Codex can enforce one safeword gate without overclaiming complete parity.

**Research domains checked:** Codex `PreToolUse` semantics, edit-tool matcher aliases, hook output contracts, shell interception limits, and safeword's existing phase-gate behavior.

**Options:**

1. JSON deny primary: return `hookSpecificOutput.permissionDecision: "deny"` with `permissionDecisionReason`.
2. Exit-code deny primary: exit `2` with the block reason on stderr.
3. Prompt gate only: use `UserPromptSubmit` instead of `PreToolUse`.

**Recommend:** Use option 1 as the primary path and keep option 2 as a compatibility assertion. JSON deny is the current documented shape and gives structured output; exit `2` is useful as a fallback surface. `UserPromptSubmit` belongs in the design ticket, but it does not prove edit interception.

**Next:** Build a temporary Codex hook fixture that blocks `apply_patch`/`Edit`/`Write` when `test-definitions.md` is absent, then repeat with exit `2` and document any unsupported execution path.

## Work Log

- 2026-05-31 Created from Codex research (verdict ENFORCEABLE).
- 2026-06-13T14:37:31Z Revalidated against current hooks docs and ran /figure-it-out. Scope still valid, with explicit caveat that `PreToolUse` is incomplete for some shell/tool paths. Spike should prove supported edit denial and log observed escape paths rather than claiming total enforcement.
- 2026-06-13T14:51:51Z Complete: intake + define-behavior - promoted to feature-flow per user request for full safeword BDD, established scope/out-of-scope/done-when, wrote spec.md, dimensions.md, and 3 scenarios across 2 rules. Phase -> scenario-gate.
- 2026-06-13T14:55:37Z Complete: scenario-gate - reviewed scenarios for vacuous pass, AODI, determinism, negative coverage, and cross-cutting gaps; no must-fix findings. Added impl-plan.md with integration test mapping and adapter design. Phase -> implement.
- 2026-06-13T15:02:00Z Complete: implement - wrote RED tests for Codex-shaped `apply_patch` input, observed all 3 scenarios fail before the adapter existed, added the adapter/schema/dogfood hook copy, then passed the focused adapter tests plus schema coverage. Reconciled impl-plan.md; 0 decisions updated, 0 deviations recorded. Phase -> verify.
- 2026-06-13T15:11:28Z Verify in progress - focused adapter/schema tests passed (30 tests), CLI lint/typecheck passed, package build passed, targeted Prettier/markdownlint passed, and `test:smoke:fast` passed (35 files, 457 tests). Full `bun run test` did not complete in this Codex session and was interrupted after several minutes with no failure summary. Ticket remains in verify; Claude `/verify` + `/audit` invocation stamps were not produced.
- 2026-06-13T23:46:54Z Complete: verify - focused Codex/setup/schema tests passed (56/56), typecheck passed, and gherkin lint passed. Added `verify.md`; live trusted Codex-session observation remains delegated to `CXP9LM`. Phase -> done.
