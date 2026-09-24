---
id: ASG60P
slug: make-agent-handoffs-decision-complete
type: feature
subtype: bug-investigated
phase: done
status: done
scope: |
  Define one versioned terminal-handoff contract for decision, blocked, and
  no-decision replies; enforce or evaluate it at a bounded terminal boundary;
  prove the behavior with observed-session regressions, a representative
  long-form transcript corpus, and native-boundary or real-process coverage for
  Claude Code, OpenAI Codex, and Cursor; keep canonical, generated, and dogfood
  copies aligned.
out_of_scope: |
  - Lifecycle propulsion after GREEN.
  - General response-length or tone changes outside terminal handoffs.
  - Verbose templates for short conversational replies.
  - Unbounded checks on every turn.
done_when: |
  - A reader can act from a substantive terminal Next or Need paragraph alone.
  - Decision and blocked handoffs state the choice, recommendation, controlling
    reason, material tradeoff or consequences, and exact reply in plain language.
  - No-decision handoffs stay to one concrete action plus an essential reason.
  - The two observed failures regress, compliant rewrites pass, and long-form
    decision/blocked/no-decision transcripts are exercised across all three hosts.
  - Each supported host has native-boundary or real-process evidence that the
    installed contract reaches the agent.
product_plan_contract: v1
external_issue: https://github.com/ArcadeAI/safeword/issues/4500
phase_anchors:
  - define-behavior: .project/tickets/ASG60P-make-agent-handoffs-decision-complete/spec.md
  - scenario-gate: features/make-agent-handoffs-decision-complete.feature
  - plan-implementation: .project/tickets/ASG60P-make-agent-handoffs-decision-complete/impl-plan.md
  - implement: .project/tickets/ASG60P-make-agent-handoffs-decision-complete/impl-plan.md
  - verify: .project/tickets/ASG60P-make-agent-handoffs-decision-complete/test-definitions.md
  - done: .project/tickets/ASG60P-make-agent-handoffs-decision-complete/verify.md
created: 2026-09-12T19:59:43.436Z
last_modified: 2026-09-24T14:03:00.000Z
---

# Make agent handoffs decision-complete in real replies

**Goal:** Make every substantive terminal handoff self-contained, plain, and actionable across supported agent hosts.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-12T19:59:43.436Z Started: Created ticket ASG60P
- 2026-09-12T20:03:00.000Z Accepted: The user asked to implement issue #4500; its desired outcome, acceptance criteria, constraints, and prior root-cause analysis define the intake contract.
- 2026-09-12T20:03:00.000Z Framed: Compare terminal-boundary correction, focused semantic evaluation, and prompt-only proof against host capabilities, deterministic bounds, cross-host reach, and false-positive cost.
- 2026-09-12T20:08:00.000Z Decided: Use a versioned, deterministically checkable terminal-handoff contract whose decision form names explicit semantic roles in one plain-language paragraph, plus one-shot correction at each host's terminal boundary. Keep a corpus evaluation as regression evidence, not runtime authority.
- 2026-09-12T20:08:00.000Z Rejected: Prompt-only proof already failed in real sessions. An LLM judge at every stop adds latency, model drift, and correlated judgment while current research shows detailed judge prompts do not guarantee adherence.
- 2026-09-12T20:08:00.000Z Advanced: Intake is accepted from issue #4500's explicit user-authored contract; scope, exclusions, failure modes, and observable completion are recorded in spec.md and ticket frontmatter.
- 2026-09-12T20:15:00.000Z Defined: Derived eight behavioral dimensions and authored 17 user-confirmed scenarios from issue #4500's acceptance criteria, covering happy, failure, edge, long-context, cross-host, native-boundary, bounded-correction, and parity behavior.
- 2026-09-12T20:54:42.000Z Reviewed: Independent Claude scenario-gate review d33a947f-19bf-4666-af0d-0e66b145815a approved all 45 scenarios after strengthening compliant process exits, action/choice cardinality, deterministic corpus evidence, fail-open behavior, correction state, and delivered-copy parity.
- 2026-09-12T20:54:42.000Z Advanced: Scenario gate passed; implementation planning is now authorized.
- 2026-09-12T21:12:00.000Z Reopened: Plan review found three semantic claims that exceeded a deterministic scanner's observable inputs. Returned to scenario-gate so the accepted scenarios state declared-route, marked-term, and explicit-action evidence honestly before implementation.
- 2026-09-12T21:28:00.000Z Re-reviewed: Independent Claude scenario-gate review c938fd13-bffc-4b6d-a889-8c4b32046989 approved all 51 amended scenarios with no error findings. Runtime claims now bind only observable route, role-content, action, reason, and marked-term evidence.
- 2026-09-12T21:28:00.000Z Advanced: Amended scenario gate passed; resumed implementation planning.
- 2026-09-12T21:37:00.000Z Planned: Authored a parse-valid planned implementation plan with all five required sections, design documentation, a risk-first seven-slice build order, explicit native host fields, and contract-derived proof.
- 2026-09-12T21:37:00.000Z Reviewed: Independent Claude plan-implementation review 04b609ef-c8a6-4c9e-8500-838300751994 approved the plan with no error findings.
- 2026-09-12T21:37:00.000Z Advanced: Plan gate passed; implementation is unlocked.
- 2026-09-24T14:03:00.000Z Done: Exact-head verification, native walkthrough, audit, generated-copy parity, independent Claude Opus review, and GitHub CI passed; PR #4538 carries the implementation and completion evidence.

