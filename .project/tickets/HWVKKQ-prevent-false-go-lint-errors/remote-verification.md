# Remote verification and refactor follow-up

## Full refactor verification

Verified revision: beac76fc375634b41b1ca0e9a6cf0acb8d345435.
Current run: https://github.com/ArcadeAI/safeword/actions/runs/39695922147
Result: SUCCESS across every required job; deployment jobs skipped by policy.

Both Node 22.23.2 and 24.18.1 passed 11,645 CLI tests with 10 explicit skips,
one physical-install proof, 153 collector tests and 83 release tests. Relay
passed 198 with one skip on Node 22 and 199 on Node 24. Acceptance passed all
601 scenarios and 11,821 steps, followed by 51 proof-tag tests. Both Go versions
passed 49 focused tests; modern Go also passed 12 installed-hook tests with
shuffle seed 4733. Static, generated, parity, contract, OpenCode conformance and
configured dependency-policy checks all passed. remote-result.json is the
machine receipt. Later commits contain ticket evidence only.

Four source refactors were isolated and committed: config search-order caching,
caller-directory naming, capability-predicate naming and helper transport/JSON
validation extraction. Added proof covers format precedence, malformed helper
results, legacy YAML scalar policy, and formatter-before-linter ordering.
Both independent Claude/Opus passes approved without errors. See the complete
ledger and review notes for declined abstractions and nonblocking limits.

## Previous audit-fix verification

Verified revision: 536dd1fe7aaf2eb660f7fac108cef396fe1b54ed. Changes after the
earlier verified e4a3b079997efa91df1fad43d27e3026c7d5e258 add stronger regression
tests, isolated installed-hook fixtures, supporting CI coverage and evidence.
The runtime implementation is unchanged from that earlier verified revision.

Current run: https://github.com/ArcadeAI/safeword/actions/runs/39686478082

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
followup-review.json. Observations at that checkpoint concerned aggregate
context across multiple edited targets, other registered signal listeners,
and coverage of partial temporary-file writes. The latter now has an automated
OS-limited write-failure regression test, verified on macOS and Linux. The cap is per lint response;
it does not promise a global cap over unrelated hook guidance or many targets.

Local follow-up evidence: all 30 Go-focused tests passed after both refactors;
five targeted inventory, Codex and golden-path checks passed after the remote
corrections. An earlier mixed run had three timeouts, which are retained as
limited local evidence rather than silently counted as passing. Architecture,
ESLint, typecheck, formatting, parity and generated-surface checks passed.

## Earlier remote result

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

## Final audit-fix result

Run 39686478082 passed every job for 536dd1fe7. Both Node lanes passed
11,633 CLI tests with 10 skips, physical-install proof and 83 release tests.
Acceptance passed 601 scenarios, 11,821 steps and 51 proof-tag tests. Both Go
versions passed 37 focused tests; the current-linter job additionally passed
12 installed-hook tests with shuffled order, seed 4733. All lint, typecheck,
formatting, architecture, parity, dependency-policy and conformance checks passed.

The audit fixed shared mutable golden-path fixtures, two ineffective no-throw
assertions, workflow path quoting and stale coverage notes. Its executable
checks again found no config drift or dependency violations. All actionable
findings are resolved; the remaining evidence limits are recorded in verify.md.
The three earlier local timeout failures did not reproduce in the remote full
suites. remote-result.json contains the final machine receipt. Subsequent
evidence-only commits do not change the verified test or runtime implementation.
