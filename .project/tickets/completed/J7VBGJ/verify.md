# Verify — ticket J7VBGJ

TDD ledger: SHA-or-skip on RED/GREEN/REFACTOR checkboxes (incl. cross-scenario refactor).

## Verify Checklist

**Test Suite:** ✓ 1929/1929 tests pass (1 skipped, 0 failed) — refreshed 2026-05-21T17:06Z on HEAD = 1f935ea; covers test:done fix (a753301) + cross-scenario refactor (a1cb8fd)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 52 scenarios marked complete (17 scenario rows × 3 R/G/R sub-checkboxes + 1 cross-scenario row = 52 checkboxes)
**Dep Drift:** ✅ Clean (no new package.json dependencies introduced; the two new files are internal hook lib modules)
**Parent Epic:** N/A

## Audit

Audit passed. (Refreshed 2026-05-21T17:07Z on HEAD = 1f935ea — covers test:done fix + cross-scenario refactor.)

- **Architecture:** no violations (build succeeds; no circular deps detected).
- **Dead code (knip):** clean across all J7VBGJ-touched files. The original audit's `LedgerStep` unused-export was fixed (de-exported) in 4381e76. The only remaining unused devDep — `prettier-plugin-sh` — is pre-existing and unrelated to this ticket.
- **Duplication (jscpd):** 0 clones across the touched hook files. The cross-scenario refactor (a1cb8fd) explicitly _removed_ duplication (HookResult + expectHookAllow + expectHookDeny extracted to helpers.ts — ~30 LOC of duplication eliminated).
- **Outdated deps:** unchanged from original audit. 2 dev-only packages with major bumps (eslint 9 → 10, eslint-plugin-jsdoc 62 → 63). Both deferred per the standard triage matrix (dev-major = research migration path, separate task — not in scope for this feature).
- **Learning files:** all conform to the `Covers:` line-3 convention; no INDEX.md drift.

## What this feature delivers

Three enforcement layers, all live:

1. **Write-time** ([pre-tool-quality.ts](packages/cli/templates/hooks/pre-tool-quality.ts)) — blocks `[ ] → [x]` transitions on `test-definitions.md` that lack a SHA or `skip: <non-empty reason>`. Validates Edit, Write, and MultiEdit tool calls.
2. **Commit-time** ([pre-tool-quality.ts](packages/cli/templates/hooks/pre-tool-quality.ts)) — blocks `Bash(git commit *)` during the REFACTOR step if any staged file is a test file. The only file-path commit rule that survived scope reduction ([procedural-gates-generalize-beyond-tdd.md](.safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md)).
3. **Done-time** ([stop-quality.ts](packages/cli/templates/hooks/stop-quality.ts)) — validates per-scenario SHA distinctness, reachability from HEAD, non-empty skip reasons, at-least-one-real-SHA-per-scenario, and the feature-level cross-scenario refactor row.

Pure-legacy tickets (no annotations anywhere) remain silently exempt — the validation is forward-looking only, with no migration code added.

## Scope-reduction trail

Implementation surfaced and applied two scope reductions:

- **RED file-path commit rule dropped** (commit `56d573a`) — TDAD finding plus safeword's own [procedural-gates-generalize-beyond-tdd.md](.safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md) learning. Rule was not load-bearing; the SHA-distinctness check at done already catches commit bundling.
- **Per-task → per-scenario framing** (commit between Phase 3 and 4, pre-implement) — Original "per-task" scope conflicted with safeword's existing per-scenario TDD discipline in [.claude/skills/bdd/TDD.md](.claude/skills/bdd/TDD.md) line 20. Annotation extends the existing per-scenario checkboxes rather than introducing a parallel task-level ledger.

## Defect found during implementation

Task 3 integration testing surfaced that `parseTddStep` in [active-ticket.ts](packages/cli/templates/hooks/lib/active-ticket.ts) used `\s*$` to anchor the checkbox regex, rejecting the new annotated form (`- [x] RED abc1234`). Fixed inline in commit `ba86f2b` — changed to `\b` word boundary. All 11 existing parse-tdd-step regression tests still pass.

## Schema registration

Two new hook lib files were registered in `SAFEWORD_SCHEMA.ownedFiles` (commit `ead7883`) so `safeword setup` deploys them to customer projects. Caught by the existing schema drift tests; 25+ integration tests passed only after this fix landed.

## Dogfooding evidence

All 17 scenario rows in this ticket's [test-definitions.md](.safeword-project/tickets/J7VBGJ/test-definitions.md) carry the new annotated format (SHA or `skip: <reason>`), validated by the live write-time hook as they were marked. The cross-scenario row at the bottom is also annotated. This feature successfully dogfooded itself end-to-end during implement.

## Commits this feature

```
e68c5c8 chore(tickets): mint J7VBGJ (TDD SHA-checkbox ledger) and MKVNFB
383587d test(J7VBGJ task 1 RED): parser/validators
425a354 feat(J7VBGJ task 1 GREEN): implement parseCheckboxAnnotation/classifyAnnotation/isValidSkipReason
b01ba69 chore(J7VBGJ): work log — Task 1 RED/GREEN/REFACTOR complete
56d573a chore(J7VBGJ): drop RED file-path rule per existing TDAD learning
149fe3e test(J7VBGJ task 2 RED): write-time gate integration tests for Rule 1
ee1f54c feat(J7VBGJ task 2 GREEN): write-time SHA-or-skip annotation gate
8823114 chore(J7VBGJ): mark Rule 1 scenarios with SHAs + work log
2939941 test(J7VBGJ task 3 RED): commit-time REFACTOR gate integration tests
ba86f2b feat(J7VBGJ task 2 GREEN): commit-time REFACTOR gate + parseTddStep fix
4683a22 chore(J7VBGJ): mark Rule 2 scenarios with SHAs + work log
a0e1935 test(J7VBGJ task 4 RED): validateLedger unit tests for done-gate Rules 3+4
1000536 feat(J7VBGJ task 4 GREEN): done-gate annotation ledger validator
b9838cb chore(J7VBGJ): mark Rules 3+4 scenarios with SHAs + work log
feb36fd docs(J7VBGJ task 5): propagate annotated checkbox format to bdd skill + template
ead7883 fix(J7VBGJ): register parse-annotation + ledger-validation in SAFEWORD_SCHEMA
```
