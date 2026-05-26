---
id: H7M3KQ
slug: tdd-discipline-guardrails
title: 'Investigate + address per-scenario TDD discipline bypass'
type: feature
phase: intake
status: in_progress
created: 2026-05-26T06:04:03.068Z
last_modified: 2026-05-26T06:04:03.068Z
---

# Investigate + address per-scenario TDD discipline bypass

**Goal:** Investigate the root causes that let an agent in good faith batch 31 scenarios' worth of implementation without doing per-scenario RED → GREEN → REFACTOR, and ship concrete guardrails that prevent it.

**Why:** Discovered during [7YN5QB](../7YN5QB/ticket.md) implementation (2026-05-26). The agent wrote 77 unit + integration tests across 5 slices, all passing, all lint-clean — but never ran a per-scenario R/G/R cycle. All 31 R/G/R checkboxes in `test-definitions.md` remained unchecked through commit. The session was "successful" by correctness metrics (tests green, behavior matches spec) but failed the TDD-discipline contract that safeword's bdd skill is meant to enforce. The same pattern likely happens in other autonomous-mode sessions.

**Discovered while:** running 7YN5QB in `full-ticket` autonomous mode after the user asked "did you run the per-scenario refactors?" and the agent had to honestly answer "no."

## Five guardrail failures to investigate

Each gets a documented root cause + a concrete fix.

### F1 — Skill phase-routing bypass

When the agent transitions ticket frontmatter to `phase: implement`, the bdd orchestrator ([SKILL.md](../../../.claude/skills/bdd/SKILL.md)) maps that to `TDD.md` as the phase file. The agent never re-read TDD.md when entering implement — it jumped straight to writing code. Investigation: why doesn't entering `implement` automatically surface TDD.md content? Is there a missing prompt-hook injection on phase transition?

### F2 — R/G/R checkbox hook contract failure

[test-definitions.md](../7YN5QB/test-definitions.md) header asserts: "R/G/R checkboxes are load-bearing — the prompt hook parses them during Phase 6 to inject per-scenario TDD-step guidance." During 7YN5QB's implementation, no per-scenario guidance ever surfaced in prompt-hook output. Investigation: is the parser wired up? Does it need at least one checked box to start the loop (in which case the cold-start case is broken)? Is the injection happening but invisible? Does the hook live in `.safeword/hooks/` and what does it actually do?

### F3 — Phase-name prompt injection too thin

The UserPromptSubmit hook injects `- Phase: implement.` per turn. That's accurate but doesn't reference R/G/R discipline. A discipline-aware version would say "Phase: implement — find first unchecked RED in test-definitions.md before writing code." Investigation: where does the phase-name string get composed? Can it be enriched with the next-action signal? Cost/risk of adding scenario-state lookup to every prompt-hook turn.

### F4 — Missing pre-Edit gate on TDD state

The LOC gate blocks Edits after ~400 LOC since last commit. An equivalent gate for TDD state (refuse Edit to source files when no scenario is in `[x] RED [ ] GREEN [ ] REFACTOR` state) would have stopped the bypass on the first slice. Investigation: scope of such a hook (which source files to gate? what's the bypass mechanism for non-TDD work like refactors-of-existing-code? how do scenarios across multiple test-definitions.md files interact?).

### F5 — Missing scenario-aware TaskCreate prompt

The TaskCreate reminder hook fired 8+ times during 7YN5QB but the message is generic. A scenario-aware version would say "31 scenarios in test-definitions.md, 0 in your task list — create one task per scenario × R/G/R before continuing." Investigation: how to detect that the agent is in implement phase with an active test-definitions.md, and surface that-specific prompt.

## Related work

- **Ticket 172** (phase-step enforcement) — referenced in [DZ2NM5](../DZ2NM5/ticket.md)'s Related section as complementary work. H7M3KQ may overlap with 172's scope; first investigation step is to read 172 and decide whether H7M3KQ rolls into it or stands alone.
- [7YN5QB](../7YN5QB/ticket.md) — the dogfood case that surfaced the gap. Its retroactive cross-scenario refactor + checkbox-marking is part of slice work, not part of H7M3KQ.

## Scope

- Investigate each of F1–F5 with concrete evidence (read hook source code, trace prompt-hook injection paths, reproduce missing signals in a sandbox session if practical).
- Document each root cause in a Findings section before designing fixes.
- Ship fixes for at least F1, F2, F3 (the cheap-to-fix routing/injection gaps). F4 and F5 may need their own follow-up tickets if the design space is large.
- Add tests that catch a regression — e.g., a fixture ticket with unchecked scenarios should trigger the per-scenario guidance prompt in a session.
- Update SAFEWORD.md or bdd guide content if the discipline gap suggests our docs are misleading.

## Out of scope

- Reworking 7YN5QB itself — it shipped under the old (batched) flow; the retroactive REFACTOR pass + checkbox marking happens there, not here.
- Replacing the bdd skill's R/G/R model with a different discipline (e.g., property-based testing, scenario outlines). This ticket assumes R/G/R per scenario is the contract and fixes its enforcement.
- Cross-tool sync with arcade's TDD discipline (different model — Arcade uses `/codify-spec` for test emission, not per-scenario R/G/R). Tracked in [P8RJ4M](../P8RJ4M/ticket.md).

## Open questions

- **Overlap with ticket 172** — does H7M3KQ subsume 172, fold into 172, or stand parallel? Investigation step 1.
- **Should the pre-Edit gate (F4) be configurable?** Some users may want batched implementation for tight loops; YOLO mode (G2E72G) likely should auto-skip the gate.
- **Is the missing R/G/R hook (F2) a wiring bug or a design gap?** If wiring, simple fix. If design, may require new tracking state in `.safeword/quality-state-*.json`.
- **What's the right unit of guidance injection — one scenario at a time or the next 3?** Injecting too much eats context budget; too little forces re-lookup. Default lean: one at a time with a "next-up" reference.

## Done when

- Findings documented for each of F1–F5 with concrete root cause (or "not actually a gap" if investigation rules one out).
- At least F1, F2, F3 have shipped fixes that are verified via a sandbox test (an agent session that's deliberately steered into the bypass pattern and gets caught by the new guardrail).
- F4 and F5 either ship a fix in this ticket or are extracted to their own standalone follow-up tickets with documented rationale.
- bdd skill content (SAFEWORD.md / TDD.md / DISCOVERY.md / SKILL.md) audited for any misleading claims about hook-enforced discipline; updates land if the discipline doc-promised but didn't deliver.
- A regression test fixture demonstrates an agent session being blocked from a batched-implementation pattern.

## Work Log

- 2026-05-26T06:04:03.068Z Started: Created ticket H7M3KQ. Standalone, not a child of any epic. Surfaced after 7YN5QB implementation closed without per-scenario R/G/R discipline despite the bdd skill claiming to enforce it. Five distinct failure modes catalogued (skill routing, R/G/R hook contract, prompt injection thinness, missing pre-Edit gate, missing scenario-aware TaskCreate).
