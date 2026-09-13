# Verification: Keep the Claude plugin installable and recoverable

## Verify Checklist

**Test Suite:** ✓ 9989/9989 tests pass (14 skipped); 52/52 focused plugin-contract tests and 12/12 Claude release-contract tests pass
**Gherkin:** ✅ Acceptance lane passes (1493 full-lane scenarios passed before the test-scope correction; all 3 corrected scenarios and 137/137 steps pass; 3 scenarios skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete (task ticket uses inline acceptance checks)
**Refactor:** ✅ No change warranted — the generator and dispatcher changes remain at their existing ownership boundaries
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal plugin packaging and recovery plumbing
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof
**Evidence limits:** ✅ None

Audit passed — the diff-scoped architecture, dependency-boundary, generated-config, documentation,
and test-quality review found no ticket-scoped errors or warnings. The principle-trace helper also
reported unrelated pre-existing traces from other tickets; this task has no implementation plan or
principle trace.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude bundled CLI resources | `test:release tests/claude-plugin-release.release.test.ts` | `ticket new` and `install` pass from the checked-in payload |
| Codex bundled CLI resources | `test tests/codex-plugin-version.test.ts` | `ticket new` and `install` pass from the generated payload |
| Claude damaged-cache PreToolUse | `test tests/claude-plugin/dispatch.test.ts` | Missing and unlisted assets return structured `ask`; no unverified hook result is applied |
| Native plugin generation | Both generator `--check` commands | Claude and Codex payloads match their generators |

## Audit Detail

- Architecture: no dependency violations; generated package-data trees are excluded from import-root analysis.
- Test quality: five changed test/step files reviewed; assertions cover observable behavior, healthy and damaged paths, and clean-repository execution.
- Documentation: the native-plugin executable resource contract is recorded in `ARCHITECTURE.md`; configured README and website docs contain no contradictory impacted claim.
- Dependency drift: no manifest or lockfile changes.
