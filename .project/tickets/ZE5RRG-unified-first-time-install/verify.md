# Verification: Give users one coherent Safe Word command model

## Verify Checklist

**Test Suite:** ✓ 6550/6555 tests pass (5 intentional skips)
**Gherkin:** ✅ Acceptance lane passes (1007/1010 scenarios; 3 intentional skips)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 48 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean; deliberate development-tool updates are recorded in the audit notes
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ Walked both audiences through mixed install outcomes. The non-technical summary says `Project setup: updated`, `Claude: needs attention`, and `Next: /reload-plugins` without architecture jargon. JSON gives the technical builder the selected agents, each surface state, and the exact retry `safeword install --agents=claude`. Worst step = the host-required reload/restart; new CLI selection steps vs the default flow = 0.
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded boundary proof
**Evidence limits:** ⚠️ The final independent quality reviewer returned no valid verdict. The original preferred route timed out; two user-directed runs with the budget expanded from 120 to 300 seconds instead ended early as `process_failed`, while the fallback returned `invalid_output`. The prescribed retry is exhausted. Review reliability is tracked by [GitHub issue #1922](https://github.com/ArcadeAI/safeword/issues/1922). Automated quality, audit, behavior, and refactor gates remain independently reproducible; no reviewer verdict was inferred.

Audit passed for branch-owned architecture and dependency boundaries. Dependency
Cruiser reports zero errors and one pre-existing orphan warning for
`packages/cli/src/codex-plugin/hooks.ts`, whose public entry is exercised through
generated plugin integration rather than a statically visible import. Repository-wide Knip, clone, and experimental Python checks retain known
baseline noise outside this feature; the stale branch-owned Knip exclusion and
all five new dependency-boundary violations were removed.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Safe Word CLI | Full Vitest and Cucumber lanes; exhaustive machine-contract, catalogue, compatibility, planning, status, doctor, uninstall, and documentation fixtures | Passed |
| Claude Code | Production lifecycle/profile adapter with only the `claude` subprocess boundary controlled; partial failure, activation action, status, removal, and retry scenarios | Passed; live host activation skipped because verification cannot safely reload an authenticated user task |
| OpenAI Codex | Production marketplace/profile adapter with only the `codex` subprocess and host-process observation controlled; install, activation, status, removal, and retry scenarios | Passed; live host activation skipped because verification cannot safely restart an authenticated user task |
| Cursor | Real schema projection and reconciliation against temporary filesystems containing missing, Safe Word-owned, customer, and third-party content | Passed; default install leaves Cursor byte-for-byte untouched and explicit selection reconciles owned assets |

## Quality and refactor follow-up

- Moved reusable lifecycle implementations out of command wrappers so command
  modules no longer import one another and architecture enforcement is clean.
- Centralized aggregate effect combination and lifecycle schema projection.
- Kept every legacy alias while making `install --agents=...` the canonical
  route and excluding Cursor from the default selection.
- Hardened historical closeout verification for generated bundles larger than
  Node's default synchronous-process buffer, preventing a silent working-tree
  fallback.
- Increased only the exhaustive public-command machine-contract timeout after
  it passed in isolation at 57.5 seconds against the former 60-second ceiling.

## Current-source checks

- Claude Code marketplace and plugin installation, scope, cache, and reload
  behavior were checked against current official Claude Code documentation.
- Command alias and hidden-command behavior were checked against current
  Commander documentation.
- Codex marketplace and plugin command verbs were checked against the installed
  Codex CLI help. The 0.x Codex package update was intentionally deferred as a
  separate compatibility change.
