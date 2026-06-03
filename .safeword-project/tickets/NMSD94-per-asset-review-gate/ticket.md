---
id: NMSD94
slug: per-asset-review-gate
type: feature
phase: intake
status: backlog
created: 2026-06-03T03:23:27.177Z
last_modified: 2026-06-03T03:23:27.177Z
---

# Per-asset review gate for Phase 0 + TDD (ledger model)

**Goal:** Make "each asset/step is reviewed before the next is authored" a HARD gate, not a soft prompt — closing the enforcement gap where safeword hard-gates phase _boundaries_ but leaves intra-phase step order and per-asset quality-review to agent compliance.

**Why:** Analysis this session + live-docs research (workflow `wf_c57312ee-82c`, 2026-06-03). Today only the boundary gates are deterministic; the per-asset (Phase 0: JTBD → ACs → scope/out*of_scope/done_when → scenarios) and per-step (TDD R/G/R) \_review* discipline rides on prompt injections. The TDD SHA-or-skip ledger already proves the ledger/gate pattern works for proof-of-work; this extends it to **quality**. Opus 4.8 is more reliable but vendor-stated + effort-coupled ("fewer/less likely", never "never") — gates still cover the residual, which is safeword's whole thesis.

**Scope (staged — ship A first, then C):**

- **A — widen the PreToolUse gate from per-phase to per-asset (existence/structure).** Deny the Write that creates `test-definitions.md` scenarios unless `scope`/`out_of_scope`/`done_when` are present and non-trivial; deny frontmatter authoring unless ACs exist; etc. Reuse `safeword check`'s lineage validation (uncovered ACs / orphan scenarios). Deterministic, model-independent, uses machinery safeword already owns. Mirrors the ecosystem's TDD-Guard pattern one rung finer.
- **C — add the quality layer A structurally can't do.** A `context: fork` reviewer skill (isolated subagent — doesn't grade its own work) emits a verdict artifact per asset (e.g. `.review/<asset>.pass`); the PreToolUse gate blocks the next asset's Write until that artifact exists and reads `pass`. This realizes the **plan-validate-execute** best practice (verified, Claude Code skills docs) as enforcement: reviewer = validator, hook = gate.

**Out of scope:**

- **Option D** (lean on Opus 4.8 + sharper prompts as the _strategy_) — rejected: converts safeword's core value into a bet on vendor-stated, effort-coupled reliability. (The one good point — trimming force-it padding — is split to B1TWX7.)
- **Dynamic Workflows** as the mechanism — preview-only, docs 404, token-heavy; not for a shipped plugin.
- Rebuilding the TDD SHA-or-skip ledger — it already exists; extend the _concept_, don't replace it.
- Tuning Phase 0's asset _order_ itself (that's the existing workflow).

**Design constraint (verified):** an invoked `SKILL.md` stays resident and is NOT re-read per turn — so the per-asset reviewer must be a `context: fork` invocation or a hook-driven external script, never a "re-read the skill each step" assumption.

**Done when:**

- Authoring asset N+1 is blocked until asset N passes its structural lineage check (A) — out-of-order/empty intermediate assets are denied at the Write, with a clear reason.
- A `context: fork` reviewer's verdict artifact gates the next asset (C); a missing/`fail` verdict blocks, a `pass` allows.
- The gate's alert-to-action ratio stays high (fires on genuine gaps, not legitimate authoring) — explicitly measured, per the alert-fatigue lesson from ticket 153.
- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity green.

**Note:** This is a feature — run `/bdd` when picked up (multiple components + new gate state + the fork-reviewer flow). Consider splitting A and C into child tickets at scenario-gate if the scope proves large.

## Work Log

- 2026-06-03T03:23:27.177Z Started: Created ticket NMSD94 (follow-up from the CC/Opus/skills research workflow — staged Option A→C recommendation).
