# BDD proof regression corpus

This versioned corpus is the shared oracle for Safeword's BDD review, advisory
detection, evaluation, and falsification work. Each case contains the same two
inputs a reviewer sees:

- `feature.feature` — the claimed behavior;
- `steps.ts.txt` — the primary executable proof and its glue, stored as source
  text so corpus snippets are never collected as this repository's live tests.

`manifest.json` is the machine-readable oracle. `expected_verdict` is either
`accept` or `reject`; `reason` states the observable evidence boundary behind
that verdict. Every rejected regression names a `neighboring_valid_case` so a
consumer cannot learn the broader but incorrect rule that all reuse is hollow.
Schema v2 also records exceptional reference execution: `baseline_failure`
names an expected wrong-RED setup failure, while `defect_modes` requires an
accepted proof to catch each listed defect independently.

Run the deterministic, network-free corpus contract with:

```sh
cd packages/cli
bun run test tests/bdd-proof-corpus.test.ts
```

The package test wrapper rebuilds `dist/` under the repository's global build
lock before Vitest starts. Running Vitest directly skips that prerequisite and
can correctly report that the distribution is stale relative to `src/`.

To add a regression, add one minimal rejected case, add or reference the nearest
accepted control, and register both in the manifest. Consumers import
`loadBddProofCorpus` and pass their classifier to `runBddProofCorpusOracle`.
The oracle compares a consumer's verdicts with the versioned expectations; it
does not classify proofs itself. The corpus contract does provide an executable
reference check: it materializes every proof, runs real Cucumber scenarios for
both a clean baseline and an injected defect, and derives the verdict from
whether the proof catches that defect. Reviewer, detector, evaluation, and
falsification tickets own their classifiers and import the corpus in their test
or evaluation lanes. Production runtime code must not depend on test fixtures.

The corpus includes delivery-derived boundaries as first-class pairs. In
particular, the #2328 set distinguishes exact collaborator argv from flag
presence, reachable-chunk completeness and source-map provenance from entrypoint mtime, sanitized
agent scope from inherited host state, typed success from success-looking
content, and approved fixture execution from direct process spawning.
