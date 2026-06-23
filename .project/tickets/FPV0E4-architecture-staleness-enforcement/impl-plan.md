# Impl Plan: Architecture doc staleness enforcement (Slice 2)

**Status:** planned

## Approach

One shared seam, two thin surfaces over it. Extract a pure **planner** from
Slice-1's `selfHeal` — `planSelfHeal(cwd): SelfHealAction` — that runs
`decideAction` against the live fingerprint and existing doc but **writes
nothing**. `selfHeal` keeps its existing write path (reusing the planner so the
two never diverge). Both enforcement surfaces consult the planner.

Build order (each task builds on the previous green):

1. **Config reader `architectureDocEnforcement`** — `isArchitectureDocEnforcementEnabled(cwd): boolean`, default-on (key absent _or_ `true` ⇒ enabled; only literal `false` opts out). _Unit_ (`configured-paths`-adjacent). Foundation for both surfaces. Proves TB3 default-on/opt-out semantics in isolation.
2. **Planner `planSelfHeal(cwd)`** — pure dry-run returning the action; `selfHeal` refactored to call it. _Unit_ (`architecture-document.test.ts`). Foundation for `--check` and the hook.
3. **`safeword architecture --check`** — `architecture(cwd, { check })`: when `check`, consult enforcement config (off ⇒ exit 0), else `planSelfHeal` and exit non-zero iff action ∈ `{created, healed, regenerated}`; print a one-line actionable message. _Integration_ (spawn the CLI in a temp project). Covers TB2.AC1, TB2.AC2, TB2.AC1-config-absent, TB3.AC2.
4. **Commit-time stage** — `stageArchitectureIfStale(cwd): { action, staged }` lib: enforcement off ⇒ no-op; else run `selfHeal` (writes) and `git add` the doc iff the action mutated it; never throws into the commit. A thin PreToolUse hook `pre-tool-architecture-stage.ts` reads stdin JSON, matches `git commit` (reuse `GIT_COMMIT_COMMAND` shape from `pre-tool-quality.ts`), and calls the lib; always exits 0 (allow). _Unit_ on the lib (temp git repo), _integration_ on the hook (crafted stdin + temp git repo). Covers TB1.AC1/AC2/AC3, TB3.AC1.
5. **Wire-up + dogfood** — register the hook in `schema.ts` (PreToolUse, `Bash` matcher) and the install file map; ship template + byte-identical `.safeword/` copy (parity); add a `safeword architecture --check` step to the `ci.yml` `lint` job; black-box BDD steps in `steps/architecture-staleness-enforcement.steps.ts` (spawn the CLI / hook, no cross-package src imports — the Slice-1 lesson). Closes the `done_when` dogfood criterion.

Test-layer rationale: structure-derivation logic is unit (fast, deterministic);
both enforcement surfaces are integration because their contract _is_ a process
boundary (exit code / git index side effect) that a unit test can't observe
honestly. The `.feature` lane is the end-to-end acceptance proof.

## Decisions

| Decision              | Choice                                                              | Alternatives considered                            | Rejected because                                                                  |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Dry-run seam          | Pure `planSelfHeal(cwd)` returning the action; `selfHeal` reuses it | `{ write: false }` param on `selfHeal`             | A pure planner keeps the write path unbranched and is trivially unit-testable     |
| `--check` failure set | Exit non-zero iff action ∈ `{created, healed, regenerated}`         | Also fail on stale/placeholder prose markers       | Prose is out-of-scope and advisory; only machine-derived structure is enforceable |
| Commit surface        | New dedicated PreToolUse hook `pre-tool-architecture-stage.ts`      | Fold into `pre-tool-quality.ts`                    | That hook gates REFACTOR test-files only — different concern and lifecycle        |
| Hook never blocks     | Always exit 0; the only effect is `git add` of a regenerated doc    | Hard-block a stale commit                          | Auto-fix-and-stage is the resolved decision; the hard block lives in CI only      |
| Config default        | `architectureDocEnforcement` absent/`true` ⇒ on                     | Opt-in default-off (like `architectureReviewGate`) | Freshness is the whole feature; default-on with opt-out                           |
| Config shape          | Flat top-level boolean                                              | Nest under `architecture: {}`                      | Visually collides with `paths.architecture` (the unrelated ADR pointer)           |

## Arch alignment

Honors these decisions recorded in `ARCHITECTURE.md` (the `paths.architecture`
record):

- **CLI owns the logic; hooks shell to it** (`CLI Structure`, and the Slice-1
  `session-architecture-heal` precedent) — the `--check` contract and the
  planner live in the CLI; the new PreToolUse hook is a thin stdin wrapper, so
  the enforcement logic is unit-testable in one place, not duplicated into a hook.
- **Exit-code gating** (`Hard Block for Done Phase (Exit Code 2)`) — enforcement
  is expressed as process exit semantics: CI `--check` exits non-zero to block a
  merge; the commit hook exits 0 (allow) and acts only via a side effect, matching
  the established "hooks gate via exit codes" pattern.
- **Deterministic, LLM-free engine** (Slice 1, `Reconciliation Engine` spirit) —
  the planner reuses the existing shape-fingerprint/`decideAction`, adding no new
  source of truth.

## Arch record note

`paths.architecture` → `ARCHITECTURE.md` exists and is the record; this slice
introduces no new cross-cutting architectural pattern (it extends the Slice-1
engine and the existing hook/CLI split), so no new ADR is warranted. If Slice 3
(monorepo) changes the `noop`/ownership model, that _would_ merit a recorded
decision.

## Known deviations

- A PreToolUse hook that performs a **side effect** (`git add`) rather than only
  allow/deny is mildly unusual for safeword's gate hooks (which typically just
  permit or block). Deliberate: the resolved design is auto-fix-_and-stage_, so
  the side effect is the feature. Bounded — the only file ever staged is the
  `.generated.` doc the hook just regenerated from live structure, and the
  ownership-marker guard makes `selfHeal` skip foreign content, so no user work
  can be clobbered.

## Assessment triggers

- **Monorepo (Slice 3)** lands — `noop` and ownership semantics change; the
  would-change set and the `--check` exit mapping must be revisited.
- **LLM prose generation** lands — the enforcement threshold may extend from
  structure-only to prose completeness (placeholder/stale markers becoming gates).
- **Regeneration cost** grows non-trivial — commit-time `selfHeal` on every agent
  commit may need a fast-path/caching guard to stay imperceptible.
