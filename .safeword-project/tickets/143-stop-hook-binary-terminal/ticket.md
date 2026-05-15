---
id: 143
type: feature
phase: implement
status: in_progress
created: 2026-05-14T15:30:00Z
last_modified: 2026-05-14T15:30:00Z
scope: |
  Replace the Stop-hook quality-review prompt in
  `packages/cli/templates/hooks/lib/quality.ts` (canonical source — `.safeword/hooks/`
  is the runtime copy and gets synced) with a universal CONFIDENT/BLOCKED binary
  terminal that applies across all phases (intake, define-behavior, scenario-gate,
  decomposition, implement RED/GREEN/REFACTOR, verify, done). Each phase keeps a
  phase-specific evidence sentence appended to a shared header. BLOCKED requires a
  concrete-verb "Tried:" field. Existing disqualifying signals (novelResearchReminder,
  recentFailures) and the done-phase artifact gate continue to short-circuit Confident.
  Cursor parity preserved: `cursor/stop.ts` consumes the binary form via
  QUALITY_REVIEW_MESSAGE (continues to use the default/implement shape — no Cursor
  phase-awareness in this change).
out_of_scope: |
  - Changing stop-hook delivery mechanics (decision:block, stop_hook_active loop guard).
  - Replacing transcript parsing with an agent-based hook (covered by 037).
  - Post-hoc validation that CONFIDENT claims are true on the following turn.
  - Changing LOC/phase/refactor PreToolUse/PostToolUse gates.
  - Adjusting any phase definitions or BDD/TDD flow itself.
  - Upgrading Cursor's stop hook to phase-aware (future change; keep parity for now).
  - The /audit Cursor-parity check itself — split into ticket 144.
done_when: |
  - `packages/cli/templates/hooks/lib/quality.ts` emits a single shape: shared header
    + phase-specific evidence sentence, replacing the current mix of
    checklists/rubrics/free-form introspection. `.safeword/hooks/lib/quality.ts` is
    re-synced from the template.
  - Every phase listed in BddPhase plus TDD steps (red/green/refactor) and verify
    produces a Confident-or-Blocked terminal prompt.
  - BLOCKED template requires "Tried: <concrete verb>" and "Need: <unblock>".
  - novelResearchReminder set this session disqualifies CONFIDENT (forces /quality-review first).
  - Existing done-phase hardBlockDone in stop-quality.ts continues to fire when verify.md is missing.
  - QUALITY_REVIEW_MESSAGE export still resolves to the implement/default binary form
    so `cursor/stop.ts` keeps working unchanged.
  - test-definitions.md scenarios cover: shape consistency across phases, "Tried:" enforcement,
    disqualification flag behavior, done-phase artifact gate still wins over Confident,
    Cursor stop hook receives binary-shaped message.
  - SAFEWORD_SCHEMA.contracts['packages/cli/templates/hooks/lib/quality.ts'].requires
    expanded from ['QUALITY_REVIEW_MESSAGE'] to also include CONFIDENT, BLOCKED, Tried:, Need:.
    This is the cross-ticket acceptance test 144 set up.
  - All scenarios marked complete; /verify passes; /audit passes.
  - 144 (parity check) already shipped — no follow-up ticket needed for that surface.
commit_ordering: |
  Prompt change in templates/hooks/lib/quality.ts MUST land before (or in the same
  commit as) the SAFEWORD_SCHEMA.contracts requires expansion. Otherwise pre-commit's
  contracts-only gate will block — the file wouldn't yet contain the new markers.
---

# Stop-hook binary terminal: CONFIDENT or BLOCKED

**Goal:** Replace the Stop-hook quality-review prompt with a universal CONFIDENT/BLOCKED binary terminal so the agent commits to a verdict instead of dumping uncertainty lists on the user.

