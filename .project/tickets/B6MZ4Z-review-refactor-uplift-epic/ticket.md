---
id: B6MZ4Z
slug: review-refactor-uplift-epic
type: feature
phase: intake
status: done
epic: review-refactor-uplift
children:
  - D9NE6D
  - NX15EF
  - HJ38PK
  - 8PF0NT
  - 2YQJGV
created: 2026-06-18T19:25:15.624Z
last_modified: 2026-06-18T19:26:30Z
---

# Epic: Port the find→verify / disconfirm spine across safeword's reasoning skills

**Goal:** Port the _discipline_ behind Claude Code's `/code-review` and `/simplify` — generate diverse candidates → disconfirm against evidence → abstain when unsure — across safeword's reasoning skills (`quality-review`, `refactor`, `debug`, plus small `figure-it-out` and `elicit` tweaks), without importing the machinery (agent committees, voting, effort knobs) that the evidence shows underperforms here or breaks a skill's safety model. _(Folder slug + `epic:` keep the original `review-refactor` label; scope broadened 2026-06-19 — rename is optional churn.)_

**Why:** A `/figure-it-out` pass (2026-06-18) compared both safeword skills against the extracted `/code-review` + `/simplify` prompts and current LLM-review literature. The flashy patterns are net-negative for these skills; a few small, in-philosophy borrows are clearly net-positive. This epic tracks those borrows, split one sub-epic per skill.

**See:** [spec.md](./spec.md) for the full evidence record, citations, and the accept/reject rationale.

## Decision summary (figure-it-out, 2026-06-18)

**Borrow the discipline, not the machinery.** Recall is gated at _find_, not _verify_; naive multi-agent consensus can underperform the best single agent (−37.6%, Feb 2026); verification shows steep diminishing returns (~8× compute to match self-consistency). So: diversify candidate generation, gate verdicts on evidence, keep single independent reviewers.

| Sub-epic | Skill          | Scope                                                                                                                                                  | Priority   |
| -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| D9NE6D   | refactor       | Add the missing "wrong level of abstraction" smell (altitude); optional scout that emits a prioritized smell list into the existing one-at-a-time loop | High / Med |
| NX15EF   | quality-review | Gate verdicts on provenance (a blocking call needs a `verified` source); structure research as named angles; KEEP the different-model reviewer         | High / Med |

**Explicitly rejected (all skills):**

- Parallel multi-agent execution in `refactor` — breaks the ONE refactoring → TEST → COMMIT iron law.
- Efficiency/perf smells in `refactor` — behavior-adjacent, out of a behavior-preserving skill's scope.
- Effort levels (low→max) — diminishing returns; bottleneck is _find_, not _verify_.
- Consensus voting / per-claim verifier swarms in `quality-review` — underperform a single strong independent reviewer at far higher cost.

## Second-pass review findings (2026-06-18)

A third read of `/code-review`'s workflow surfaced four boundary/discipline notes — folded into the existing sub-epics, no new sub-epic needed:

- **Conventions are threaded through Scope, not a separate angle.** code-review's scope step reads CLAUDE.md for the changed files and injects "conventions a reviewer should know" into every finder/verifier. That overlaps safeword's CLAUDE.md-compliance territory → see [X4518B — native-review-overlap-positioning](../X4518B-native-review-overlap-positioning/ticket.md); position quality-review to complement native review, not duplicate it.
- **No silent caps.** Over-budget candidates are tracked (`budgetDropped`, `MAX_VERIFY=25`), never silently truncated → applied to the R2 scout (D9NE6D).
- **Evidence is schema-required.** The verifier returns `{verdict, evidence}` and "evidence must quote/cite the line" → tightened into Q1 (NX15EF).
- **Shared fragments = one source of truth.** code-review's inline + workflow paths share angle fragments; our analogue is byte-parity of the smell/gate text across Claude/Codex/Cursor copies (already in each sub-epic's done-when).

## Reasoning-skills extension (2026-06-19)

A `/figure-it-out` pass applied the same spine to safeword's other reasoning skills. Cross-cutting synthesis: **every safeword reasoning skill converges on _generate diverse candidates → disconfirm against evidence → abstain when unsure_** — `quality-review`/`refactor`/`debug` are the find→verify members; `brainstorm`/`figure-it-out` are the divergence members; and `elicit` is the convergent mirror of `debug` — it narrows _intent_-uncertainty with the most discriminating question, as `debug` narrows _cause_-uncertainty with the cheapest disconfirming test.

