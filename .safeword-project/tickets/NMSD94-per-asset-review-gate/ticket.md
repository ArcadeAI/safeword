---
id: NMSD94
slug: per-asset-review-gate
type: feature
phase: intake
status: backlog
created: 2026-06-03T03:23:27.177Z
last_modified: 2026-06-03T04:01:00.000Z
---

# Two-tier review enforcement: per-asset inline stamp + phase-exit independent review

**Goal:** Make "work is reviewed before it's built on" enforceable, at two tiers: a **cheap per-asset inline review stamp** (early catch, before the next asset is poured on a flawed one) and an **independent fresh-agent review at each phase exit** (catches what self-review misses). Close the demonstrated gap — review is under-triggered unless the user manually prompts it — without a fresh sub-agent firing on every artifact.

**Why (revalidated + reshaped 2026-06-03):** Two `/figure-it-out` passes against the code:

1. The filed per-asset A→C scope conflated two independent knobs — _how often_ you review (per-asset vs per-phase) and _who_ reviews (the same agent inline = cheap, vs a fresh sub-agent = independent but a full spin-up each time). Only the **fresh-sub-agent-per-asset** combination is expensive; per-asset review _itself_ is cheap if done inline + stamped (the same model as the TDD per-step SHA ledger, which already stamps every step).
2. Dropping per-asset entirely (the earlier phase-exit-only reshape) lost the early-catch property the user actually wants: a weak goal shouldn't be reviewable only _after_ its ACs are already built. So keep per-asset — just make the stamp cheap (inline), and reserve the costly independent reviewer for phase boundaries.

Evidence the gap is real: this session needed the user to manually prompt `/quality-review` three times, each finding genuine defects.

**Scope (two tiers + a coverage gate):**

- **Tier 1 — per-asset inline review stamp (cheap, early-catch).** Each Phase-0 asset (JTBD set → ACs → scope/out*of_scope/done_when → scenarios) and each TDD step gets an inline self-review against a short checklist, recording a stamp. A PreToolUse gate denies authoring asset N+1 until asset N carries a stamp. Model = the TDD SHA-per-step ledger, generalized to assets. **Honest limit:** an inline self-review stamp proves the agent \_paused and reviewed*, not that the review was correct or even genuine (it's gameable — the agent can stamp without truly reviewing). It raises the floor; it is not the strong check.
- **Tier 2 — independent review at each phase exit (strong, amortized).** A `context: fork` reviewer (fresh agent, no conversation history, can't grade its own work) runs once per phase boundary and logs a verdict stamp, reusing the existing `skill-invocation-log` + done-gate pattern (which already requires `verify ✓` + `audit ✓` at done). The phase-advance gate blocks until the stamp exists. This is the ungameable check that backstops Tier 1's gameable one.
- **Coverage gate (trial).** Promote the deliberately-advisory AC↔scenario coverage check (`scenario-coverage.ts`, currently zero-exit) to a **skippable** blocking gate (deny on uncovered ACs / orphan scenarios, `skip: <reason>` escape); measure alert-to-action before making it permanent.

**Out of scope:**

- A fresh **sub-agent per asset** — the cost trap. Independence is bought once per phase (Tier 2), not per asset.
- Faking-proof inline review — Tier 1 is a deliberate cheap floor; Tier 2 is where genuine independent scrutiny lives. Don't over-engineer Tier 1 to be ungameable.

**Done when:**

- Authoring an asset is blocked until the prior asset carries an inline review stamp (Tier 1), with a skip valve.
- Advancing a phase is blocked until an independent (`context: fork`) review stamp for that phase exists (Tier 2), reusing the skill-invocation-log mechanism.
- The AC-coverage trial gate blocks uncovered-AC/orphan-scenario test-definitions with a measured alert-to-action ratio (per the 153 alert-fatigue lesson) + skip valve.
- No fresh sub-agent fires per asset; `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity green.

**Open design questions for `/bdd` intake:**

- What's the concrete inline stamp surface for a Phase-0 asset (it has no R/G/R checkbox like TDD) — a frontmatter field, a review-ledger line, or a checkbox in the artifact?
- Tier-1 stamp gameability vs. friction — is the cheap floor worth it, or does Tier 2 alone suffice? (Resolve with the alert-to-action measurement.)

**Note:** Feature — run `/bdd` when picked up. Consider splitting the three pieces (Tier 1, Tier 2, coverage gate) into children at scenario-gate if scope proves large.

## Work Log

- 2026-06-03T04:01:00.000Z **Reshaped to the two-tier hybrid** (user accepted). Restored per-asset review (cheap inline stamp, the early-catch the original ticket wanted) after recognizing the cost trap was the fresh-sub-agent-per-asset combination, not per-asset granularity. Independent fresh-agent review kept but moved to phase exits only (amortized). Honest limit recorded: Tier 1 inline stamp is gameable (a floor), Tier 2 fork review is the strong backstop.
- 2026-06-03T03:45:00.000Z Reshaped to phase-exit-only stamp (superseded above — it dropped the per-asset early-catch the user wanted). Original per-asset A→C scope rejected: A redundant with the existing intake-exit gate, C (fork-per-asset) over-cost.
- 2026-06-03T03:23:27.177Z Started: Created ticket NMSD94 (follow-up from the CC/Opus/skills research workflow).
