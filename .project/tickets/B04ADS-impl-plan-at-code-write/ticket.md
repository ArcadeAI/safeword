---
id: B04ADS
slug: impl-plan-at-code-write
type: feature
phase: intake
status: in_progress
parent: YA68QF
depends_on: ['87Y167']
external_issue: https://github.com/ArcadeAI/safeword/issues/644
scope: |
  Extend the implement-phase PreTool gate (#128 section of
  pre-tool-quality.ts) so a new-flow feature ticket at phase: implement
  requires a valid impl-plan.md before any application-code write — reusing
  lib/impl-plan.ts's parseImplPlan for validity (five sections
  content-or-skip; any parseable status). "New-flow" mirrors the stop gate's
  grandfathering: spec.md present in the ticket folder. The denial names the
  impl-plan template, instructs authoring at scenario-gate exit semantics
  (**Status:** planned), and states the forward next action. Unit/gate-level
  tests, Gherkin acceptance at features/impl-plan-at-code-write.feature +
  steps, template<->dogfood parity.
out_of_scope: |
  - Removing or weakening the verify-stop reconciliation gate
    (checkImplPlanArtifact in stop-quality.ts) — it keeps demanding
    **Status:** implemented from verify onward; the two points compose
  - Gating the ticket.md phase-advance edit into implement on impl-plan
    existence — redundant (D3): the first code write immediately follows the
    advance, and sibling 87Y167's scenario-review demand already gates that
    same edit; the code-write point also catches legacy tickets already
    sitting at implement
  - #644 G1 (sibling 87Y167), G3/G5/G6 (later tickets)
  - A new plan-implementation phase (#480) — enforcement lands without a
    phase-enum change; the phase proposal stays open upstream
  - impl-plan content/quality review (architectureReviewGate, MR5M3A) — flag
    posture unchanged
done_when: |
  - The first application-code write on a new-flow feature ticket at
    phase: implement is denied while impl-plan.md is missing or fails
    parseImplPlan validation, with remediation naming the template and
    Status: planned
  - The same write is allowed once a valid impl-plan.md exists (status
    planned or implemented)
  - Grandfathered features (no spec.md), tasks, patches, epics, meta/tooling
    paths, and non-implement phases never trip the gate
  - The verify-stop reconciliation gate's behavior is unchanged
  - Full test suite green; parity check passes
created: 2026-07-03T21:21:31.994Z
last_modified: 2026-07-03T21:40:00.000Z
---

# Demand impl-plan.md at first application-code write (#644 G4)

**Goal:** Move the impl-plan demand from verify-stop (where plans can only ever be retroactive) to the first application-code write on a feature ticket — so the plan is authored as a plan, before the code it plans (#644 G4).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes. Parent epic: [YA68QF](../YA68QF-644-g1-g4-remediation/ticket.md) (shared design record D1–D3). Sequenced after sibling [87Y167](../87Y167-artifact-precedence-gate/ticket.md) (restructures the same gate section first).

## Proposal — Option B (relocate to commit-time reconciliation) — supersedes D3, pending build greenlight

The original D3 scope above (a new PreTool **code-write** gate) is **retired** by the #644 maintainer reframe (2026-07-04) and a fresh `/figure-it-out` this session. The reframe's hard constraints: G5 (git-side commit/push reconciliation) is the keystone; **no net-new procedural gates — relocate/harden existing ones**; **validate at reliable choke points, not write-time** (write-time is Bash-bypassable — the `sed` bypass G3/#721 already had to close); and the verify-stop/done events where the impl-plan demand fires **today** are unreliable in one-shot cloud sessions.

**Decision: Option B.** Relocate the impl-plan demand from the verify-stop gate onto the **existing `git commit` interception** in `pre-tool-quality.ts` (the same Bash-tool hook point where `enforceRefactorCommitGate` and — in a sibling hook — `pre-tool-architecture-stage.ts` already fire). Mirror `architecture-stage.ts`'s proven **inform-early / block-later + CI-backstop** pattern.

- **Trigger:** a `git commit` (Bash tool) that stages application code for a new-flow feature ticket (spec.md present) at `phase: implement`, with no valid `impl-plan.md` (reuse `parseImplPlan`).
- **Why B over the alternatives:** it's the only option at a **reliable, hard-to-bypass** choke point using infra safeword **already ships** — and safeword's commit interception fires on the Bash *tool call*, so it is **not `--no-verify`-able** (that flag only skips git's own `.git/hooks`). Option A (code-write gate) is net-new + write-time-bypassable (the lever the reframe named wrong); Option C (defer to G5) leaves the retroactivity gap open on the unreliable verify-stop gate indefinitely (G5 is unscoped).
- **Open calibration (for this ticket's BDD intake):** hard-block at commit vs warn-and-record + CI backstop. The reframe's premortem: hard-block only cheap-to-attest facts — impl-plan **presence + validity is cheap**, so a hard block is defensible; the `architecture-stage.ts` precedent is best-effort + `architecture --check` CI backstop. Resolve in intake.
- **Premortem:** B only fires on the agent's `git commit` via the Bash tool — a ship path that never calls `git commit` (harness auto-commit, PR-create automation) escapes it. Mitigation: pair with a CI backstop (`safeword <check>` at PR), exactly as `architecture --check` already does.
- **Verify-stop reconciliation gate stays** (unchanged) as the `planned → implemented` reconciliation point; the two points compose.

Scope/out-of-scope/done_when frontmatter above still describe the retired D3 shape — they will be rewritten to Option B when the build is greenlit (this ticket has not re-run its BDD ladder yet).

## Work Log

- 2026-07-03T21:21:31.994Z Started: Created ticket B04ADS
- 2026-07-03T21:40:00.000Z Scoped: Intake converged in-session with 87Y167 (shared user-gated sign-offs: epic split, JTBD/AC/scope settled via /figure-it-out per user instruction). D3 decision + premortem in parent epic YA68QF. Implementation starts after 87Y167 ships.
- 2026-07-04T14:28:00.000Z Reframe response: D3 (code-write PreTool gate) retired. Fresh /figure-it-out against the #644 reframe → Option B (relocate the impl-plan demand to the existing git-commit interception, mirror architecture-stage.ts's inform-early/block-later + CI-backstop pattern). Full rationale, premortem, and the hard-block-vs-warn calibration captured in the Proposal section above. Ticket frontmatter still describes retired D3; awaiting user greenlight to rewrite scope to Option B and re-run the BDD ladder.