## Root Cause

The shared grammar proves only verdict count, paragraph labels, ordering, and
terminal placement. Its BLOCKED variant does not apply the self-contained
decision requirements to `Need`, and none of the validators checks whether a
decision paragraph actually carries the choice, recommendation, reason,
tradeoff or consequence, and exact reply. Generated-copy tests faithfully prove
that this incomplete contract is distributed; they cannot prove that agents use
it semantically.

Confirmed by `evaluateDecisionBriefCompliance`: `**Need:** Choose the intended
release target.` is accepted because the function compares labels only. The
Claude Stop path runs this structural check only when optional Stop-time quality
review is enabled; Cursor emits a generic follow-up without reading the reply;
Codex's Stop adapter does not evaluate the handoff.

Ruled out:

- Generated-copy drift: canonical, dogfood, Claude, and Codex copies carry the
  same incomplete contract.
- Markdown parsing failure: the existing scanner correctly rejects missing,
  duplicate, misplaced, or out-of-order top-level fields.
- Missing prompt specificity alone: the prior contract already names the desired
  decision details, yet the observed sessions omitted them.

### Native correction implementation finding

Hoisting terminal-handoff correction ahead of Claude Code's no-edit early exit
also put it ahead of the existing `stop_hook_active` one-shot guard. A repeated
native Stop therefore emits two corrections for Claude Code while Codex and
Cursor emit one. The focused three-host subprocess scenario confirms the 2/1/1
split.

Ruled out: shared correction-state failure, because the same scenario passes for
Codex and Cursor; test-harness state leakage, because each example creates and
removes an isolated temporary project; and output counting error, because both
Claude subprocess outputs independently contain `terminal-handoff/v1`.

### Post-main acceptance finding

The older `generate-compliant-replies-without-rewrites` acceptance feature still
builds terminal `Next` and `Need` paragraphs using the pre-v1 contract. Once the
dogfood Stop hook was reconciled with the canonical template, the real Stop
subprocess correctly rejected those fixtures, producing 42 acceptance failures.
Direct parser scenarios in that feature also omitted substantive-handoff evidence,
so verdict-free adversarial inputs were correctly treated as outside the v1
contract even though the scenarios expected strict terminal validation.

Confirmed by reproducing `A complete CONFIDENT brief finishes on the first Stop`
locally: the hook requests the missing v1 action roles from `**Next:** Review the
result.` Every CI failure belongs to the same legacy acceptance feature.

Ruled out: Node 24 behavior, because the representative failure reproduces
locally; a runtime regression from `main`, because the rejection names the new
contract's missing roles; and parser nondeterminism, because repeated evaluations
return the same result.
