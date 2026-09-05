# Product Plan: AFK mode

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Safeword hands control back to the builder at every deliberative pause — each Clarify question, each intake sub-phase gate, each design fork. For a builder who wants an unattended run (overnight, a batch of low-stakes tickets, a two-way-door refactor), every pause is a stall with nobody there to answer it. The evidence that this is overdue is not a demand guess, it is drift already shipped: three template surfaces (`skills/bdd/DISCOVERY.md`, `guides/cold-start-check.md`, and their `.claude/`/`plugin/`/`codex-plugin/` mirrors) instruct agents on what to do "under YOLO mode", two test files (`discovery-subphase-gates.test.ts:41`, `cold-start-check.test.ts:64`) assert that prose exists, and six tickets (2VCSZY, DZ2NM5, 3KKPWJ, B0JZQN, H7M3KQ, BHK9PW) reference the mode as an existing premise — while `grep -rn "yolo" packages/cli/src/` returns nothing. Safeword ships instructions for a mode that cannot be switched on, and the tests are green because they check for words, not behavior.
- **Expected outcome:** A builder can mark a ticket AFK and walk away; the agent resolves ordinary ambiguity itself and finishes the ticket, stopping only for the things that are genuinely expensive to get wrong. Every decision it made alone is reconstructable afterward from the ticket work log.
- **Success threshold:** A representative two-way-door ticket, marked AFK at intake, reaches `phase: verify` with zero user turns other than denylist confirmations and the hard gates — and a reviewer who was not present can name, for every autonomous decision, the question, the options weighed, the pick, and why. Falsified if an unattended run either stalls waiting for a human on a non-denylist pause, or reaches verify with decisions that leave no trace.
- **Project non-goals:** Session-level or env-var activation (`SAFEWORD_AFK=1`); project-level config (per-user only for v1); auto-creating a ticket when `/afk` runs without one; time-boxed activation (`--afk 30m`); gradient autonomy levels (light/standard/reckless); AFK marking a ticket done on its own; a separate decisions artifact; cost-ceiling enforcement (deferred to v2); weakening any hard gate; tool-permission bypass of any kind — AFK removes deliberative pauses, never tool confirmations.

## Jobs To Be Done

### afk-mode.TBU1 — Hand off a ticket and get it finished

**Persona:** Technical Builder (TBU)

> When I have a bounded, reversible ticket and no appetite to sit through its pauses, I want to mark it autonomous and leave, so I can come back to finished work instead of an agent parked on a question I would have waved through anyway.

#### afk-mode.TBU1.R1 — A routine confirmation continues without a user turn

When AFK is active and the agent reaches a pause whose answer it already holds — an artifact is drafted and the question is "shall I proceed?" — the run continues without waiting for a human. The pause is a checkpoint, not a decision, and unattended work does not stall on checkpoints.

#### afk-mode.TBU1.R2 — A genuine fork is resolved by research, not by a default

When AFK is active and the agent reaches a pause where the outcome actually depends on the answer, it resolves the fork through `/figure-it-out` and proceeds on that result. It never proceeds on an unexamined default: the distinguishing property of an AFK run is that walking away downgrades nobody's reasoning, only their presence.

#### afk-mode.TBU1.R3 — Activation is explicit, scoped, and refuses to guess

AFK becomes active only through a deliberate act: `/afk` toggling the mode on the active ticket, or a per-user config default. `/afk` with no active ticket fails with a plain-language error rather than inventing a target — the mode is never inferred from context.

### afk-mode.TBU2 — Trust an unattended run by auditing it afterward

**Persona:** Technical Builder (TBU)

> When I come back to a run that made its own calls while I was away, I want each of those calls written down with its reasoning, so I can accept the work or spot the wrong turn without replaying the session.

#### afk-mode.TBU2.R1 — Every resolved fork is recorded with its reasoning

Each fork the agent resolves alone lands in the ticket work log carrying the question, the options considered, the pick, and why. A recorded outcome without its reasoning does not satisfy this: the log has to let a reader disagree with the choice, not merely observe it.

#### afk-mode.TBU2.R2 — Every auto-continued pause records why it was routine

Each pause the agent continues past under TBU1.R1 records one line naming what made it routine. This is what makes classification drift observable: if forks start being waved through as checkpoints, the log says so in the builder's own reading, rather than the distinction quietly decaying into "continue everything".

