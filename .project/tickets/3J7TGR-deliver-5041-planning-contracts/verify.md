# Verify bounded #5041 delivery

Source checkpoint: 45549abeca6d65119ddc36be5a66b54f6a9ff0ab, integrated with
main f48275b5e. This task covers the accepted #5041 contribution and its current
main integration. Feature 5F5ZZA remains at scenario-gate/in_progress.

## Verify Checklist

**Test Suite:** ✓ 332/332 tests pass across 11 targeted files; prior full CI at 90f4124c3 is historical, and current-head full CI remains required before merge.
**Gherkin:** ✅ Prior filtered acceptance passed 597/597 scenarios and 11140/11140 steps on Node 24 in CI 39327364010; this is prior-head evidence, not a current-head rerun claim.
**Build:** ✅ Success — final test wrapper rebuilt the CLI and declarations.
**Lint:** ✅ Clean — changed test ESLint and formatting passed; template hooks are excluded by repository lint configuration. Full repository lint is recorded separately before closure.
**Typecheck:** ✅ Clean — CLI tsc passed after current main integration.
**Scenarios:** ⏭️ Task uses existing executable proof and inline delivery criteria; no broader feature checkbox or scenario is marked complete.
**Refactor:** ✅ Completed — 2fa0ae1a8 and ece4f4165 retain the stronger assertions; current integration adopts main's shared trusted resolver.
**PR Scope:** ✅ Diff matches the user-approved bounded delivery task; current-main changes are inherited, no #5051 expansion or parent completion.
**Dep Drift:** ✅ Clean — no dependency or lockfile changes introduced; existing scanner observations remain recorded below.
**Parent Epic:** N/A — this is a separate delivery task related to feature 5F5ZZA and epic 82T411; neither is closed or reclassified.
**Reconcile:** ✅ No pattern deviation — reuse main's trusted CLI resolver without changing it; generated carriers are regenerated from source.
**Experience:** ⚠️ Host availability and bootstrap limits remain; no native UI or persona-experience success inferred from mechanical tests.
**Surface Evidence:** ⚠️ Real CLI and installed shared/native-layout fixtures pass; native UI, cloud, private-injection and hostile-PATH Cursor-adapter bootstrap remain unproven/deferred.
**Evidence limits:** ⚠️ Current full CI pending; local 1.2.0 source sync could not verify Claude enablement or replace the installed Codex 1.1.0 profile. No paid semantic qualification rerun or current qualification pass claimed.

Audit passed with warnings: zero errors, one explained orphan warning for the
retained historical admission source (537 modules / 1004 dependencies). Manual
review checked the changed source/test boundaries, configured documentation,
generated mirrors and all review findings. Repository-wide Knip, clone totals
and dependency upgrade discovery were outside this diff audit.

## Current proof and limits

The final 11-file command covers installed copy refusal/restoration, shared
trusted CLI lookup, coding and transition gates, native asset dispatch, contract
generation, Product routing/reconciliation, bundle identity, BDD proof tags and
documentation readiness. The two new shared-hook probes cover both unset and
empty CODEX_HOME while a hostile project PATH shim remains unexecuted. All
existing stronger tests and timeouts remain unchanged.

Installed shared-hook drift is refused with canonical_contract_copy_mismatch;
the first legacy-checker probe executed the shim (RED). The first attempted
outer-Cursor probe instead reached its separate PATH-based bootstrap; that
failed attempt remains retained, not reclassified as a successful native test.
The empty CODEX_HOME probe also first failed with the wrong refusal before its
default semantics were repaired. Final integration subset: 87/87 passed.

All five generated surfaces are current; parity passes 277 pairs / 11 contracts.
All 12 lifecycle result hashes match current main. Initial generation flagged
Cursor install's accepted main result change; inspection and the successful
rerun are both retained. No result oracle was weakened.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Safeword CLI | Real project planning-contract-check for all three phases, with host/plugin variables cleared | All current, exit 0; copy usability only |
| Cursor installed copies | installed-planning-copy-admission.test.ts, including unchanged native adapter drift cases and new installed shared-hook PATH cases | Passed; hostile-PATH outer-adapter bootstrap excluded |
| Claude/Codex delivered assets | native-planning-copy-dispatch.test.ts and codex-plugin-version.test.ts | Passed; simulated reviewer boundary and asset layouts, no native UI claim |
| Local host enablement | Source install attempts | Offline request rejected; normal install synced project copy but could not verify Claude 1.2.0 or Codex 1.2.0 activation; profiles not upgraded |
| CI/full acceptance | Required final-head GitHub CI | Pending before admin merge; prior run 39327364010 remains separately linked |

SWM walkthrough: current copies are usable, cosmetic author-copy drift refuses
use without staling semantic approval, and exact restoration recovers usability.
Worst step is repairing/reinstalling an unavailable trusted checker. No new user
step is needed on the healthy path. This is a mechanical walkthrough, not proof
of the parent Killer Demo or NTB/TBU usability.

Independent implementation review 2a40111c-1035-4eff-a7f0-376f8d4da248 approved
the source/test integration (Claude/opus, cross-agent). Its availability and
trusted-launcher warnings are answered in review-responses.md. The phase-stamp
verifier demands every changed file in the broader branch, including unrelated
generated/archived parent evidence; the documented explicit implementation-phase
skip records that scope mismatch without claiming whole-branch coverage. Actual
bounded independent review evidence remains retained. Intake was independently
reviewed and stamped normally. Verification review follows this record.

## Retained failures and unfinished work

The broader [verify record](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/verify.md)
retains failed local relay runs and eight Bun audit advisories. The configured
CI dependency audit passed under its unchanged two-advisory exception policy;
that is not a claim of zero vulnerabilities. No dependency upgrade or audit
policy weakening is included.

The prior interrupted live qualification produced three semantic failures;
historical admission is not a fresh live pass. The broader 0/159 ledger,
accepted host proof deferrals and #5051 work remain open. Local delivery closure
does not resolve them, declare the parent complete, authorize release or satisfy
the external PR checks. Current-head CI must be green before the already
user-authorized admin merge.
