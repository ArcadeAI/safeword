# Verify: Run the same Safeword CLI from every hook on every host (8VG20K)

**Verified on:** 2026-10-13 · **Head:** `42b5c8af3`

**PR Scope:** `fix/one-cli-lookup` against `main` contains only 8VG20K work — the shared lookup module, the hooks moved onto it, the fail-closed test-plan fix in the same function, their tests, the regenerated plugin/installed copies, and the ARCHITECTURE.md decision. No unrelated changes.

## Done-when evidence

| Done when | Evidence |
| --- | --- |
| Unit tests prove each lookup's order, version pinning, and that the trusted lookup refuses project-writable paths | `tests/hooks/safeword-cli.test.ts`, 18 tests (incl. trusted environment allow-list and project-contained directory settings): trusted order and pinning, Codex cache, project-writable plugin refused, symlink canonicalized, runtime inside the project refused, project-is-home runner directory, repo source and installed package refused for trust; working-lookup order, lookalike source refused, no unpinned fallback; contract that no hook mentions `safeword@latest` or resolves the plugin path itself |
| A real GREEN-guard hook process outside a plugin verifies a receipt through pinned bunx | `tests/integration/write-time-annotation-gate.test.ts`: the real `bun x --bun safeword@9.9.9` route against a local npm registry approves the exact scenario and ledger; denies a rejecting package even with a forging project `node` shim; survives a 5.5s cold registry. A forged `bun x` cache under a project TMPDIR is denied. `tests/integration/action-hook-cli-version.test.ts` runs the real `bunx` against a local registry: a mismatched node_modules safeword loses to the pinned published version. The shim, symlink, preload, cache, and version tests each fail against the previous module |
| No hook template contains `safeword@latest` (outside auto-upgrade) or an unpinned `bunx safeword`; generated surfaces regenerated; full suite green | Contract test above; `bun packages/cli/scripts/check-generated-surfaces.ts` reports all 5 surfaces current; full suite 614 files, 10,552 passed, 14 skipped, 0 failed |

## Reviews

- Intake: independent review `6e8dbcb3` (Codex, cross-agent) approved.
- Quality review: independent passes requested changes on trust-boundary and fail-closed defects (project bunfig preload, symlinked CLI, PATH and node shims, project-as-home runner directory, download timeout, inherited preload options, project-contained temp/cache directories, installed-version mismatch); each was fixed with a test that fails against the previous code. Final full-scope review `0de89bf4` approved all 28 authored files; its predecessor's warning (learnings stamp scan skipped without a CLI) was fixed in `e33c63c4f`.
- Implement phase exit: logged skip — the full change set (81 files) exceeds the 64-file review packet; the 53 others are generated copies verified by `check-generated-surfaces`.
- Audit (diff scope): 0 errors; 1 warning (cold-download test timing margin) fixed in `dabe0e0d9`.

## Known limits

- A first `bun x` needs network or a warm cache; trust checks fail closed when it cannot run (30s download budget).
- Closeout (`templates/scripts/closeout-cleanup.ts`) keeps its own lookup with an unpinned `bunx safeword`; out of scope, flagged as a follow-up.