### afk-mode.TBU3 — Keep autonomy away from the actions I can't take back

**Persona:** Technical Builder (TBU)

> When I let the agent run unattended, I want it to still stop at anything destructive or externally visible, so hands-off means unsupervised deliberation and never an unsupervised force-push, deletion, or message sent under my name.

#### afk-mode.TBU3.R1 — Irreversible actions stop for a human, enforced structurally

Under AFK, a denylisted action — history rewrite or force-push, branch deletion or hard reset, sending an external message, file deletion outside the ticket folder, marking a ticket done, touching production config or secrets — halts for explicit human confirmation. The halt is enforced at a blockable lifecycle boundary, not by instructions in a skill: guidance the agent can reason past is not a boundary, and a mode built to reduce human turns must not depend on the agent volunteering one.

#### afk-mode.TBU3.R2 — Hard gates fire unchanged under AFK

The LOC commit gate, the done gate, and the verify-artifact requirement behave under AFK exactly as they do in an attended session. AFK removes deliberative pauses; it never removes protective ones.

#### afk-mode.TBU3.R3 — A failed fork resolution stops rather than guesses

When the fork-resolution step errors or times out, the run halts and asks the builder instead of proceeding on a default. An advisory check may fail open because its absence costs nothing; this step *is* the decision procedure, so proceeding without it would be exactly the unexamined default TBU1.R2 forbids.

#### afk-mode.TBU3.R4 — An active AFK run is impossible to mistake for an attended one

Whenever AFK is active, the builder can tell from at least two independent places — the ticket's own state and an announcement at the start of the run. A mode that a saved preference can switch on without the builder choosing it this session is otherwise indistinguishable from an attended session until something irreversible is already underway.

### afk-mode.SWM1 — Ship one autonomy contract the whole toolchain agrees on

**Persona:** Safeword Maintainer (SWM)

> When a skill, guide, or gate says the agent is running unattended, I want exactly one mechanism behind that phrase across Claude Code, Cursor, and Codex, so autonomy behaves the same on every host instead of meaning whatever each document happened to assume.

#### afk-mode.SWM1.R1 — One mode, one name, identical across hosts

Every shipped surface that describes unattended behavior names the same mode and the same three pause classes, and behaves identically on Claude Code, Cursor, and Codex. No surface may describe autonomy the mechanism does not implement — the drift that produced this ticket is itself the invariant being closed.

## Shape

### M1 — The protective floor

- **Outcome:** The denylist is enforced at a blockable lifecycle boundary and the hard gates are demonstrably intact under autonomy, before any switch exists to turn autonomy on.
- **Non-goals:** Activation, classification, decision logging — nothing that lets a run go unattended yet.

### M2 — Unattended runs with a decision trail

- **Outcome:** `/afk` and the per-user default activate the mode; routine pauses continue with a one-line reason, forks resolve through `/figure-it-out` and record question/options/pick/rationale, failures stop and ask, and the active mode announces itself.
- **Non-goals:** Cross-host parity, reconciling the already-shipped prose.

### M3 — One contract on every host

- **Outcome:** Claude Code, Cursor, and Codex surfaces describe and implement the same mode under the same name, with the stale YOLO prose reconciled and parity enforced by test.
- **Non-goals:** Cost ceiling (v2), gradient autonomy levels.

## Killer Demo

- **Audience:** Technical Builder (TBU)
- **Starting state:** A bounded, two-way-door ticket sits at intake at the end of the day. The builder has a dozen small decisions ahead of them and no intention of staying up for any of them.
- **Action:** `/afk`, then close the laptop.
- **Payoff:** By morning the ticket is at `verify`, and the work log reads as a decision record rather than a transcript — each fork with its options and reasoning, each routine continue with the one line that justifies it, and one entry where the run stopped and waited because it wanted to delete a branch.
- **Proof:** The session shows no user turns between `/afk` and the denylist stop; a reviewer who was asleep for all of it can point at any decision in the log and say what was chosen and why.
- **Boundary:** This demonstrates that the decisions were bounded, made, and recorded — not that they were the decisions the builder would have made. Judging the calls is what the morning review is for.

## Open Questions

<!-- Cost ceiling deferred to v2 (recorded as a project non-goal). /figure-it-out failure mode resolved: fail closed (TBU3.R3). -->