| Child  | Skill         | Scope                                                                                                                           | Evidence                                                                                                           | Size    |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| HJ38PK | debug         | Phase 3 single → **2–3 competing hypotheses**, test cheapest-_disconfirming_-first; log eliminations                            | consider-the-opposite (Lord 1984) + diagnostic testing; competing-hyp debugging aid (not the contested ACH matrix) | feature |
| 8PF0NT | figure-it-out | Add a one-line **premortem on the winner** (it steelmans alternatives but never disconfirms the choice)                         | premortem / devil's-advocacy meta-analysis                                                                         | task    |
| 2YQJGV | elicit        | Order questions by **expected information gain** (most-discriminating-first); **anchoring guard** on the multiple-choice format | EIG / active task disambiguation; elicitation-bias lit                                                             | task    |

**brainstorm — considered, no change.** Its existing principles ("counter the median," "diverse galleries outperform curated," "defer judgment," "batch don't parade," "amplify don't replace") already encode the validated nominal-group / defer-judgment findings. The one latent gap (generate independently before anchoring on the user's frame, then pool) is low-value; adding more would be bloat. Recorded here rather than ticketed.

## Cross-harness portability (Claude / Codex / Cursor)

All changes ship via the existing parity trio (`.claude/skills/` + Codex `.agents/skills/` + Cursor `.cursor/rules/*.mdc`). They work across all three because they are **prose instructions on the open SKILL.md standard** (Codex docs: skills "work in Claude Code, Cursor, Gemini without modification") — the repo already proves this by running in all three. Three mechanism-touchers carry authoring rules so they stay portable, **not** harness-specific variants:

- **git bisect (D4 / HJ38PK)** — write as non-interactive `git bisect run <script>`; all three have a shell, but interactive good/bad round-trips stall a headless agent.
- **subagents (quality-review reviewer loop; any R2 scout)** — phrase behaviorally with an inline fallback (quality-review's existing per-harness note is the template). Claude has Agent/Task; Cursor has subagents (≥2.5); Codex runs inline → never hard-require a subagent.
- **structured questions (elicit E1/E2)** — keep tool-neutral (options + escape as text); no `AskUserQuestion` dependency. Claude may render it as a picker; Codex/Cursor show text.

## Prose vs code (TS script) boundary

A `/figure-it-out` pass on "where should a TS script replace prose": safeword already splits **code the gate, prose the judgment** — skills shell out to `safeword <cmd>` and to `/lint`+`/audit` (eslint/tsc/knip); `parity.ts` enforces the trio. Mapping our changes:

- **Stays prose (needs a model):** R1 name-the-abstraction-smell, D1 competing hypotheses, E1 information-gain, the premortem, and the _semantic_ half of R2 (reuse, altitude).
- **Reuse existing code, don't re-implement:** R2's _mechanical_ smells → `/lint` + `/audit` (already eslint/knip); R3's enforcement → tests via `/verify`; parity → `parity.ts` (the cross-harness done-when bullets are already code-backed, not model-adherence).
- **Future code candidate, blocked today:** Q1's provenance gate is deterministic in principle, but quality-review emits conversational prose, not a machine-checkable verdict — a `safeword check` verdict-validator is only worth building if/when quality-review emits a structured verdict artifact. Deferred, not now.
- **Thin/no code value:** D4's bisect predicate is bug-specific (the model writes the `git bisect run` one-liner); git owns the harness.

Net: the current changes need **no new TS script** — reuse `/lint`+`/audit` for R2's mechanical half, keep judgment prose. The one real future script (a verdict-validator) waits on a structured artifact.

## Work Log

- 2026-06-18T19:25:15.624Z Started: Created ticket B6MZ4Z
- 2026-06-18 Scoped from `/figure-it-out`; minted sub-epics D9NE6D (refactor) + NX15EF (quality-review). Evidence + citations in spec.md.
- 2026-06-18 Second-pass `/code-review` review; folded conventions-overlap (X4518B cross-link), no-silent-caps, evidence-required, and shared-fragment notes into the sub-epics.
- 2026-06-19 `/figure-it-out` reasoning-skills pass; broadened scope; added HJ38PK (debug) + 8PF0NT (figure-it-out premortem); recorded brainstorm as considered-no-change.
- 2026-06-19 Added 2YQJGV (elicit: information-gain ordering + anchoring guard) after the elicit follow-on — the convergent mirror of debug.
- 2026-06-19 `/figure-it-out` cross-harness check (Claude/Codex/Cursor): verified Codex SKILL.md skills (Dec 2025) + Cursor subagents (≥2.5) + shells everywhere. All changes portable as prose; added the Cross-harness section + git-bisect-run (HJ38PK) and tool-neutral-questions (2YQJGV) done-when guards. No harness variants.
- 2026-06-19 `/figure-it-out` prose-vs-code pass: added the Prose-vs-code boundary section; sharpened D9NE6D R2 to reuse `/lint`+`/audit` for mechanical smells (don't re-implement detection). Conclusion: no new TS script needed now; verdict-validator deferred until a structured verdict artifact exists.
