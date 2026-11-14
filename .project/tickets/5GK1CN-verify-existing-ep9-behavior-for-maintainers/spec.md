# Product Plan: Verify existing EP9 behavior for maintainers

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** EP9 has current behavioral tests but missing or stale test-first history; existing current-proof eligibility admits only T0FK4H.
- **Expected outcome:** Independently establish current EP9 behavior without inventing its history.
- **Persona outcome inventory:** Safeword Maintainer (SWM) can explicitly finish the fixed EP9 delivery using independent current proof while retaining missing historical evidence; no other persona gains completion eligibility.
- **Known facts:** EP9 has eight proof groups, missing or stale test-first evidence, and no current admission beyond the existing T0FK4H profile. Planning reviews have accepted a bounded external execution-attestation design; no live adoption proof has run.
- **Assumptions:** The installed verifier and its embedded public roots and workflow pins are trusted. GitHub execution isolation, signature import and the proposed five-minute closing window still require live verification before adoption.
- **Unresolved product decisions:** None for the bounded planning scope. Live isolation and latency feasibility are implementation adoption gates, not permission to relax the accepted proof requirements.
- **Success threshold:** Only complete exact-candidate independent proof earns EP9 credit; altered or missing evidence restores refusal.
- **Project non-goals:** General retrospective admission, self-certification, qualification changes/campaigns, CI dispatch, route changes, merge/release and parent completion. Ordinary bounded planning-review cycles are authorized.
- **Reversibility:** two-way; withdrawing evidence revokes current credit while preserving history.

## Jobs To Be Done

### verify-existing-ep9-behavior-for-maintainers.SWM1 — Finish existing work honestly

**Persona:** Safeword Maintainer (SWM)

> When EP9's implementation exists but original evidence is missing, I want independent proof of current behavior, so I can complete the delivery without rewriting history.

#### verify-existing-ep9-behavior-for-maintainers.SWM1.R1 — Only the fixed EP9 delivery is eligible

Require complete coverage of EP9's eight groups and ordinary prerequisites. Other tickets, including this prerequisite itself, obtain no new eligibility.

#### verify-existing-ep9-behavior-for-maintainers.SWM1.R2 — Authority is independent and revocable

Require execution attestation from the separately controlled fixed GitHub Actions producer and fresh qualified independent coverage review. Verify workflow identity/revision, candidate/profile/report binding and the latest execution attempt. Closing requires a CI-signed synchronization checkpoint no older than five minutes; offline closing cannot claim awareness of runs after that checkpoint. Candidate-written local signatures, arbitrary uploads, partial/failed/stale evidence or reduced review refuse; changes revoke credit.

Trust baseline: the installed verifier and its embedded workflow/public trust
pins are trusted. Replacing that installation is excluded, as is OS hardening.
Candidate-controlled reports, bundles and local validation caches are untrusted:
closing must cryptographically verify the external signatures and bindings, not
accept a local HMAC approval or candidate-supplied trust pin. Five minutes is a
proposed upper bound requiring live latency feasibility before implementation;
failure to meet it blocks adoption rather than silently relaxing freshness.

#### verify-existing-ep9-behavior-for-maintainers.SWM1.R3 — Historical claims remain unchanged

Keep original ledger rows, missing RED, failed/stale/rejected reviews and all 33 deferrals. Display current verification separately from missing history. No sibling or parent completes automatically.

## Shape

### M1 — Establish current EP9 behavior independently

- **Outcome:** One fixed EP9 profile supports honest explicit completion after independently earning authority.
- **Non-goals:** No repeated exemption for this prerequisite or configurable profile registry.

## Killer Demo

> For a maintainer blocked by missing historical RED, complete independent current proof permits explicit EP9 completion while history remains missing; removing approval restores refusal. This demo is proposed, not executed.

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor
- GitHub Actions Execution Sandbox

Unaffected:

- OpenCode and cloud coding-agent completion eligibility stays excluded; deferred cases are not promoted. The fixed GitHub Actions workflow is an execution-evidence producer, not a newly eligible coding-agent host.

Planning is at scenario-gate with 17 prospective scenarios. Earlier independent
planning approvals and requested changes remain in evidence/; the current
scenario packet still requires its own approval. No implementation or live proof
is claimed. planning-proposal.md retains the superseded local-only proposal.
