---
id: 3KKPWJ
slug: cold-start-executability-test
type: feature
phase: intake
status: in_progress
epic: pm-grade-intake
parent: '169'
created: 2026-06-23T02:43:49.732Z
last_modified: 2026-06-23T02:43:49.732Z
---

# Cold-start executability test for high-blast intake

**Goal:** For irreversible (one-way-door) features, offer a heavyweight sufficiency check at the Intake Exit step — spawn a context-free sub-agent given only the spec + repo (no conversation) and report whether a cold agent could plan it end-to-end, surfacing the gaps it couldn't reconstruct as Open Questions.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Decision (from two /figure-it-out passes)

The sharpest sufficiency oracle in epic 169: strip the "I already know what they meant from chat" crutch and see if the captured context stands alone. Heavyweight (spawns an agent), so reserved for one-way-door work — the occasional deep check complementing TPP6Y2's every-turn pointer and NWFT20's rung-0 reversibility read. GitHub issue #329.

**Design pass (3 coupled decisions):**

- **Trigger** — reuse NWFT20's brief reversibility field. The DISCOVERY intake-exit step _offers_ the check (opt-in, like replan-on-resume) **iff** reversibility reads one-way-door (or cross-cutting: data model / public API / migration). Fires once at the gate, off the captured signal — never an every-turn hook nudge, never an auto-spawn. Explicit user invocation stays first-class.
- **Inputs** — the fresh `isolation: worktree` sub-agent gets the captured context (ticket + spec) **plus the repo**, and **zero conversation history**. Executability needs the codebase; the conversation is the crutch being removed.
- **Verdict force** — **advisory**. Output is "a cold agent couldn't determine X/Y/Z," written into `spec.md`'s `## Open Questions` and surfaced at the intake-exit gate. Not a fail-closed hook, not an action-time blocker — self-judged signals are too noisy to fail closed on (LLM-as-judge FP 60–90% adversarial), and it matches every epic-169 piece's advisory philosophy.

**Evidence:** context-sufficiency = producible-solution-from-context, validated at intake-exit before code-gen; self-verification over-trusts own output (needs no-context-bleed judge); Value-of-Information triggers on Task Risk; over-asking erodes trust (fire once, opt-in).

**Reuse, not new mechanism:** a skill wrapping the existing `isolation: worktree` spawn + a DISCOVERY.md rung. No new gate, no new hook.

**Premortem:** fails if one-way-door is judged too liberally → nag fatigue, or if it's so rarely triggered it rots. Mitigations: offer gated on the brief's explicit reversibility field; near-zero build cost; manual invocation first-class.

## Work Log

- 2026-06-23T02:43:49.732Z Started: Created ticket 3KKPWJ
- 2026-06-23T02:44Z Scoped from #329 + two /figure-it-out passes (design: trigger/inputs/verdict; trigger: conditional intake-exit offer keyed on brief, not a hook). Scope call: build now, lean (reuse harness, advisory, no new infra). Ready to run /bdd.
- 2026-06-23T03:47Z JTBD gate: confirmed feature (TB1 + NTB1). /quality-review (intake) via independent reviewer → NEEDS DISCUSSION, 4 criticals, all resolved in spec:
  - **Build vs predict** (the central ambiguity): cold agent **plans** the work, not a full build; "could execute" = plan end-to-end without guessing at intent/constraints. Cheapest test — gaps surface in planning.
  - **Trigger location**: offer fires at the **Intake Exit (REQUIRED) step**, not a nonexistent "intake-exit gate"; reversibility is confirmed at the JTBD gate (NWFT20), the offer fires at exit.
  - **YOLO (G2E72G)**: offer auto-accepts, runs, logs the auto-decision, never blocks.
  - **Sub-agent error/timeout**: noted one line + proceed, no gap/no block (folded into NTB1.AC3, mirrors SAFEWORD.md:36).
  - Hardened NTB1.AC1 to key off the **recorded** Reversibility field (mitigates the premortem's liberal-judgment risk). Made the output-discipline divergence a conscious call: this writes to Open Questions (vs replan's chat-only) because that is intake's drained sink. NTB1.AC2 (presentation) vs TB1.AC2 (persistence) sharpened to avoid duplicate scenarios.
- 2026-06-23T03:49Z /quality-review re-review (fresh independent reviewer) → **APPROVE**, 0 criticals; all four resolutions confirmed consistent. Carry-forward into define-behavior: under YOLO the check auto-appends gaps to Open Questions, but the Intake Exit gate requires Open Questions empty/`defer:`'d — write a scenario pinning how auto-generated gaps reconcile with an auto-confirming exit (become `defer:`, or the one case where YOLO exit legitimately waits).
