# Verification: Ship Safeword as a native Claude Code plugin

## Verify Checklist

**Test Suite:** ✓ 6249/6254 tests pass (5 intentional skips)
**Gherkin:** ✅ Acceptance lane passes (823/826 scenarios; 3 intentional skips)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 43 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked Technical Builder through install → `/reload-plugins` → first namespaced workflow → status; worst step = manually entering `/reload-plugins`; new steps vs before = 1 explicit per-user install, replacing repository framework churn.
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ✅ None

Audit passed with one non-blocking dependency-cruiser warning: the generated
`prompt-timestamp.ts` runtime is loaded through `event-groups.json`, so static
orphan analysis cannot see its manifest reference. Inventory and dispatcher
tests cover that path.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude Code | Claude Code 2.1.170 headless plugin load plus authenticated same-task install, `/reload-plugins`, next-prompt proof, and `/safeword:explain` invocation | Passed; native workflows and all configured hook groups ran without restarting the task |
| Safeword CLI | Full Vitest and Cucumber lanes; plugin generation/release contract; lifecycle, cleanup, recovery, cache-integrity, and parity tests | Passed |

## Evidence

- `bun run --cwd packages/cli test` — 415 files passed; 6,249 tests passed; 5 skipped.
- `bun run test:bdd` — 823 scenarios passed; 3 skipped; 29,492 steps passed; 4 skipped.
- `bun run --cwd packages/cli typecheck` and root `bunx tsc --noEmit` — passed.
- `bun run lint:eslint` and formatting — passed with no remaining changes.
- `bun run --cwd packages/website build` — 9 documentation pages built.
- `bun audit` — no vulnerabilities.
- `bun run --cwd packages/cli generate:claude-plugin` followed by `check:claude-plugin` — generated bundle is aligned at `0.71.0`.
- `bun scripts/parity-check.ts --mode=all` — 233 pairs and 8 contracts are in sync.
- GitHub changed-file retrieval proof — the paginated PR-files endpoint returned the complete pre-fix 317-file PR; the final local diff contains 322 files, which CI will compare with the updated PR's authoritative `changed_files` count.
- Interactive Claude proof — the same task loaded the plugin with `/reload-plugins`, the next prompt wrote identity-bound execution proof, and `/safeword:explain` ran immediately afterward.

## Release boundary

No version bump, tag, publish, official-marketplace install, or release was
performed. Tagged-artifact cache smoke remains a separate release-run concern;
the implementation and automated cache-integrity contract are complete.
