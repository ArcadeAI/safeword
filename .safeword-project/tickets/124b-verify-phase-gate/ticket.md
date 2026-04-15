---
id: 124b
type: feature
phase: done
status: done
created: 2026-04-15T14:12:00Z
last_modified: 2026-04-15T18:12:00Z
scope:
  - Add verify phase to BDD flow between implement and done
  - 'New VERIFY.md skill file: cross-scenario refactor + /verify + /audit, writes verify.md artifact'
  - 'Prompt hook: add verify reminder, simplify done reminder'
  - 'Stop hook done gate: check verify.md artifact existence (replace text-pattern matching for audit/scenarios), keep direct runTests()'
  - '/verify skill: write output to {ticket-folder}/verify.md'
  - 'SKILL.md: add verify to phase table + resume logic'
  - 'DONE.md: simplify to just close (verify steps moved out)'
  - 'verify.md artifact includes timestamp for staleness detection'
  - 'Done prompt reminder simplified: "Phase: done. Close ticket (verify.md exists)."'
out_of_scope:
  - Pre-tool gate on phase transitions (fragile — requires parsing edit content)
  - Changing how /audit works (separate concern)
  - Conditional phase skipping for tasks (both features and tasks go through verify)
  - Retroactive verification of existing done tickets
done_when:
  - Phase list includes verify between implement and done
  - Prompt hook shows verify-specific reminder
  - /verify writes verify.md artifact to ticket folder
  - Stop hook hard-blocks phase done when verify.md is missing
  - Done phase is trivial (just close ticket, no evidence collection)
  - Existing tests pass + new tests for verify.md gate
---

# Add verify phase — done means done

**Goal:** Split the overloaded `done` phase into `verify` (run evidence gates) and `done` (ticket closed). Prevents agents from skipping /verify + /audit by jumping straight to done.

**Origin:** Process audit of ticket #124. Agent set `phase: done` without running /verify or /audit. The stop hook's done gate didn't catch it because the phase transition and completion declaration happened in a single turn.

## Design Decisions

1. **Agent-driven transition** — agent sets `phase: verify` manually (same as all other transitions)
2. **Single artifact gate** — `verify.md` in ticket folder gates done (replaces fragile text-pattern matching)
3. **Both features and tasks** go through verify (/verify already skips irrelevant checks)
4. **Direct test execution kept** — stop hook keeps `runTests()` at done (authoritative, can't be gamed) + verify.md existence check
5. **Done becomes trivial** — just close ticket (set status/phase, update parent epic, final commit)

## Files Changed

| File                                               | Change                                        |
| -------------------------------------------------- | --------------------------------------------- |
| `.claude/skills/bdd/SKILL.md`                      | Add verify to phase table + resume logic      |
| `.claude/skills/bdd/DONE.md`                       | Simplify to just close                        |
| `.claude/skills/bdd/VERIFY.md`                     | New — Phase 7 verification steps              |
| `packages/cli/templates/hooks/prompt-questions.ts` | Add verify reminder, simplify done            |
| `packages/cli/templates/hooks/stop-quality.ts`     | Done gate checks verify.md + keeps runTests() |
| `.claude/skills/verify/SKILL.md`                   | Write output to ticket-folder/verify.md       |
| Tests                                              | New tests for verify.md artifact gate         |

## Work Log

- 2026-04-15T14:12:00Z Created: from process audit of #124 — agent skipped Phase 7 (done gate) because no hard gate prevented the transition
- 2026-04-15T18:12:00Z Complete: Phase 0-2 — Understanding converged. 7 design decisions resolved. Scope established as feature (7 files, new phase + artifact gate).
- 2026-04-15T18:15:00Z Complete: Phase 3 — 8 scenarios defined across 4 rules. Self-reviewed AODI: removed 2 redundant scenarios, added empty verify.md edge case, reclassified phase table check as static verification.
- 2026-04-15T21:52:00Z Complete: Phase 4 — AODI validated, adversarial pass clean, /quality-review approved. Skipping decomposition (architecture clear from file list). Starting implement.
- 2026-04-15T22:43:00Z Complete: Phase 6 — All 8 scenarios implemented. 132/132 tests pass. Existing done gate tests updated (7 in hooks.test.ts).
- 2026-04-15T23:06:00Z Complete: Phase 7 — /verify passed (132/132 tests, build, lint, 30/30 checkboxes), cross-scenario refactor done (setupDoneTicket helper), verify.md written. Learning captured (instruction-attention-hierarchy.md).
- 2026-04-15T23:06:00Z Complete: Phase 8 — Ticket closed.
