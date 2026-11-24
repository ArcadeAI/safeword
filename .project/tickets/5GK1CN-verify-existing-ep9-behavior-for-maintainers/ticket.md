---
id: 5GK1CN
slug: verify-existing-ep9-behavior-for-maintainers
type: feature
phase: scenario-gate
phase_anchors:
  - define-behavior: .project/tickets/5GK1CN-verify-existing-ep9-behavior-for-maintainers/spec.md
  - scenario-gate: features/verify-existing-ep9-behavior-for-maintainers.feature
status: in_progress
scope:
  - independently certified current-proof completion for EP9K2Y only
  - design a separately controlled CI execution producer and attestation import for the fixed EP9 proof
  - reuse independent coverage review and bounded local closing with a signed freshness checkpoint
  - preserve historical RED rows and all existing evidence and ordinary prerequisites
  - trust the installed verifier and embedded pins while refusing forged execution and local validation state
out_of_scope:
  - implementation, qualification campaigns, installation or CI dispatch under the present planning authorization
  - general retrospective admission or automatic eligibility for this new ticket
  - qualification standards, route changes, merge, release or parent completion
  - OS hardening against replacement of the installed verifier or its embedded trust roots
  - changes to CKWE2D, 9239QM, T0FK4H eligibility or the 33 deferred cases
done_when:
  - a trusted fixed-workflow execution attestation and fresh independent review admit only the exact EP9 proof
  - current execution attempt and closing freshness are authenticated by the separately controlled CI signer
  - changed, partial, self-issued, failed or non-independent evidence refuses completion
  - original missing history remains visible and revocation restores blocking
  - actual GitHub runner credential isolation and inter-job artifact replacement controls pass; local or mocked proofs cannot substitute
  - live query-to-close and offline closing verification measurements meet the five-minute checkpoint window and host deadline before adoption
  - installed Claude Code, Codex and Cursor completion/refusal walkthroughs pass; synthetic adapter fixtures alone do not complete this ticket
product_plan_contract: v1
created: 2026-11-06T05:38:40.854Z
last_modified: 2026-11-06T05:38:40.854Z
---

# Verify existing EP9 behavior for maintainers

**Goal:** Allow only EP9K2Y to earn independently certified current-proof credit while preserving missing historical RED and all existing completion prerequisites.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-11-06T05:38:40.854Z Started: Created ticket 5GK1CN
- Planning review 628139a4 requested changes; the local shared-signer conclusion was withdrawn. User authorized CI-backed design only, with no workflow implementation or dispatch.
- User authorized ordinary review-and-repair cycles. Review 4f3dc321 requested reconciliation and explicit attempt/freshness policies; these reviews are not approvals, and qualification/implementation remain excluded.
- 2026-11-06: Scenario review 137d93f5 requested changes: missing positive signing example and CI surface lineage. Replaced the upload-only case with issue/deny examples and tagged CI authority scenarios; Gherkin lint passes. This repair has not received a new approval. Product Bet now supplies the four required framing fields; no accepted Rule changed.
- The installed 1.2.0 coordinator reports AUTHOR_CAPABILITY_UNKNOWN and reduced independence for this Codex-authored planning review. Its withPlanningAuthorCapability branch accepts only a Claude author with a model value; setting an author variable here would not make Codex eligible. No stamp or phase advance was attempted. A supported verified-author session is needed for a fresh review of the repaired packet; changing this policy is outside the bounded planning work.
- Required bootstrap retry bunx --bun safeword@latest codex install failed: installed plugin reported 1.2.0 while the resolved package required 1.1.0; project hooks were left unchanged. No further installation or configuration change attempted. All missing RED, past failures and 33 deferred cases remain unchanged.
