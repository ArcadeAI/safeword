# Verify the bounded R8/R9 scenario proof repair

Base: main 150eb7c61 after #5980. Kept proof checkpoint: d4aba89ef;
later changes record documentation and raw evidence, without production edits.

## Verify Checklist

**Test Suite:** ✓ 75/75 focused tests pass: 24 contract-generation/reconciliation tests and 51 BDD proof-provenance tests. This is not a local full-repository suite claim; final PR CI must run before any merge.
**Gherkin:** ✅ Revised feature syntax passes. ❌ The separate root dry-run remains unfinished: 176 undefined expanded cases, 528 undefined steps and 7,568 imported steps skipped. Scenario quality approval is not implementation acceptance.
**Build:** ✅ Success — the real test wrapper rebuilt CLI JavaScript and declarations before the passing run.
**Lint:** ✅ Clean — root ESLint, Gherkin lint and focused test ESLint/Prettier pass. Prettier has no .feature parser; Gherkin syntax is checked by the dedicated parser, not claimed as a Prettier pass.
**Typecheck:** ✅ Clean — root lint completed CLI tsc --noEmit.
**Scenarios:** ⏭️ Bounded task repairs scenario quality and proof registration. The broad feature has 54 definitions, exactly matching 54 ledger headings and 162 unchecked boxes; none is checked off. Original 55/165 reports remain historical after deliberate duplicate consolidation.
**Refactor:** ✅ Completed — consolidated redundant R9 Given-echo into the existing real reconciliation proof; retained all dense rejection cases and exact negative assertions. No separate production refactor is warranted.
**PR Scope:** ✅ Diff matches this task: two rejected R8/R9 examples, adjacent Desktop recovery contradiction, proof mapping/test hardening and supporting evidence. No production, template, canonical-contract, dependency, fallback or generated-carrier change.
**Dep Drift:** ✅ Clean — no manifest or lock changes. Existing eight advisories and YAML patch mismatch remain deferred; this pass does not rerun or claim a clean supply-chain scan.
**Parent Epic:** N/A — separate task related to feature 5F5ZZA and epic 82T411/#4200. Neither is closed or advanced by this task.
**Reconcile:** ✅ No pattern deviation — reuse the real CLI fixture, existing canonical declaration parser, proof manifest and static fan-in guard. The guard's 75/14 limits are unchanged.
**Experience:** ⏭️ N/A — test/specification repair adds no runtime flow. Native/cloud/human experience and current conditional-guidance behavior remain unqualified target work.
**Surface Evidence:** ⚠️ Real CLI reconciliation and the scenario parser/lineage boundary pass; the new R8 conditional-guidance outcomes are target obligations, not implemented or native-qualified behavior.
**Evidence limits:** ⚠️ Full current-head CI remains required before merge. Preserve the unstarted lock timeout, original 73-pass/1-fail static fan-in run, undefined broad BDD, reviewer warnings and historical qualification failures. No unchanged paid qualification was rerun.

Audit passed for the bounded diff: no dependency violations (one module, zero
dependencies cruised), reference blocks exit 0, manual real-collaborator test
inspection and direct scope/lineage checks. See audit.md for exclusions.

## Actual checks and provenance

- Focused proof command: scripts/dev bun run --cwd packages/cli test
  tests/integration/planning-contract-generation.test.ts tests/bdd-proof-tags.test.ts.
  The initial wrapper waited 60 seconds for another checkout's live lock and
  exited 75 without starting a test. A longer serialized wait completed the
  first run: 73 passed, one shared-proof-budget failure. Final repair: 75 passed.
- Root scripts/dev bun run lint completed ESLint, Gherkin and TypeScript checks.
- All five generated surfaces are current. No templates changed; regeneration
  was unnecessary and no generated file was hand-edited.
- Rule lineage: no uncovered, stale or orphan references. Surface lineage:
  no missing or stale references. Feature/ledger names match exactly.
- Manual maintained-tool walkthrough: project codify 5F5ZZA --format gherkin
  emitted byte-identical current feature source, verified with cmp.
- Fresh full scenario review 272b8c17-3646-4e95-9481-c1da8e60f1fe approved
  with Claude/opus cross-agent independence, and the normal scenario-gate stamp
  succeeded. Warnings are reasoned dispositions, not erased or silently fixed.
- Existing K3EBHB R7 and R10 declarations were directly checked after the
  reviewer noted their absence from its packet; their existence is verified,
  not their current human-message or usability qualification.

Source and test changes are characterized existing behavior/proof hardening.
The failed proof-budget run is genuine, but it is not presented as a new runtime
behavior RED. The supported reconciliation row cannot pass on a no-op upgrade;
the refused rows cannot pass on constant success or partial installed updates.

## Scope and remaining work

The new R8 non-passed proof examples expose missing acceptance/implementation
work rather than claiming it complete. Broader step binding, native/cloud/human
qualification, R6/#5086 fallback, other review warnings, dependencies and all
historical contrary observations remain separate. The broad feature stays
scenario-gate/in_progress even though its revised scenario quality is approved.
This task does not grant merge, Ready or release authority to a new PR.
