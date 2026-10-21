# Branch audit and refactor ledger

Scope: issue 6004 changes above the merge base with origin/main. Production
integrity logic, its generator/profile/dispatcher wiring, related tests, changed
learnings, and directly affected local documentation are included. This is not
a repository-wide cleanup.

## Audit improvements

- [x] A1: Made YAML mapping-key ordering deterministic for distinct Unicode keys that compare equal under locale collation. The new regression failed before the fix; all 25 integrity cases now pass.
- [x] A2: Split the status outline's stale-version and wrong-manifest-digest examples so each named input is constructed.
- [x] A3: Documented semantic skill verification versus byte-exact runtime/template verification in the configured public docs and architecture description.
- [x] A4: Added malformed-metadata cases through the real dispatcher and profile observer; structured approval/no proof and errored health are required.
- [x] A5: The wider scope lane exposed two cleanup snapshot regressions from the earlier inclusive-snapshot improvement. They reproduce with R2 reverted: confirmed cleanup creates the permitted current-project marker. Both snapshots now exclude exactly that marker and separately require its `clean` state; read-only and rejection snapshots remain inclusive. The four targeted cleanup/damaged-cache examples pass. An initial command-adapter failure did not reproduce in the isolated damaged-cache examples; no production change was made for it.

## Refactor ledger, in dependency order

- [x] R0: Flattened the mutation fixture's auto-fixed nested block and made the runtime case explicit. All 66 dispatcher tests passed before the separate refactor commit.
- [x] R1: Extracted the repeated desktop header normalization fixture into one test helper, keeping changed-byte assertions at the callers. Both affected suites passed 100 tests, with the existing prerelease-only skip, before the separate commit.
- [ ] R2: Calculate the diagnostic asset hash only on failed integrity validation, avoiding duplicate hashing on successful hooks. Preserve the diagnostic, regenerate carriers, test and commit separately.

## Mechanical audit evidence

- Config-drift check passes; the final dependency-cruiser run reports no violations across 82 modules and 119 dependencies, including the extracted test helper.
- Changed learnings pass their Covers checks; changed domain references produce no findings. No agent configuration changed.
- Docs sources are configured: README.md and packages/website/src/content/docs. Only the native Claude integrity section is affected; no new dependency or architectural layer is introduced.
- Explicit ticket selection resolves all three task tickets. None has an implementation plan declaring principle traces, so this check is not applicable.
- Python dead-code automation is unavailable: the installed `deadcode` is the Go tool, not a Python checker. Only archived Python fault-probe scripts changed; production Python is outside this diff. Knip, repository clone totals, and dependency freshness are intentionally outside diff-audit scope.

## Explicitly deferred scope

The older S2/S3/S5/S6/S7/S8 findings concern broader containment, lifecycle
convergence, historical traceability, profile modeling, authenticated live-host
checks, and superseded specifications. They remain recorded in the historical
assessment. This audit does not invent new product flows, enable WIP lanes, or
add live-host infrastructure. The scoped scouts found no other current shipped
payload defect or dead production code.

The review also notes hypothetical host-parser differences and unsafe-integer
policy choices. This change keeps the established YAML 1.2 core/JSON-value
contract rather than adding new metadata restrictions. These are non-blocking
policy questions, not demonstrated failures for the shipped skills.

## Audit verification

- Relevant Vitest files: 140 passed; one existing stable-version prerelease skip.
- Native BDD: 65 scenarios and 3,110 steps passed.
- CLI build, root lint, Gherkin validation, and package typecheck passed. All five generated surfaces were regenerated and verified.
- Independent Claude Opus review approved with cross-agent independence, receipt `9816f29e-e728-4b7d-8d7a-513f64919509`. The prior request for caller-level malformed-metadata proof was resolved with real cache tests and caller source evidence.