**Why:** The current implement-phase prompt (`lib/quality.ts:58-67`) asks the agent to "state what remains uncertain after research." Describe-prompts make LLMs generate; commit-prompts force calibration. The agent dutifully produces a list every Stop, which lands as a doubt-dump in the user's lap — the opposite of the intended catch-silent-failure + trigger-research design. A universal binary terminal makes the agent either close out uncertainty (CONFIDENT with cited evidence) or escalate one concrete block (BLOCKED with Tried/Need fields), preserving the original intents (1) and (2) while restoring signal.

## Work Log

- 2026-05-14T15:30:00Z Started: Ticket created after propose-and-converge converged on binary terminal design. Intent confirmed as (1) catch silent failure + (2) trigger research mid-task — NOT (3) checkpoint surfacing to user. Universal-across-phases scoped over per-phase variation. Phase: intake. Next: scenario writing in define-behavior.
- 2026-05-14T15:32:00Z Scope refined: surfaced Cursor parity (cursor/stop.ts consumes QUALITY_REVIEW_MESSAGE) + template/runtime source-of-truth split (canonical edit lives in packages/cli/templates/hooks/lib/quality.ts). Added to scope and done_when.
- 2026-05-14T15:34:00Z Scope refined: added /audit Cursor-parity check — asserts QUALITY_REVIEW_MESSAGE export + shared-header markers (CONFIDENT/BLOCKED/Tried/Need) + templates↔runtime sync for cursor/stop.ts. Static inspection only; no per-phase phrasing assertions.
- 2026-05-14T15:36:00Z Scope refined: user chose to split the audit-parity check into ticket 144 (depends on 143). 143 keeps only the prompt-shape change and runtime Cursor parity (the export contract). Out-of-scope updated to point at 144.
- 2026-05-14T23:38:00Z Intake final pass: 144 has shipped (PR #91). Three deferred open questions resolved per research: Tried strict (Lin et al.), disqualification explicit (calibration honesty), RED accept-as-written. Added "Think before declaring" to prompt header (Kadavath/extended-thinking nudge). Added explicit done_when for SAFEWORD_SCHEMA.contracts requires expansion + commit_ordering note (prompt-change must precede or co-commit with schema-expansion). Phase advancing to define-behavior.
- 2026-05-14T23:42:00Z Phase 3 (define-behavior) complete: 5 rules, 17 scenarios written. Phase 4 (scenario-gate) AODI + adversarial pass found 2 gaps (extended-thinking nudge test, unknown-phase fallback) — added to Rule 1, total 19 scenarios. Re-validated, no further gaps. Phase 5 (decomposition) skipped — architecture determined by proposal: 6 tasks ordered 1→2→3→4→5 (commit ordering matters). Phase advancing to implement.

---

## Related Files

- `packages/cli/templates/hooks/lib/quality.ts` — **canonical** prompt source (primary edit target)
- `.safeword/hooks/lib/quality.ts` — runtime copy; synced from templates after change
- `packages/cli/templates/hooks/stop-quality.ts` / `.safeword/hooks/stop-quality.ts` — delivers via `decision: "block"` + `reason`; loop guard `stop_hook_active` already prevents trapping
- `packages/cli/templates/hooks/cursor/stop.ts` / `.safeword/hooks/cursor/stop.ts` — imports `QUALITY_REVIEW_MESSAGE` as `followup_message`; parity preserved by keeping the export
- `.safeword/hooks/lib/quality-state.ts` — `novelResearchReminder`, `recentFailures` (disqualification signals)
- `.safeword/hooks/prompt-questions.ts` — phase-aware reminders (uses same `BddPhase` enum; verify phase referenced here but missing from quality.ts PHASE_MESSAGES)

## Adjacent Tickets

- **037** (Replace stop-quality transcript parsing with agent-based hook) — touches the same hook but a different layer (delivery, not prompt content). No conflict; 143 leaves transcript-parsing logic intact. If 037 lands after 143, the binary prompt continues to apply.
- **047** (Smarter Stop Hook Loop Guard) — changes the `stop_hook_active` bypass logic. 143 depends on the loop guard _existing_ (so BLOCKED doesn't trap the agent) but not on its exact semantics. Compatible with either current guard or 047's edit-aware version.
- **144** (/audit Cursor-parity check) — split-out follow-up; depends on 143's marker contract.

## Design Constraint

Stop hooks cannot use `additionalContext` per Claude Code docs — only PreToolUse, PostToolUse, UserPromptSubmit, etc. support that field. The only channel from a Stop hook into the agent's context is `decision: "block"` + `reason`. That's why the lever for this ticket is the prompt text itself: changing it changes the shape of what the agent must produce on its next turn.

## Design Notes

**Shape (shared header, applied per phase):**

```
Think about evidence before declaring. End in CONFIDENT or BLOCKED.

CONFIDENT — <phase-specific evidence>
BLOCKED — <one specific unknown>. Tried: <concrete verb + object>. Need: <unblock>.

No lists. If multiple unknowns: resolve the small ones, then BLOCKED on the load-bearing one.
```

**Note on prompt size:** The per-phase evidence table below has 9 rows in the design notes for documentation, but only ONE row reaches Claude per Stop (selected by `getQualityMessage(phase, tddStep)`). Actual prompt-on-the-wire is the universal header + one phase line. Not 9 rows of bloat.

**Research alignment:** Binary tokenized verdict + chain-of-thought nudge + no-lists rule is supported by Kadavath et al. 2022 (calibration of tokenized verdicts), Lin et al. 2022 (free-form uncertainty is systematically miscalibrated), Tian et al. 2023 (forced commitment improves calibration). The "think before declaring" sentence opportunistically engages Claude 4.7's deliberation without forcing extended thinking (which a hook can't toggle).

**Marker contract:** The four shared-header tokens (`CONFIDENT`, `BLOCKED`, `Tried:`, `Need:`)
are owned by ticket 144's audit assertion (single source of truth). 143's prompt must produce
output that contains all four, but 144's audit check is the canonical definition. If 144's
marker list changes, 143 follows.

**Per-phase evidence sentence:**

| Phase              | Confident evidence template                        |
| ------------------ | -------------------------------------------------- |
| intake             | `Scope: <X>. Out: <Y>. Done when: <Z>.`            |
| define-behavior    | `<N> scenarios; AODI; happy/failure/edge covered.` |
| scenario-gate      | `Validated <N> scenarios. AODI pass.`              |
| decomposition      | `Tasks: A→B→C.` or `Skipped — architecture clear.` |
| implement RED      | `Test fails on missing behavior <X>.`              |
| implement GREEN    | `<X>/<X> tests pass; minimal impl.`                |
| implement REFACTOR | `Cleanup: <change>; <X>/<X> tests pass.`           |
| verify             | `/verify: <X>/<X> tests, <N>/<N> scenarios.`       |
| done               | `/audit: passed. /verify: passed.`                 |

**Disqualification — CONFIDENT not allowed when:**

- `novelResearchReminder` true and unconsumed → require `/quality-review` first
- `recentFailures` contains a pattern relevant to the current phase

**Mismatch to fix in passing:** `BddPhase` in `lib/quality.ts` is missing `'verify'` though `prompt-questions.ts` already routes on it. Add to enum + add a verify message under the binary shape.

## Resolved Open Questions (intake-final)

- **"Tried:" enforcement strictness** → **Strict.** Require a recognizable concrete verb (read, ran, fetched, grepped, tested) followed by an object. Don't enumerate an exhaustive list — the prompt instructs "concrete verb + object" and the model patterns from there. Rationale: vague "tried thinking about it" defeats the discharge mechanism that serves intent (2).
- **Disqualification UX** → **Explicit.** When `novelResearchReminder` is set or relevant `recentFailures` exist, prompt says: "CONFIDENT requires /quality-review first — novel-claim flag is unconsumed." Honesty over implicit blocking.
- **RED edge case** → **Accept as written.** `Confident: test fails on missing behavior X` is fine. Phase criterion is RED-shape, not RED-doneness — the model is committing to "the test is shaped right," not "the feature is done."
