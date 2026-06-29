# Verify: present-but-unparseable workspace coverage (UWP4XK)

## Verify checklist

**Test Suite:** ✅ Full CLI unit suite green — 277 files, 4029 passed, 5 skipped. The
UWP4XK additions: 11 new monorepo unit tests (U1–U9 + model + no-churn) in
`tests/utils/architecture-monorepo.test.ts` (49 in that file total).
**Gherkin:** ✅ 5 new `@architecture-unreadable-workspace` scenarios pass; 52
architecture scenarios green together (monorepo-coverage-honesty incl. the preserved
flow-style "degrades gracefully" path, polyglot, hierarchy, state-docs).
**Build:** ✅ CLI runs (`bun packages/cli/src/cli.ts architecture --check` exits 0).
**Lint:** ✅ eslint clean on all changed files (fixed a nested-ternary → `workspaceList`
helper and a conditional spread → logical spread).
**Typecheck:** ✅ No new errors in the changed files (pre-existing TS6059 rootDir notes
for `.safeword/hooks/**` unchanged, as on main).
**Scenarios:** All 5 acceptance scenarios + U-series RED-for-the-right-reason confirmed:
pre-fix a present-but-unparseable manager returned `undefined`, contributed no packages,
and rendered no `## Coverage gaps` advisory and no warning; GREEN after the discriminated
detector return surfaces it.
**Dep Drift:** ✅ Zero new dependencies (pure logic + render + one toml helper).
**PR Scope:** ✅ Diff matches ticket scope — `architecture-monorepo.ts` (detectors +
discovery), `architecture-document.ts` (root-index advisory + target routing),
`commands/architecture.ts` (non-blocking warning), `toml.ts` (`hasTomlTable`), the
acceptance feature/steps, and the ticket artifacts. No piggybacked changes.
**Dogfood no-churn:** ✅ This repo has no unreadable workspace config, so the unreadable
key never enters the fingerprint — `.project/architecture.generated.md` and the two leaf
docs are byte-unchanged; `architecture --check` exits 0.

## Evidence

- **Independent scenario-gate review** (fresh-context general-purpose agent, `/review-spec`
  checks): **PASS-WITH-NITS**, no load-bearing findings. Confirmed: load-bearing assertions
  genuinely RED-before-fix (the `## Coverage gaps` / `unreadable` warning did not exist),
  AODI-clean (observes only the rendered doc + captured stdout/stderr), deterministic
  (isolated `mkdtemp` dirs), and the absent-vs-unparseable false-alarm boundary explicitly
  pinned (AC5 single-crate Cargo + U7/U8). Two nits: stale `SC#` labels in dimensions.md /
  test-definitions.md (fixed → `AC1–AC5`), and uv-unreadable being unit-only (U3) with no
  black-box scenario (accepted per the test pyramid — the discovery→render→surface pipeline
  is already proven end-to-end by three sibling managers).
- **Behavior change, intentional & documented:** the existing flow-style pnpm
  "degrades gracefully" scenario still passes — it asserts only command-success + no leaf
  docs, both still true; the repo now additionally renders a root index carrying the
  advisory (the honest surface), which that scenario does not contradict.

## Quality review (post-merge-prep, /quality-review)

Fresh-context independent review returned **REQUEST CHANGES** on one real
false-alarm: the detector classified a *valid* workspace as "unreadable" whenever
the manager's table/file was present with no parseable globs — but a missing
member-list declaration is valid for several managers. Verified against primary
sources and fixed: a workspace is now `unreadable` only when the **member-list
declaration is present but unparseable**, never when it is simply absent:

- **Cargo** `[workspace]` with no `members` key → `absent` (valid root-package
  auto-discovery / `default-members`; [Cargo reference](https://doc.rust-lang.org/cargo/reference/workspaces.html)). New `hasTomlTableKey` guard.
- **pnpm** with no `packages:` key → `absent` (catalog/settings-only is valid;
  [pnpm reference](https://pnpm.io/pnpm-workspace_yaml)).
- **go.work** with no `use` directive → `absent` (a fresh `go work init` file).
- **uv** unchanged — `members` is *required* in `[tool.uv.workspace]`, so a table
  with no usable members is genuinely malformed → correctly `unreadable`.

Added U9 (Cargo auto-discovery), U10 (pnpm catalog-only), U11 (go.work no-use) —
each asserts `absent`, not a false alarm. `node:fs` `globSync` confirmed stable
since Node 22 ([release notes](https://nodejs.org/en/blog/release/v22.0.0)). No new dependencies. Lint + tests green
after the fix (52 monorepo unit tests, 14 architecture scenarios). The `--check`/
`--stage` warning is the same `warnUnreadableWorkspaces` call proven end-to-end by
AC4 on the default command — identical delegation, not separately re-tested.

## Reconcile

Implementation matches the spec design: each detector returns `absent | parsed |
unreadable`; `discoverWorkspaces` unions the readable patterns and collects the unreadable
set; `discoverLeafDirectories` is a thin wrapper (unchanged signature/behavior). The
ZRW21K "never false-complete" property is preserved and extended one layer up — a manager
that discovers nothing now leaves a discovery-layer marker instead of vanishing. No new
detector module; reuses the existing glob-expand + `hasRecognizedManifest` + `Set`
pipeline and the `toml.ts` table readers.
