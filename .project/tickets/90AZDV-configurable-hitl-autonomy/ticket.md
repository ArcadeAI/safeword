---
id: 90AZDV
slug: configurable-hitl-autonomy
type: feature
phase: intake
status: in_progress
created: 2026-06-16T14:08:18.380Z
last_modified: 2026-06-16T14:08:18.380Z
scope:
  - Let users declare, per decision-kind, whether safeword pauses for human review or runs autonomously
  - Project-level setting (committed to repo, team default) plus a personal override that is NOT committed (gitignored local config)
  - When a decision-kind is set to autonomous, every would-be HITL breakpoint (Clarify question, design pick, mid-build ambiguity) spawns a sub-agent that receives all needed context and resolves it via the /figure-it-out skill
  - Define and encapsulate the sub-agent's context contract (what it receives) in a skill or sub-agent definition — not ad-hoc per call site
  - Log every autonomous resolution (question, options, pick, rationale) to the ticket work log
  - Couple the compensating control - when human review is dialed down on an axis, the independent-observation control (fork/cross-model review) dials up on that axis
  - Always-confirm denylist (absorbed from G2E72G) - git push / push --force, branch delete or reset --hard, sending external messages (email/Slack/etc.), file deletion outside the ticket folder, marking ticket done, paid-API spend above a threshold, touching production config or secrets - prompts the user regardless of autonomy setting
  - Hard safeword gates (LOC commit, done gate, verify artifact) still fire under any autonomy setting (absorbed from G2E72G)
  - A per-ticket override toggle so a single ticket can opt into/out of autonomy independent of the project/personal default (absorbs G2E72G's /yolo command intent)
out_of_scope:
  - Removing hard protective gates (LOC commit, done gate, verify artifact) - autonomy removes deliberative pauses, not protective ones
  - Auto-marking a ticket done without human confirmation
  - Time-boxed activation (--yolo 30m) and session-level env-var activation (carried from G2E72G out-of-scope)
  - Cost-ceiling enforcement on sub-agent /figure-it-out spend (deferred to v2, carried from G2E72G)
known_unknowns:
  - The exact set of decision-kind axes to expose, and whether to expose them directly or as named presets
  - Storage mechanism + precedence for project vs. personal config (e.g. .safeword/config.local.json, gitignored, personal wins)
  - Autonomy semantics per axis - silence the check vs. swap human for fork/cross-model reviewer (the 2VCSZY coupling)
  - Failure mode when the sub-agent's /figure-it-out is inconclusive, errors, or times out - abort to user vs. retry vs. skip-with-default (carried from G2E72G, pin during define-behavior)
done_when:
  - A user can set, at the project level, which decision-kinds require human review and which run autonomously
  - A user can override that locally without the override being committed to the repo
  - On an autonomous decision-kind, the agent resolves the breakpoint via a sub-agent + /figure-it-out instead of pausing, with the resolution logged
  - The sub-agent's input contract is defined in one place (skill or sub-agent definition), not duplicated per call site
  - Dialing human review down on an axis provably turns the compensating reviewer up on that axis
---

# Let users choose where to require human review vs. full autonomy

**Goal:** Let a team set, per kind of decision, where safeword stops for human review and where it runs autonomously — and when autonomous, resolve the breakpoint with a context-loaded sub-agent calling `/figure-it-out` instead of pausing.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (to author at intake).

## Why

Safeword already encodes an implicit theory of where humans belong — `PRINCIPLES.md:5`, _"Gate the irreversible. Nudge the qualitative."_ — but that theory is fixed, not user-settable. The goal is to make it an explicit, per-axis control: teams that want hands-off runs (overnight, batch tickets, low-stakes work) dial autonomy up; teams that want to guard scope or design dial it down. The constraint is `PRINCIPLES.md:34` — a real session fired 304 quality reviews for 5 useful catches (97% noise) — so pauses must stay high-signal. Autonomy here does not mean "no check"; it means swapping the human check for an independent-observation check.

## The leverage map (where HITL is high vs. low value)

Ordered by leverage. The natural axis is **reversibility × who-holds-the-knowledge**, not workflow phase.

| Boundary                                 | Leverage   | HITL today                                                   | Rationale                                                                                                               |
| ---------------------------------------- | ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Intake — scope/intent accept             | Highest    | default (propose-and-converge)                               | Wrong scope wastes everything downstream; intent lives only in the human's head                                         |
| External / irreversible side-effects     | Highest    | latent (denylist lives only inside G2E72G)                   | git push, secrets, **live Gmail/Slack/Linear/Drive writes** — irreversible + outward-facing                             |
| Define-behavior — scenario accept        | High       | default + /review-spec                                       | Scenarios are the correctness contract; human is the edge-case domain expert                                            |
| Design/architecture — irreversible calls | High       | **gap** (/figure-it-out is agent-driven; MR5M3A default-off) | Cross-cutting/ADR-worthy calls costly to reverse, yet human sees only the verdict, never a checkpoint before committing |
| Verify — spec/scope/value findings       | Med-high   | /verify triages decisions-needed vs agent-actions            | Some findings need product judgment                                                                                     |
| Scenario-gate — AODI/adversarial verdict | Medium     | structural on, enforcement off                               | Checkable by a fork-reviewer; weak human-only signal                                                                    |
| Done — close/sign-off                    | Ceremonial | hard gate (verify.md) + denylist                             | Intentional final confirm; cheap                                                                                        |
| Config / quality-infra edits             | Med        | pre-tool-config-guard.ts                                     | High blast radius                                                                                                       |
| Implement — TDD RED/GREEN/REFACTOR       | Low        | machine-gated (correctly)                                    | Tests already gate this; pausing here is the 97% noise                                                                  |

Candidate axes a user would set: **intent & scope**, **behavioral contract**, **irreversible design**, **external side-effects** (always-confirm, mode-independent), **execution** (autonomous), **completion**.

## Explicit requirements from this conversation

1. **Two-level config with non-committed personal override.** Project-level setting is committed (team default). A personal override layers on top and must NOT be committed to the repo — a gitignored local config (e.g. `.safeword/config.local.json`), with personal taking precedence over project. Mechanism + precedence to confirm at intake.
2. **Autonomous breakpoint → sub-agent → /figure-it-out.** When a decision-kind is set autonomous, any point the agent would ask a question or hit a HITL breakpoint instead spawns a sub-agent that gets all the context it needs and calls the `/figure-it-out` skill; the agent takes the result and proceeds, logging the resolution.
3. **Define the sub-agent's context contract once.** Specify exactly what the sub-agent receives (the question, ticket/spec, relevant code, prior decisions, constraints) and encapsulate it in a skill or sub-agent definition so it isn't re-derived ad hoc at each call site.

## Open questions (resolve at intake)

- **G2E72G (yolo-mode) — RESOLVED:** 90AZDV supersedes it (user direction, 2026-06-16). Keepers absorbed into scope (denylist, hard-gates-fire, per-ticket toggle, decision logging, deferred failure-mode/cost-ceiling). The binary on/off mode becomes one point on this ticket's per-axis gradient.
- **Axis granularity:** expose the ~6 decision-kind axes directly, or a smaller set of named presets ("review my design, run the rest") mapping onto them?
- **Autonomy semantics per axis:** silence the check, or swap human → fork/cross-model reviewer (the 2VCSZY coupling)? This is the biggest design fork.
- **Why a sub-agent rather than inline `/figure-it-out` (G2E72G's choice):** context isolation and a clean input contract — confirm the cost/latency tradeoff is worth it vs. inline.

## Related tickets

- **G2E72G** (yolo-mode) — **superseded by this ticket**; keepers absorbed into scope.
- **2VCSZY** (review-gate-autonomous-posture) — the compensating-control coupling: posture flips with the mode.
- **MR5M3A** (architecture-gate) — the default-off design review this would wire to the "irreversible design" axis.
- **NMSD94** (per-asset-review-gate) — built the Tier-1/Tier-2 stamp machinery + default-off flag this couples to.
- **171** (subagents-in-the-loop) — the epic on where delegating to a sub-agent dominates inline work; the sub-agent contract here is one instance.

## Work Log

- 2026-06-16T14:08:18.380Z Started: Created ticket 90AZDV
- 2026-06-16T14:09:00.000Z Filed (intake): captured the HITL/autonomy leverage map, the two-level config requirement (project + non-committed personal override), the autonomous-breakpoint → sub-agent → /figure-it-out flow, and the sub-agent context-contract requirement. Drafted scope/out_of_scope/done_when; key open question is reconciliation with G2E72G. spec.md (JTBD/personas) still to author.
- 2026-06-16T14:32:13.236Z Superseded G2E72G at user direction: marked it status=superseded with a pointer here, and absorbed its keepers into scope (denylist, hard-gates-fire, per-ticket toggle, inline decision logging, deferred failure-mode + cost-ceiling). Largest design fork (silence vs. swap-reviewer per axis) remains open for next intake turn.
