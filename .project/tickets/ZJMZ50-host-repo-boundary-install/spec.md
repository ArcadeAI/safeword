# Spec: Install the boundary gate into host repos via setup/upgrade (#810 child 2)

Issue #810 · epic #808. Child 2 of 3: `safeword setup`/upgrade wires the
slice-1 boundary gate (`safeword boundary --at commit|push`, CDRJTW) into HOST
repos' git hooks. Child 3 (server-side required check) follows.

## Intent

A Technical Builder's repo should get the same commit/push evidence
reconciliation safeword's own repo dogfoods — installed by setup, healed by
upgrade, removed by reset — without safeword ever clobbering the host's
existing hooks or blocking a single commit. Until this ships, the boundary
gate protects exactly one repo in the world: ours.

## Intake Brief

- **Requested by:** alex (TheMostlyGreat) — #810's stated deliverable ("setup/upgrade emission" named as child 2 in the CDRJTW spec's slicing).
- **Cost of inaction:** the engine exists but reaches no customer repo — #644-style silent divergence remains unobserved everywhere safeword is actually used, and child 3's server tier has no local warn-tier to graduate from.
- **Reversibility:** two-way door mechanically (textPatch blocks revert on reset; schema entries removable) — but the shim line's *shape* ships into customer hook files, where a broken shim is a support incident, not a patch. Treat the shim line itself as the one-way-adjacent surface: minimal, guarded, `|| true`.

## References

- CDRJTW (slice 1): engine + `safeword boundary` command; dogfood shims in `.husky/pre-commit`/`pre-push` are the live prototypes of what this emits.
- Design research (this session, /figure-it-out): husky v9 runs hooks with `sh -e` and a *relative* `node_modules/.bin` PATH prepend (worktree-unsafe — learning 9P3VVH: call the binary by explicit path); ecosystem convention for coexistence is appending lines to the user's hook file (commitlint/lint-staged pattern), and overwriting hook files is husky's top complaint class (typicode/husky#558, #171); lefthook installs into `.git/hooks` and merges `lefthook.yml`/`lefthook-local.yml`/`remotes` natively; pre-commit framework integrates via `repo: local` in `.pre-commit-config.yaml`; in linked worktrees `.git` is a file, so static `.git/hooks/*` paths are wrong.
- Machinery (explorer map): `TextPatchDefinition` (schema.ts:51) — marker idempotency, create-if-absent, `rerender`, reverse unpatch on reset; `shouldSkipForNonGit` skips `.husky/*` outside git repos (reconcile.ts:99); install chmods `.husky` (reconcile.ts:511) — plumbing built ahead, unused until now; no hook-manager detection exists anywhere; every host gets `safeword` as a devDependency (packs/typescript/files.ts:520, installed unconditionally — "every project is a JS project now").
- V4MATC (merged mid-flight): `removeIfUnmodified` conditional managed-file removal — precedent for cleanup semantics, not needed if shims are textPatches.

## Personas

- Technical Builder (TB) — their repo receives the shims; standing promise: guardrails fire during agent sessions and **never block their own hand-written commits**, and setup never breaks what already works.
- Safeword Maintainer (SM) — needs emission to be schema-driven (reconcile owns install/upgrade/reset symmetry) so host installs heal and revert like every other managed surface.

## Surfaces

Affected:

- skip: none tagged — emission is harness-independent (git-native), identical across agent runtimes; variation is by *hook-manager world* (husky / lefthook / pre-commit / bare), covered as scenario Rules below.

Unaffected:

- Claude Code / Cursor / Codex per-harness hooks — the gate stays git-native per the epic's mechanism constraint.
- safeword's own repo — dogfood shims call the repo source (`bun packages/cli/src/cli.ts`), not the emitted form; parity is conceptual, not byte-level.

## Vocabulary

- **Shim** — the one-line, marker-guarded hook addition that calls the versioned CLI: existence-guarded, explicit-path, whole-line `|| true`. All logic lives in the CLI; the shim never grows.
- **Hook-manager world** — which of husky / lefthook / pre-commit (framework) / bare `.git/hooks` manages the host's hooks. Detected once at plan time.
- **Nudge** — a printed, copy-paste-exact integration snippet for worlds safeword won't auto-edit (user-owned YAML), following the vendored-ignores-nudge self-quiescing pattern.

## Jobs To Be Done

### host-repo-boundary-install.TB1 — Get the boundary gate without surrendering my hooks

**Persona:** Technical Builder (TB)

> When I run `safeword setup` or upgrade in a repo that already has git hooks,
> I want the boundary gate added alongside what I have — not instead of it —
> so agent sessions leave evidence at commit and push while my own hooks,
> hand-written commits, and hook-manager choice stay exactly as they were.

#### host-repo-boundary-install.TB1.R1 — A husky host gains the commit and push shims without losing a byte of its own hook content

#### host-repo-boundary-install.TB1.R2 — Re-running setup or upgrade never duplicates a shim

#### host-repo-boundary-install.TB1.R3 — A host using lefthook or the pre-commit framework gets an exact integration snippet, never an edited config file

#### host-repo-boundary-install.TB1.R4 — The installed shim can never block a commit or push — including when safeword's binary is missing or broken

#### host-repo-boundary-install.TB1.R5 — `safeword reset` removes the shims and leaves the host's own hook content intact

### host-repo-boundary-install.SM1 — Emission is reconcile-owned, not bespoke

**Persona:** Safeword Maintainer (SM)

> When the shim line needs to change in a future version, I want host installs
> to heal on upgrade through the same schema machinery as every other managed
> file, so there is no hand-rolled install/uninstall code path to drift.

#### host-repo-boundary-install.SM1.R1 — Shims install, heal, and revert through the same managed-surface machinery as every other safeword file, gated on the detected hook-manager world — no bespoke install/uninstall path

#### host-repo-boundary-install.SM1.R2 — A non-git host directory gets no hook writes and no nudge noise

## Rave Moment

skip: inherited — epic #808 carries the enforcement-arc moment; this child is plumbing that extends it to customer repos.

## Outcomes

- A TB running `safeword setup` in a husky repo commits five minutes later and sees boundary warnings (or silence) — with their pre-existing lint-staged line still running first.
- `safeword reset` on that repo leaves `.husky/pre-commit` byte-identical to its pre-setup content.
- A lefthook host's setup output contains a `lefthook.yml` jobs snippet that works when pasted verbatim.
- No GitHub issue is ever filed titled "safeword broke my commits."

## Open Questions

- Bare-world hosts (git repo, no hook manager at all): this slice nudges (recommend husky, print the init steps) rather than writing `.git/hooks` (worktree `.git`-file hazard, invisible-to-team) or bootstrapping husky uninvited (new dep + `prepare` script into a repo that chose none). Is nudge-only acceptable coverage for the slice, or should setup offer `--with-husky` bootstrap? defer: gate decision — proceeding nudge-only unless overruled.
- Shim invocation cost at commit: `node_modules/.bin/safeword boundary` cold-starts node per commit (~100-300ms). Accepted for the slice (commit tier is content-only and the budget was set in CDRJTW); revisit only if TB feedback says otherwise. defer: measured acceptance, revisit on feedback.
