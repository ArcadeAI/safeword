# Product Plan: YOLO mode

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Safeword hands control back to the builder at every deliberative pause — each Clarify question, each intake sub-phase gate, each design fork. For a builder who wants an unattended run (overnight, a batch of low-stakes tickets, a two-way-door refactor), every pause is a stall with nobody there to answer it. The evidence that this is overdue is not a demand guess, it is drift already shipped: three template surfaces (`skills/bdd/DISCOVERY.md` in three places, `guides/cold-start-check.md`, and their `.claude/`/`plugin/`/`codex-plugin/` mirrors) instruct agents on what to do "under YOLO mode", two test files (`discovery-subphase-gates.test.ts:41`, `cold-start-check.test.ts:64`) assert that prose exists, and six tickets (2VCSZY, DZ2NM5, 3KKPWJ, B0JZQN, H7M3KQ, BHK9PW) reference YOLO as an existing premise — while `grep -rn "yolo" packages/cli/src/` returns nothing. Safeword currently ships instructions for a mode that cannot be switched on, and the tests are green because they check for words, not behavior.
- **Expected outcome:** A builder can mark a ticket YOLO and walk away; the agent resolves ordinary ambiguity itself and finishes the ticket, stopping only for the things that are genuinely expensive to get wrong. Every decision it made alone is reconstructable afterward from the ticket work log.
- **Success threshold:** A representative two-way-door ticket, marked YOLO at intake, reaches `phase: verify` with zero user turns other than denylist confirmations and the hard gates — and a reviewer who was not present can name, for every autonomous decision, the question, the options weighed, the pick, and why. Falsified if an unattended run either stalls waiting for a human on a non-denylist pause, or reaches verify with decisions that leave no trace.
- **Project non-goals:** Session-level or env-var activation (`SAFEWORD_YOLO=1`); project-level config (per-user only for v1); auto-creating a ticket when `/yolo` runs without one; time-boxed activation (`--yolo 30m`); gradient autonomy levels (light/standard/reckless); YOLO marking a ticket done on its own; a separate `yolo-decisions.md` artifact; cost-ceiling enforcement (deferred to v2); weakening any hard gate.

## Jobs To Be Done

### yolo-mode.TBU1 — Hand off a ticket and get it finished

**Persona:** Technical Builder (TBU)

> When I have a bounded, reversible ticket and no appetite to sit through its pauses, I want to mark it autonomous and leave, so I can come back to finished work instead of an agent parked on a question I would have waved through anyway.

### yolo-mode.TBU2 — Trust an unattended run by auditing it afterward

**Persona:** Technical Builder (TBU)

> When I come back to a run that made its own calls while I was away, I want each of those calls written down with its reasoning, so I can accept the work or spot the wrong turn without replaying the session.

### yolo-mode.TBU3 — Keep autonomy away from the actions I can't take back

**Persona:** Technical Builder (TBU)

> When I let the agent run unattended, I want it to still stop at anything destructive or externally visible, so hands-off means unsupervised deliberation and never an unsupervised force-push, deletion, or message sent under my name.

### yolo-mode.SWM1 — Ship one autonomy contract the whole toolchain agrees on

**Persona:** Safeword Maintainer (SWM)

> When a skill, guide, or gate says "under YOLO mode", I want exactly one mechanism behind that phrase across Claude Code, Cursor, and Codex, so autonomy behaves the same on every host instead of meaning whatever each document happened to assume.

## Open Questions

<!-- Unit 1 (Product Bet + jobs) presented for confirmation; Rules, Shape, and Killer Demo follow after. -->
