# Test-hardening verification

Later requested test edits, formal closing checks, audit correction and current
results are in `verify.md` and `audit.md`. This record retains its earlier inputs
and observations.

This is the bounded follow-up to `c2d503233`, not a replacement for
`5041-verify.md` or its historical evidence. The hardening changes no production
source, shipped template, reviewer prompt, qualification corpus or admission
descriptor. The changes are the three authorized test-quality repairs, an independent bundle
identity oracle, scenario/proof mapping, and their evidence.

## Deterministic results

- Native Claude/Codex crossed with all three planning phases: 6/6 passed.
  Canonical, comment drift, missing asset and exact restoration all run through
  generated native distributions; only the reviewer subprocess is simulated.
- Shared generation/refusal preservation, BDD proof manifests, feature
  maintainability and bundle identity: 95/95 passed across four files.
- Repository lint and all three package typechecks passed.
- Before the final main refresh, all five generated surfaces were current and
  all 276 mirror pairs / 11 contracts were in sync. The hardening itself required
  no template regeneration; the inbound main change required the regeneration
  recorded below.
- Full root suite before the final main refresh: retro relay 198 passed / one skipped; collector 153 passed.
  CLI: 687 files passed / one failed; 11349 passed / one failed / 14 skipped
  (11364 tests), exit 1, 872.46 seconds. All newly hardened tests passed.
- The sole failure was the unchanged `starts OpenCode when the shared deadline
  can fund another route` test. It returned success through the route log
  `codex, claude`, while the assertion requires `codex, opencode`.
- That exact test then passed unchanged in isolation: one passed / 138 filtered
  skips. This does not turn the failed full run into a pass. The route difference
  did not reproduce in isolation; its precise cause remains unestablished. No
  unrelated test, timeout, route policy or production workaround was changed.

The new scenario is routed explicitly through `@proof.vitest` and its manifest.
Passing the manifest alone is static provenance; the named eight-row real CLI
upgrade/refusal test also ran and passed. No whole-feature Cucumber acceptance
or previously unchecked semantic receipt-invalidation scenario is claimed.

## Final main refresh

After the hardening commit `45d9bd138` was pushed, GitHub reported conflicts with
main `172aac2c8`. The branch was rebased onto that main, retaining its hook fix
that places recovery guidance in the denial reason. Source changes merged
automatically; conflicts were confined to generated catalogues, native carriers
and lifecycle fixtures, regenerated in the safe order. The hardening test and
feature files remain byte-identical to `45d9bd138` after the rebase.

The full failed run and isolated pass above retain their original pre-refresh
baseline. They are not represented as a new-head full-suite result. Post-refresh
verification targets the hardened tests, real installed copy guards, all four
changed-main denial test files, and the public review-routing matrix. Current-head
CI and fresh independent review remain separate requirements.

The final main verification set passed 372/372 tests across 11 files, including
all 139 public review-routing cases, the hardened tests, installed copy admission
and all four denial-test files changed by main. Final repository lint and all
three typechecks passed. Both native bundles and all five generated surfaces
were regenerated and verified; all 276 mirror pairs / 11 contracts are in sync.
The Execution prompt and corpus remain exactly
`4cc38db52651b7073d8677ff89b94d896ba0b2321125d8eaef31c6152543e533` and
`833df049ac3d3cbe119fac7f8ecf43c614e1cf6c4d64b97c4f0781e4ee8f6309`.
No new-head full-suite pass is claimed; the original failed full run remains
visible. The subsequent independent-review retry is recorded below.

The current built CLI was also exercised read-only on the real project with
host/plugin environment variables cleared: `ticket planning-contract-check
5F5ZZA` reported `current` for Product, Implementation and Execution phases,
all exit 0. This is copy-check usability, not phase approval or native UI proof.

## Earlier independent-review authentication failures

The three current coordinator attempts returned Codex with
`independence: degraded`, not independent Claude coverage:

- `5bcf9a26-0653-495b-acee-ab5592f9304f`
- `a6daec1b-b7b9-4acb-bc8e-4da39408b500`
- `436190fe-4ccd-4887-bf7e-b5d0e3a7b663`

All returned no actionable defects, but the actual reviewer was the authoring
agent in another process. They cannot satisfy the independent-review requirement.
A temporary diagnostic wrapper on the normal coordinator route identified the
Claude result: `Failed to authenticate: OAuth session expired and could not be
refreshed`. Only that sanitized diagnosis is archived; login URLs, OAuth state
and credentials are excluded. The normal `claude auth login` flow was opened;
user authentication is still needed before retrying independent review.

The earlier source/rebase approvals remain historical evidence for their own
inputs. They are not carried forward as approval of this test-hardening change.
After authentication, rerun the same bounded coordinator command and retain its
actual reviewer, model when reported, independence and verdict.

## Retained limits

Fixture setup failures and characterization results are distinct records. The
fake reviewer root-packet parser and isolated Bun launcher were repaired; their
setup failures are not product REDs. No historical R/G/R checkbox was rewritten.
The new scenario ledger remains unchecked rather than fabricating such evidence.

The original three live semantic failure observations, historical admission reuse
limits, six failed/585 unfinished broad acceptance record, 33 accepted deferred
cases, and native host retrieval/private-injection deferral remain unchanged.
No unchanged paid qualification was rerun. No #5051 work is included.

Raw/compressed observations are in `evidence/5041-test-hardening/`. The Draft
remains blocked by checks and the earlier qualification/admission objection.
No promotion or merge is authorized.

## Successful independent-review retry

At reviewed head `04e9d72eecee1845e9baa578ed1b194e79f1485c`, the same bounded
coordinator request returned review `0ff245cd-b099-4213-a5fc-581703b62734`:
`status: approved`, `actual_reviewer: claude`, `reviewer_model: opus`, and
`independence: cross-agent`. Claude found no errors and four warnings. This is
fresh independent coverage of the declared test-hardening targets and context,
not a new whole-epic approval or semantic qualification.

- Proof wording: relabeled native dispatch as supporting dispatch-refusal proof.
  It does not prove the stored-receipt/local-hook phase-transition scenario;
  that ledger stays unchecked.
- Pending-update setup: the tests assert regenerated templates differ from
  installed snapshots. An installer transformation could make that precondition
  weaker than intended. Direct changed-clause assertions would strengthen it;
  deferred as non-blocking test hardening, with no additional claim of proof.
- Runtime identity: both native host fixtures use the authoring runtime `codex`.
  Claude asset layout is exercised, but Claude-runtime-specific dispatch paths
  are not. Retained as an explicit coverage limitation; no native Claude UI or
  host-runtime parity claim is added.
- Bundle formatting: the independent identity oracle expects a particular
  single-line bundle literal. Formatting changes fail loudly; this remains
  maintenance fragility, not silent false acceptance.

The coordinator also confirmed fixture isolation: malformed packet selection
fails noisily and restricted PATH cannot discover a real reviewer. The earlier
degraded attempts and authentication diagnosis remain preserved as history.
No production or test code changed after this review; follow-up changes are this
evidence, the narrower proof description, and generated architecture freshness.

CI at the reviewed head completed successfully on Node 22.23.2 and 24.18.1.
Its lint job failed at architecture-document freshness (job `118209472277` in
run `39296261738`), not source lint. The architecture generator added the missing
planning module and marked unreconciled module prose stale; those emitted markers
are preserved. Freshness is rechecked locally. New evidence-commit CI remains
pending; the earlier failed local full run and qualification objections remain
visible. Independent review is no longer blocked by authentication.
