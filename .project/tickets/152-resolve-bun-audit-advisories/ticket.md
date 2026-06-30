---
id: 152
type: task
phase: done
status: done
created: 2026-05-18T04:58:00Z
last_modified: 2026-06-30T17:21:00Z
---

# Resolve `bun audit` advisories surfaced 2026-05-18

**Goal:** Clear the 4 advisories that `bun audit` flags in safeword's tree (1 high, 3 moderate) by bumping the deps that pull in vulnerable transitives. None of these are caused by safeword's own direct deps — they're all transitives — but they show up in `bun audit` output, which customers run too.

**Why this is a ticket, not "just run `bun update`":** Two of the three advisories require upstream-major bumps to resolve (astro 5→6, possibly shellcheck), which means real regression risk — not a thoughtless ride-along on dependabot. They should be bumped in a focused PR with verification.

## Surfaced this session (during `/quality-review` of branch `wizardly-joliot-76687b`)

Verified via `bun audit` on 2026-05-18:

1. **`file-type@<21.3.1`** — moderate × 2. Chain: `safeword (devDep) → shellcheck → @xhmikosr/decompress-unzip → file-type`.
   - [GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473): infinite loop in ASF parser on malformed input.
   - [GHSA-j47w-4g3g-c36v](https://github.com/advisories/GHSA-j47w-4g3g-c36v): ZIP decompression-bomb DoS via `[Content_Types].xml`.
   - Dev-only — `shellcheck@4.1.0` is in safeword's root `devDependencies`. Likely fixable by bumping `shellcheck` to whatever version pulls a `file-type@>=21.3.1` transitive, or replacing `shellcheck` (the npm wrapper) with the system binary.

2. **`yaml@<2.8.3`** — moderate. Chain: many. Direct entries:
   - `workspace:safeword → yaml`
   - `workspace:safeword → knip`
   - `lint-staged → yaml`
   - `workspace:safeword → tsup`
   - `workspace:@safeword/website → astro`
   - `workspace:safeword → vitest`
   - `workspace:@safeword/website → @astrojs/check`
   - [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp): stack-overflow via deeply nested YAML collections.
   - Safeword's _direct_ dep is `yaml@2.8.4` (clean), but the named-dep entry in `bun audit` suggests an older version is still being resolved somewhere in the tree — likely a `bun.lock` consolidation issue rather than a real version pin. Investigate whether `bun update yaml` collapses the duplicate, or whether one of the listed packages pins yaml itself transitively.

3. **`devalue@>=5.6.3 <=5.8.0`** — **HIGH**. Chain: `workspace:@safeword/website → astro → devalue`.
   - [GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p): Svelte devalue DoS via sparse-array deserialization.
   - Website workspace is on `astro@5.16.3`; latest Astro is in the 6.x line (per cross-session note from babelbot work on 2026-05-17). Likely fixed by an astro major bump, which is its own scoped piece of work.

## Scope (proposed — open for converge)

**In:**

- Investigate the actual fix for each advisory (transitive bump vs. direct dep bump vs. dedupe).
- Land the bumps in _one_ PR per workspace if the workspaces don't share the offending transitive (`astro` is website-only; `shellcheck` is root-only; `yaml` likely both).
- Verify lint + typecheck + full test suite green after each bump.
- Verify `bun audit` is clean (or, if not zeroable, the residue is documented and accepted).

**Out of Scope:**

- General dependency-bump hygiene beyond these three advisories.
- Migrating away from `shellcheck` (the npm wrapper) to the system binary — that's a separate UX decision, raise as a new ticket if it surfaces during investigation.
- Promoting `bun audit` to a CI-blocking gate — covered (or not) in `092` and friends.

**Done When:**

- `bun audit` reports zero advisories, OR
- Any remaining advisory has an explicit "accepted, here's why" entry in this ticket.
- Tests pass on both workspaces post-bump.
- Build artifacts (CLI dist, website build) succeed.

## Open Questions

- `shellcheck@4.1.0` — is there a newer version with a `decompress-unzip` bump? If not, is the system-binary swap worth it for a dev-only DoS in a tarball parser nobody feeds untrusted ZIPs to?
- `yaml` — does the duplicate resolve on `bun update`, or is one of the listed deps actually pinning `yaml@^2.0.0` and forcing the old line? `bun pm ls yaml` should answer.
- `astro@5 → 6` — semver-major upgrade for the website workspace. Likely a real migration story, not a one-liner. Should this stay one ticket or split out to its own?

## Provenance

Surfaced during `/quality-review` on branch `wizardly-joliot-76687b` after the [vitest-plugin migration + installer peer-dep guard work](https://github.com/) (commits `b93b696`, `fb280b4`, `553c364`). The quality-review verified those three commits introduced **zero new advisories**; everything in `bun audit` was pre-existing. This ticket exists so the pre-existing surface gets addressed rather than continuing to be tolerated.

## Closeout

- 2026-06-30: PR [#557](https://github.com/ArcadeAI/safeword/pull/557) is merged into `main`.
- Current `main` resolves the Astro website dependency chain through Astro 7 and keeps the root audit overrides narrowed to the markdown tooling pins still required by `markdownlint-cli2`.
- `bun audit --json` reports zero advisories on current `main`.
