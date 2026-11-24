# Retrospective reviewer semantic calibration

This repository-only corpus tests a probabilistic boundary that substring tests
cannot prove: whether the actual exported eligibility/proof rules distinguish
valid behavioral discrimination from misleading evidence. Eight synthetic cases
include two valid controls and six false-credit hazards. Every verdict and its
controlling reason must match the reference labels. No evaluation grants real
review authority or repairs original test-first history.

`guide.ts` loads the current exported reviewer rules and appends one shared
response vocabulary. Cases have neutral IDs; per-case reference labels are
never sent to the model. One controlling-reason priority avoids ambiguous
multi-label grading. Initial calibration found overlapping reason labels in two
cases; the shared response contract was clarified before recording this corpus.
Production reviewer rules were not weakened to obtain a passing result.

`records.json` was produced by the existing cold-start recorder using real
headless Claude calls. Its historical `data-architecture-eval.ts` name does not
mean data-architecture records count as retrospective evidence. The recorder
binds actual guide bytes, cases, rubrics, prompts and the checked-in inference
contract. It replaces records only after the entire corpus passes. The model
alias and CLI version are operator-selected contract assertions, not independent
provider attestation. These summary-packet decisions do not measure full
production coordinator reliability or every possible mutation.

Offline verification, from `packages/cli`:

```bash
bun tests/fixtures/retrospective-review-eval/guide.ts > /tmp/retrospective-review-guide.txt
bun scripts/data-architecture-eval.ts verify \
  --guide /tmp/retrospective-review-guide.txt \
  --corpus tests/fixtures/retrospective-review-eval
```

For an explicit live refresh, change `verify` to `record` and append a structured
adapter argv using the same response schema as the recorder. The recorded run
used Claude CLI 2.1.330, model alias `opus`, high effort, tools disabled, slash
commands disabled, empty setting sources, strict empty MCP configuration and
no session persistence. The adapter receives one prompt through stdin and
returns JSON containing `decisionIds` and `proofFactIds`, each a single string.
OAuth/keychain authentication remains available through the normal signed-in
CLI; `--bare` intentionally disables that authentication and was not used for
the successful run. No credentials were copied into this corpus.

Owner: Safeword reviewer maintainers. Refresh after reviewer rules, cases,
reference labels, model or inference controls change, and before closing a
material reviewer change. Live refresh spends model tokens and stays outside
the default test lane. Normal tests regrade the stored corpus and prove that
always-approve, always-reject, missing-case and stale-rule records are refused.

The real Codex installation proof is separate:
`tests/review/legacy-electron-installed-route.live.test.ts` packs the real plugin,
installs through a disposable supported marketplace, removes its sources, and
calls the cached public route. It uses no model calls or real approval records.
Portable BDD mappings remain supporting contracts; they do not substitute for
that installation check or the retained real Electron delivery evidence.
