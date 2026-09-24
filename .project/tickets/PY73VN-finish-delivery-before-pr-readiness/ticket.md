---
id: PY73VN
slug: finish-delivery-before-pr-readiness
type: feature
phase: verify
status: in_progress
scope:
  - Make every successful GREEN step continue directly through refactor and the next delivery step.
  - Carry completed scenarios through whole-ticket review, plan reconciliation, verification, audit, and ticket closure without routine user prompts.
  - Require verified ticket completion before PR-readiness evaluation or Ready promotion.
  - Enforce the Ready boundary through the shared shell gate on Claude Code, OpenAI Codex, and Cursor while preserving Draft PR creation for CI evidence.
out_of_scope:
  - Automatic pull-request creation, Ready promotion, approval, or merge without explicit user authority.
  - Blocking Draft pull requests used to obtain CI, AI review, or narrow human evidence.
  - Enforcing readiness actions performed outside supported local agent hooks, including the GitHub web UI and cloud-agent environments.
  - Ready mutations issued through `gh api`, direct REST, or GraphQL rather than the first-class `gh pr` Ready commands named by this ticket.
done_when:
  - Shipped BDD guidance has one uninterrupted post-GREEN delivery chain through verified done and PR-readiness classification.
  - The PR-readiness workflow routes unfinished tickets back to their next delivery step instead of treating Draft as a terminal result.
  - Shared hook tests prove ready-making GitHub CLI commands are denied for an active unfinished ticket and allowed after verified done or when creating Draft evidence.
product_plan_contract: v1
parent: ZRJ9JJ
parent_job: prodigy-flow.TBU1
milestone: M2
created: 2026-09-11T02:04:36.453Z
last_modified: 2026-09-19T00:09:55.000Z
parent_contract_digest: 31fcd06cc32d4741d9b2cb39a0f1b04066f8bee6442bfa43436811776ae7a2c0
phase_anchors:
  - 'define-behavior: .project/tickets/PY73VN-finish-delivery-before-pr-readiness/spec.md'
  - 'scenario-gate: features/finish-delivery-before-pr-readiness.feature'
  - 'implement: .project/tickets/PY73VN-finish-delivery-before-pr-readiness/impl-plan.md'
  - 'verify: .project/tickets/PY73VN-finish-delivery-before-pr-readiness/test-definitions.md'
---

# Finish accepted changes before asking for PR review

**Goal:** Keep agents moving after every GREEN step through refactoring, whole-ticket review, verification, and final PR-readiness classification unless a genuine authority or safety boundary requires a stop.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-11T02:04:36.453Z Started: Created ticket PY73VN
- 2026-09-12T15:02:12.140Z Intake accepted by explicit request to tackle this ticket; preserved Draft PRs as the CI-evidence escape hatch and treated external Ready actions as outside local-hook enforcement.
- 2026-09-12T20:10:30.000Z Plan approved by independent cross-agent review. Kept one cohesive feature at the splitting checkpoint because all four proof groups share the same readiness identity, receipt, and irreversible shell boundary.
- 2026-09-18T14:30:00.000-07:00 Implementation reconciled: the evidence design now covers a closing edit first observed in a resumed session; no planned decision was abandoned and no new design deviation was introduced. Independent whole-ticket review drove native Claude plugin parity fixes and the fresh-session exact-HEAD receipt regression fix.
- 2026-09-19T00:09:55.000Z Verification completed on the final implementation: full unit/integration, acceptance, build, lint, typecheck, host/install parity, and diff-audit evidence passed. Independent Claude re-review found no error-severity issues. The implement-phase stamp records the approved review plus the coordinator's 1 MiB packet limit for 6.7 MiB of generated mirrors. The ticket remains open at verify pending explicit closure confirmation; PR Ready promotion remains a separate authority boundary.
- 2026-09-24T15:04:33.000Z Merged current `origin/main` at `6a3e6682f`, regenerated delivery fixtures, and reran the authoritative verification plan. The complete rerun passed 10413 runnable tests, both acceptance lanes, build, lint, typecheck, and dependency audits; one temporary Git index error and one shared-lock timeout did not reproduce in a final 59/59 isolated rerun. The ticket remains at verify pending explicit closure confirmation.
