# Impl Plan: Keep cachebusted Codex plugins operational

**Status:** implemented
**Planned on:** 2026-09-09

## Approach

The riskiest assumption is that one effective version can drive the generated
skill path and the bundled runtime identity without changing default Claude or
Codex runtime bytes. The cheapest discriminating proof is a real generator
subprocess producing `0.83.1+codex.test`, followed by executing its runtime and
asserting the exact suffixed version.

Proof and build order:

1. **RED — effective-version generation contract.** Extend the Codex release
   contract test to run the real generator command into a fresh directory.
   Assert the manifest, package, every generated cache-path command, runtime, and
   emitted profile proof all report the requested base or cachebusted version.
   Scan the complete generated tree to reject a base cache path in a suffixed
   bundle or a suffix in a base bundle. In the same test, hash the Claude Code
   and Cursor artifact trees immediately before and after cachebusted generation
   and require equality while the Codex output changes. Add table-driven
   malformed/different-release rejection checks that prove the fresh output is
   absent, the checked-in `packages/cli/codex-plugin` tree is byte-identical, and
   explicit `--version` cannot target that default tree without `--output`.
   Add publisher-boundary tests in
   `packages/cli/tests/scripts/codex-plugin-generation.test.ts`: reject an
   existing/non-empty output, and inject a generation callback that writes a
   partial staging file then fails. Assert the requested output never appears
   and no adjacent temporary directory remains.
   This covers TBU1.R1, SWM1.R2, and the real generator entry point on the
   Safeword CLI surface.
2. **GREEN — coherent generator.** Add the option/version policy, complete
   manifest/hooks generation, adjacent temporary output, atomic publication,
   and optional Bun build-time version definition. Keep no-argument generation
   on the existing checked-in target and package version.
3. **RED/GREEN — installed Codex wiring.** Adapt the existing real
   `codex plugin add` release test to cover both the default base bundle and a
   generated suffixed bundle. For the suffix, execute a generated workflow
   runtime path with a base-version decoy present, record hook proof, and assert
   status does not report a version update. This covers TBU1.R2 plus both
   versions' profile-proof identity at E2E scope, mocking only the isolated
   home/filesystem boundary.
4. **Regression and design proof.** Run default `--check`, catalogue/release
   tests, Claude/Cursor parity checks, and the BDD lane. Add a named assertion in
   `packages/cli/tests/codex-plugin-version.test.ts` that validates
   `design.md`'s exact `## Upstream Codex contract` heading, task-bound
   `PLUGIN_ROOT` requirement, and non-dependency statement. Default `--check`
   explicitly proves the optional runtime define leaves the checked-in default
   Codex bytes unchanged; the existing runtime equality assertion and normal
   Claude/Cursor generation checks prove shared builder/catalogue code was not
   contaminated. The same-process before/after hashes separately catch the
   direct regression in which the cachebuster writes outside its fresh Codex
   output. This covers SWM1.R1–R3 across Claude Code, Cursor, Codex, and
   Safeword CLI.
5. **Maintainer handoff.** Extend the Codex plugin development section in
   `README.md` with the supported `--version` plus `--output` command, accepted
   same-release version rule, fresh-output requirement, and warning that a
   manifest-only rewrite creates an incoherent bundle.

Applicable skills: `safeword:testing` for all test slices and
`safeword:tdd-review` at RED/GREEN/REFACTOR boundaries. No language-specific
skill is needed beyond the repository's TypeScript conventions.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://developers.openai.com/plugins/build/plugins | 2026-09-09 | Current hosted docs | Codex plugin interface current on 2026-09-09 | Defines a plugin as one packaged unit containing manifest and resources | Keep identity and executable resources coherent inside the plugin bundle | Interface documentation does not expose a skill-shell plugin-root value; no source code reused |
| https://learn.chatgpt.com/docs/build-skills | 2026-09-09 | Current hosted docs | Codex skill interface current on 2026-09-09 | Skills may package scripts and activate from catalogue paths; updates appear after restart | Resolve packaged resources from the activating immutable bundle | Documents behavior rather than a relative shell-resource API; no source code reused |

**Decision impact:** retained: immutable versioned bundles and restart-bound
activation remain sound; changed: the cachebuster becomes a coherent bundle
generation input rather than a manifest-only rewrite.
**Decision informed:** Treat the cachebuster as the effective version of the complete Codex bundle

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Treat the cachebuster as the effective version of the complete Codex bundle | Validate one explicit version and feed it to manifest package runtime catalogue and proof | Mutable base-version symlink; cache scan/glob; manifest-only suffix | Aliases break immutable multi-version installs; scans are ambiguous; manifest-only stamping caused the defect |
| Publish custom bundles only when complete | Generate beside a fresh output and atomically rename | Reconcile an existing custom output in place; copy sequentially | In-place writes can leave a mixed bundle after validation or build failure |
| Keep the upstream improvement independent | Record task-bound PLUGIN_ROOT while shipping exact generated paths now | Wait for Codex host support; omit the proposal | Waiting leaves users broken; omitting the host seam preserves avoidable generated coupling |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | One effective-version input physically drives every generated identity, and a fresh output is published only when complete | `packages/cli/tests/codex-plugin-version.test.ts` | |
| 3. Add, never replace | Codex-only generation changes no Claude Code or Cursor catalogue | `packages/cli/tests/codex-plugin-catalogue.release.test.ts` and parity checks | |
| 5. Correct and safe; then clear; then simple | Reuse existing SemVer validation, catalogue generation, build define, and real install harness; add no dependency or runtime resolver | `packages/cli/scripts/generate-codex-plugin.ts` | |

Architecture decisions honored: registry-driven native host boundaries in
`ARCHITECTURE.md`; immutable Codex bundle activation in
`.project/tickets/4S2S8V-codex-plugin-next-task-upgrades/design.md`. No ADR is
needed because the interface is release-tooling-local and reversible.

## Known deviations

- The manifest-only cachebuster that produced the reported local installation
  belongs to Codex's external plugin-development tooling, not this repository.
  Safeword cannot wire that caller here. The new generator command is the
  supported coherent boundary that caller must adopt; release proof invokes it
  directly, and Safeword does not claim the external caller changed in this
  delivery.

## Doc impact

- `README.md`: document the maintainer-facing coherent cachebuster generator
  contract. No customer-facing CLI or workflow documentation changes.

## Assessment triggers

- Codex exposes a task-bound plugin-root value to installed skill commands.
- Codex changes cache identity or allows multiple active versions from one
  marketplace source.
- A release workflow needs to update an existing custom output rather than
  publish a fresh immutable directory.
- Default Claude and Codex runtime bundles stop being byte-identical.
