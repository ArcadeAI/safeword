---
id: BT1YNY
slug: make-planning-trust-proofs-meaningful-for-maintainers
type: task
phase: implement
status: in_progress
created: 2026-10-20T17:42:56.595Z
last_modified: 2026-10-20T17:42:56.595Z
scope:
  - repair R8 unproven OpenCode authority coverage and R9 non-discriminating invalidation proof
  - preserve canonical contracts from #5957 and inspect real proof boundaries before promising coverage
  - review the revised scenario set independently and retain all remaining failures and deferrals
out_of_scope:
  - new invalidation policies, runtime fallback work, dependency upgrades or full epic completion
  - unchanged paid qualification, broad step binding, merge or release promotion
done_when:
  - the two scenario findings have discriminating repaired examples or explicit evidence-based dispositions
  - scenario syntax and lineage checks pass and revised names match the unchecked feature ledger
  - fresh independent scenario review and verification evidence accurately delimit the repaired scope
---

# Make planning trust proofs meaningful for maintainers

**Goal:** Repair the two rejected R8/R9 acceptance examples while preserving main canonical policy and unfinished feature evidence.

**Why:** The OpenCode authority example lacks the unproven-host partition and the invalidation example echoes its own setup.

## Work Log

- 2026-10-20T17:42:56.595Z Started: Created ticket BT1YNY

## Proof repair boundary

Base: main 150eb7c61 after merged #5980. User authorized repairing the two
scenario findings next. Feature 5F5ZZA remains scenario-gate/in_progress;
this task cannot mark any of its 165 unchecked RGR boxes complete.

Review 16d49a09 identifies two errors: R8 only asserts OpenCode enforced
guidance after native proof passes, and R9's canonical-direction example echoes
its setup. Keep the original rejection as provenance.

Main's phase-contract.ts accepts exactly one upstream invalidation direction,
both_plan_reviews; reconciliation rejects missing, unsupported and
duplicate declarations. A second configurable direction or mutable dependency
list would be new product behavior and would conflict with preserving #5957.
The proof repair must not invent that extension to satisfy a reviewer example.
Independently review whether a closed-policy positive/negative proof plus
explicit generation ownership can establish the accepted claim; do not claim
that changing among unsupported directions is an implemented capability.

Applicable principles: independent observation over self-report requires real
advisory/enforced outputs rather than a Given that grants authority. Add rather
than replace requires preserving the accepted fixed contract and historical
failure evidence. Tests establish mechanics, not human trust or live host proof.

Work order: repair R8 with passed versus absent/failed/simulated/deferred native
proof; repair R9 with a supported-declaration control and a refusal when its
canonical authority is missing rather than another echoed dependency outcome;
name actual lower-level proof and remaining implementation gaps; run syntax,
lineage and ledger checks; independently review the complete scenario set.

R8 proof status must come from version/plugin-bound native conformance and
activation artifacts produced by actual lifecycle dispatch, not a caller's
enforced/advisory boolean. Missing, failed, simulated-only and deferred proof
must yield advisory guidance, no approval claim and a supported gated recovery
surface. These are target acceptance obligations, not claims of current
conditional guidance implementation or newly executed native qualification.

R9 will compress the redundant Given-echo into the existing reconciliation
scenario: the supported declaration admits generation/installation, while
missing or conflicting declarations fail with invalid_invalidation_contract and
preserve installed bytes. Actual invalidation outcomes remain in the existing
dependency outline. This checks closed-policy authority rather than claiming
runtime support for a second policy. The deliberate duplicate removal reduces
ledger size without checking off any behavior; historical 55/165 counts remain
in their original reports.

Drafted changes consolidate the redundant R9 example into the existing real
reconciliation scenario. Next register one positive and two selected negative
proofs in Examples order and strengthen the positive proof to check all three
pending installed copies. R8 conditional-guidance rows remain target obligations
until actual implementation/qualification exists. Run selected boundary proofs
and fresh complete scenario review; do not advance the broad feature solely
because this bounded task is admitted to edit its existing test support.

2026-10-20: independent scenario review 64fc8803 approved the revised complete
set with no errors. Four existing/nonblocking wording and broader coverage
warnings remain to disposition. Syntax, Rule lineage and surface lineage pass;
54 scenario definitions exactly match 54 ledger headings and 162 unchecked
boxes. No behavior was marked complete. The free root dry-run remains failed:
176 undefined cases, 528 undefined steps and 7,568 imported skipped steps.

The first focused run waited for another checkout's lock and exited 75 without
starting tests. The serialized rerun completed: 73 passed, one static proof
failure. The new selected-case registrations increased shared-proof fan-in from
75 to 76, violating the preserved reviewed cap. Do not raise that cap. Repair
the binding with one coherent positive/missing/conflicting matrix in Examples
order, keeping every existing negative assertion and dense rejection case.
This is test/provenance hardening of existing behavior, not a new runtime RED
claim; preserve the actual failed run.

The corrected matrix now starts with supported, missing and conflicting cases
in the feature's Examples order, followed by every retained dense rejection
variant. The supported case upgrades pending shared clauses in all three
installed copies; every rejected case preserves the existing exact error,
metadata and byte-preservation assertions. One whole-matrix registration avoids
the fan-in regression without changing the guard's 75/14 limits. Test support
changed; production source and generated surfaces remain unchanged.
