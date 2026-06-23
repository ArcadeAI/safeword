---
id: 3KKPWJ
slug: cold-start-executability-test
type: feature
phase: verify
status: in_progress
epic: pm-grade-intake
parent: '169'
created: 2026-06-23T02:43:49.732Z
last_modified: 2026-06-23T02:43:49.732Z
scope:
  - A cold-start-check skill that spawns a context-free `isolation: worktree` sub-agent (ticket + spec + repo, no conversation), has it attempt to plan the work, and returns a sufficient/insufficient verdict with named gaps
  - A DISCOVERY.md Intake Exit step that offers the check when the brief's recorded Reversibility reads one-way-door/cross-cutting (auto-accepts and logs the auto-decision under YOLO)
  - Render the verdict in plain language with a next action; append the named gaps to `spec.md`'s `## Open Questions`
  - Advisory throughout — never blocks; a sub-agent error/timeout is noted in one line and skipped
  - Template→dogfood parity sync and scenarios
out_of_scope:
  - A full TDD build by the cold agent (plan-depth only — gaps surface in planning)
  - Any hook-enforced gate or fail-closed block on the verdict
  - A new every-turn nudge (TPP6Y2 owns that) or new reversibility capture (NWFT20 owns that)
  - Auto-resolving the surfaced gaps (intake's existing exit discipline drains them)
done_when:
  - On a feature whose brief records one-way-door/cross-cutting, the Intake Exit step offers the check; a two-way-door feature gets no offer
  - Invoking the check spawns the cold sub-agent (spec + repo, no conversation), returns a sufficient/insufficient verdict, renders it in plain language, and appends gaps to Open Questions
  - Under YOLO the check auto-runs and logs its auto-decision; the check is invokable on demand
  - A sub-agent error/timeout is noted and skipped, never blocking
  - Template and dogfood copies are in sync; scenarios pass
last_reviewed: '2026-06-23'
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
- 2026-06-23T04:27Z Complete: intake — scope gate signed off. Frontmatter scope/out_of_scope/done_when set. Phase → define-behavior.
- 2026-06-23T04:31Z Complete: define-behavior — 16 scenarios across 7 rules, user-accepted; test-definitions.md ledger saved. Phase → scenario-gate.
- 2026-06-23T05:03Z Complete: verify — full vitest suite 3286/3286 pass (5 skipped), Gherkin lane 98 scenarios pass, build clean, lint clean, 19/19 scenarios, no dep drift. /verify + /audit logged; audit passed (config in sync, refs resolve). verify.md written. Awaiting user confirmation for done.
- 2026-06-23T04:48Z Complete: implement — guide + DISCOVERY rung + SAFEWORD pointer + schema entry; 19/19 scenarios GREEN (commit ef826fb), parity + schema + sibling suites green. Reconciled skill→guide for no-bloat (recorded in impl-plan). Phase → verify.
- 2026-06-23T04:40Z Complete: scenario-gate — two independent /review-spec passes (fresh subagents). Pass 1: does-not-pass, 3 must-fix (vacuous recorded-field guard, bundled spawn scenario hiding the no-conversation thesis, unobservable verdict scenarios) + 6 should-strengthen. Rewrote ledger → 19 scenarios. Pass 2: PASSES, 0 must-fix; applied both should-strengthens (banned-term jargon negative, empty/non-empty append split). Review stamp recorded; impl-plan.md written (test layers + build order). Phase → implement.
