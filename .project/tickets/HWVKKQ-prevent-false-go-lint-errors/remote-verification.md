# Remote verification and refactor follow-up

Revision under test: e4a3b079997efa91df1fad43d27e3026c7d5e258. Its only change
from production revision cc1a96e7f690520e10fa90930faf222ee8191611 is architecture
documentation reconciliation.

Current run: https://github.com/ArcadeAI/safeword/actions/runs/39667499218

Previous production run: https://github.com/ArcadeAI/safeword/actions/runs/39664728877

The first run, 39649296690, exposed three validation gaps and one unsupported
test-toolchain pairing. Both Node suites otherwise passed 11622 tests before
their three failures. The hidden-helper inventory now includes hook go-lint;
Go golden-path fixtures pin the built CLI under test; the generated module
inventory includes go-lint; the current linter lane uses Go 1.25 because its
Linux binary cannot decode the Go 1.27 export-data version. The v2.0.0 lane
continues to use Go 1.24.

## Audit and refactor

- 731e56450 extracts YAML parsing from format dispatch without changing merge,
  scalar, alias or subsequent validation behavior. Eighteen real-linter policy
  checks passed across both versions immediately after the extraction.
- 258accff3 names the stdout/stderr capture capacities as character counts.
  Values, chunk accumulation, notices and signal ownership are unchanged.
- cc1a96e7f fixes the audit finding at the Codex fallback boundary: warning-only
  lint output is bounded before becoming additionalContext. A real Codex probe
  reproduced 30039 bytes before and 16381 bytes after the fix. Parameterized
  boundary tests cover warning-only and warning-plus-findings responses.

The scout ledger records why a larger executor extraction and generic process
framework were declined. All entries are resolved. The post-refactor diff audit
reported no dependency violations across 539 modules and 949 dependency edges.
No dependency manifests or lockfiles changed.

Independent follow-up review: APPROVE, Claude/Opus in a separate headless
process, review a8655cf9-7403-4631-b263-7060959b545d. Receipt:
followup-review.json. Remaining nonblocking observations concern aggregate
context across multiple edited targets, other registered signal listeners,
and coverage of partial temporary-file writes. The cap is per lint response;
it does not promise a global cap over unrelated hook guidance or many targets.

Local follow-up evidence: all 30 Go-focused tests passed after both refactors;
five targeted inventory, Codex and golden-path checks passed after the remote
corrections. An earlier mixed run had three timeouts, which are retained as
limited local evidence rather than silently counted as passing. Architecture,
ESLint, typecheck, formatting, parity and generated-surface checks passed.

## Remote result

The production run passed both Go lanes (30/30 each), CLI contract, lint, parity,
dependency policy and OpenCode conformance. Its Node 24 CLI suite passed 11625
tests with one failure in the documentation readiness assertion. The generated
inventory had correctly added go-lint but marked the existing prose stale.
All 40 module descriptions were checked against the current module paths and
baseline inventory, then reconciled without rewriting their purpose prose.
The four documentation tests and architecture freshness check pass locally.
The final run includes that documentation correction and completed successfully:

- Both Node lanes: 11626 CLI tests passed, 10 explicitly skipped; relay and
  collector suites passed; physical-install proof passed; 83 release tests passed.
- Both Go lanes: 30 tests passed per lane.
- Acceptance: 601 scenarios, 11821 steps and 51 proof-tag tests passed.
- Lint, typecheck, formatting, Shellcheck, architecture freshness, CLI contract,
  generated-plugin freshness, parity, dependency policy and OpenCode conformance
  passed. Production deployment jobs were correctly skipped for this branch.

Machine evidence is recorded in remote-result.json. The architecture inventory
correction received independent approval in inventory-review.json. Later ticket
evidence commits do not change the verified implementation.

The repository dependency-policy job permits its documented existing advisories;
its pass does not mean the unrestricted local audit found zero advisories.
