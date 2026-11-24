# Harden the bounded #5041 proof

The user requested the three improvements identified in the test-quality
assessment of Draft #5957 at `c2d503233`: reconcile the contradictory BDD
invalidation example and proof mapping, cover all three native phase assets,
and prove missing-clause refusal preserves installed contracts. No production
behavior, reviewer rubric, qualification corpus, or #5051 work is added.

## Scenario and proof boundaries

- The canonical Execution owner supports only `both_plan_reviews`. The existing
  semantic receipt-invalidation scenario now states that supported direction;
  its historical unchecked ledger remains unchanged. No validation test is
  claimed to prove semantic receipt invalidation.
- A separate scenario, `Invalid Execution invalidation declarations preserve
  installed contracts`, names the real CLI upgrade refusal and unchanged bytes.
  Its `@proof.vitest` manifest routes to the existing eight-row invalidation
  matrix. The representative unsupported direction is included; the denser
  parser variations remain lower-level cases. The new ledger entry remains
  unchecked rather than inventing historical RED/GREEN/REFACTOR evidence.
- Missing shared-clause cases now begin with pending valid updates in all three
  contracts, then corrupt one generated contract. Each refusal must leave all
  three original installed files byte-identical. This proves preservation even
  when another contract has an otherwise-valid update waiting to be applied.
- Native dispatch covers Claude and Codex crossed with Product, Implementation,
  and Execution phases. Each case runs the generated distribution with no source
  template fallback, accepts canonical assets, refuses cosmetic drift and a
  missing asset without launching the simulated reviewer, then accepts exact
  restoration. Execution uses the existing one-coherent-change conformance
  fixture and an explicit simulated reviewer result, not a live qualification.
- Bundle identity assertions derive all three expected host paths and raw file
  hashes independently, rather than calling the production generator helper.
  The remaining common runtime must still match byte-for-byte.

## Evidence discipline

These are characterization and test-fixture repairs for existing working
behavior, not new production-feature REDs. The first run passed 27 cases and
failed the two Execution setups. Its simulated reviewer selected a nested
`schema_version` object instead of the root packet. The inherited host PATH also
allowed fallback discovery, producing an authentication classification rather
than the fixture process failure. The corrected fixture selects the root JSON
line and restricts reviewer PATH to the simulated binary plus system tools.
An intermediate isolation attempt could not locate Bun; the existing absolute
`realBunExecutable` helper repairs that setup without broadening reviewer PATH.
All attempts are retained separately; none is relabeled as a product RED or a
passing semantic qualification.

The original three live semantic failure observations, historical qualification
reuse limits, six failed/585 unfinished broad acceptance record, 33 accepted
deferred cases, and native host retrieval/private-injection deferral remain
unchanged. No paid qualification is repeated. This work does not close the
parent ticket, stamp a complete scenario gate, promote the Draft, or merge it.

This document and the changed tests/feature are the bounded source for external
quality review. Review scenario-to-proof fidelity, phase/host independence,
fixture isolation, and refusal preservation. Do not interpret unrelated parent
acceptance debt as newly completed by this test-hardening slice.
