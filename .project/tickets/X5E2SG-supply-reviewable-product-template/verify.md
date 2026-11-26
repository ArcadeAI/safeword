# Verification: supply a reviewable Product Plan scaffold

Code candidate: `33126fb3f`, branch `codex/4200-product-template`, based on
main `e00ea1e65`. No remote publication, qualification or review-route change.

## Verify Checklist

**Test Suite:** ✓ 27/27 planning-context and routed-writer checks pass; 68/68 additional writer/schema checks pass; 81/81 release checks pass. Counts are separate, not a full-suite total.
**Gherkin:** ✅ Acceptance lane passes through the shared repository completion check, which returns `ok:true`.
**Build:** ✅ Success — CLI bundles and declarations built by the test wrappers.
**Lint:** ✅ Clean — changed TypeScript test and pre-commit Markdown checks.
**Typecheck:** ✅ Clean — strict CLI package check.
**Scenarios:** Task regression passes; no original feature-ledger credit granted.
**Refactor:** ✅ No change warranted — reuse the real writer and existing validator.
**PR Scope:** ✅ Diff matches ticket scope — canonical template, writer regression, generated copies and fixture digests, task records.
**Dep Drift:** ✅ Clean — unchanged frozen lockfile; no dependency change.
**Parent Epic:** #4200 remains incomplete; no sibling completion state changed.
**Reconcile:** ✅ No pattern deviation — existing schema-owned template and generators.
**Experience:** ⚠️ Real writer now produces the required structural fields; semantic authoring and the separate assisted native journey remain distinct proof.
**Surface Evidence:** ✅ CLI writer/validator plus generated Claude, Codex and installed dogfood copies verified; no new native-host journey claimed for this branch.
**Evidence limits:** ⚠️ Targeted package and release checks, not another full CLI or monorepo-suite run. Native Codex's manually repaired spec is on a different candidate and cannot impersonate this branch's generated output.

## Outcome and proof

The canonical template now declares the four Product Bet fields already
required by planning review: persona outcome inventory, known facts,
assumptions and unresolved product decisions. The validator and review policy
are unchanged. Placeholder content still needs real authoring and semantic
review; structural compatibility is not approval.

A direct CLI probe at the final code candidate creates a standalone feature
in a disposable directory. Its rendered Product Bet visibly contains all seven
required labels and is accepted by the unchanged validator. The probe does
not submit placeholder content for semantic approval. No additional builder
step is added: the existing authoring fields are now visible in the scaffold.

The regression creates a standalone feature through the actual ticket writer,
then applies the same validator called by planning-role resolution. Before
the fix it fails with incomplete Product Bet framing: one failure, eight
passes. That uncommitted failing test was then committed as `34418fe50`.
After the template change, all nine routed-writer tests pass within the
27-check planning-context run. This closes the real scaffold-versus-handmade
fixture gap without adding a second list of required fields to the test.

Generated fixture changes were inspected: Cursor tree hashes change because
the installed spec-template bytes change; all result_sha256 values remain
unchanged. All five generated surfaces are current. No runtime bundle changes
or unexpected dependency changes were required.

Intake review `4232a993` and complete changed-file review `aa9feb5e` approve
with cross-agent Claude Opus 5.5. Supported intake and implement phase stamps
succeeded before advancing. Warnings remain: this regression covers the
standalone local-writer path and structural frame acceptance, not every
tracker path or full native review. Existing broader context checks supply
separate coverage; they are not fabricated end-to-end proof.

## Audit and retained evidence

Audit passed. The diff-scoped dependency check reports no violations; only
the changed test module is selected because this fix adds no runtime code.
The writer regression uses isolated real filesystem state, the real template
and existing validator, with no added sleeps or production mocks. No changed
agent configuration, learnings, persona references or new dependencies.
No additional cross-scenario refactor is warranted. Raw logs and receipts are preserved
under the permanent trial archive's `epic-followthrough-2026-11-09/template-repair/`.
The first native scenario errors and successful assisted correction remain in
the parent archive; they were not overwritten by this source repair.

The misleading missing-context wrapper message is outside this bounded fix.
Original missing RED, failures and all 33 deferred cases remain unchanged:
MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1. No epic completion is claimed.
