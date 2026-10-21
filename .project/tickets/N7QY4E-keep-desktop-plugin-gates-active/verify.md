# Verification: keep quality gates active for Claude desktop users

Implementation commit: `c0af11ddb`.

## Verify Checklist

**Test Suite:** ✓ 11885/11885 tests pass across the root JavaScript suite; 15 additional tests skipped by existing conditions.
**Gherkin:** ✅ Acceptance lane passes — `scripts/dev bun run test:bdd`; 597 scenarios, 11,140 steps, and all 51 proof-tag tests pass.
**Build:** ✅ Success — `scripts/dev bun run build`.
**Lint:** ✅ Clean — `scripts/dev bun run lint`.
**Typecheck:** ✅ Clean — `scripts/dev bun run typecheck`.
**Scenarios:** ⏭️ Skipped — task uses inline tests; all five ticket checks completed.
**Refactor:** ✅ No change warranted — all three consumers use one shared integrity helper.
**PR Scope:** ✅ Diff matches ticket scope — integrity handling, regression tests, generated runtime carriers, and supporting evidence only.
**Dep Drift:** ✅ Clean — reuses the existing, architecture-documented `yaml` dependency; manifests and lockfile unchanged.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — raw inventory hashes retained; optional skill digest shared across generation, dispatch, and status.
**Experience:** ⏭️ N/A — internal integrity fix adds no user steps.
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof: generated Claude dispatcher and public status observation.
**Evidence limits:** ⚠️ Fixed runtime exercised in temporary plugin copies; actual desktop-synced skill files checked read-only. No updated release installed into the running desktop app.

## Proof

| Boundary | Command or observation | Result |
| --- | --- | --- |
| Original regression | Dispatcher test before implementation | Failed with the reported damaged-cache message and no hook result |
| Targeted plugin behavior | CLI test wrapper over asset-integrity, dispatch, profile-install, and catalogue tests | 136 passed, 1 skipped |
| Complete CLI suite | `scripts/dev bun run test`, CLI portion | 707 files passed; 11,534 tests passed; 14 skipped |
| Other root packages | Same root test command | Relay 198 passed, 1 skipped; collector 153 passed |
| Real desktop data | Compare all generated exposed skills with same-version local desktop organization copy | 24/24 semantic digests match; 16 had different raw bytes |
| Generated surfaces | `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts` | All five current |
| Independent review | Claude Opus, cross-agent receipt `bac2388a-d609-4868-84b6-f3f9619579f9` | Approved, no blocking findings |

The verification skill's unmodified helper ran the complete root test command
successfully, then redundantly scheduled the CLI package suite again. That
duplicate process group was stopped after the complete successful result;
build, types, dependency audit, and acceptance checks were run explicitly.
Unchanged Python/Go experiments and the website are outside this fix's proof scope.

## Dependency audit

`scripts/dev bun audit` reports seven existing vulnerabilities: two high,
two moderate, and three low. This change modifies no dependencies or lockfile.
The affected packages and advisory links are saved in
`evidence/dependency-audit.log`; this is a failing repository-wide audit, not
a passing check or a regression introduced by this fix.

## Review notes and limits

Current exposed skills and the actual desktop rewrite are verified. The
reviewer's locale-sensitive key-ordering warning does not affect the current
lowercase ASCII keys; broader metadata key sets remain a non-blocking concern.
Equivalence is deliberately defined by YAML 1.2 core parsing, rather than a
claim to match every possible host parser or future host rewrite. Runtime and
skill-body bytes remain exact.

The fix is committed locally. Publishing, merging, and installing an updated
release were not performed. The ticket remains in verification pending user
confirmation of closure.
