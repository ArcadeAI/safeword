# Implementation Plan: Managed-file provenance refresh (A4HG61 / #849)

**Status:** planned

## Approach

One decision rule, evaluated per managed file during the upgrade plan (order matters):

1. configKey-suppressed → nothing (K7N2QM parity).
2. Resolved content `undefined` (generator suppressed) → nothing (DD4).
3. Manifest corrupt → global: warn once, no refresh, no recording, manifest bytes untouched (DD8). Evaluated before any per-file recording.
4. File missing → write + record (create-if-missing parity, DD5).
5. On-disk bytes == resolved output → record if entry absent or mismatched (**adoption and DD9 healing are the same rule**); no write, no report.
6. Entry exists ∧ hash(on-disk) == entry ∧ resolved differs → write + record + report in `updated` (the refresh).
7. Else (edited, or unrecorded-and-differing) → skip.

**Manifest:** `.safeword/managed-files.json`, `{ "version": 1, "files": { "<on-disk relpath>": "<sha256 hex>" } }`, sorted keys + trailing newline (merge-friendly, low churn). Committed — NOT in `SAFEWORD_TRANSIENT_PATHS` (DD3). Hashes are byte-exact over what safeword wrote; a host formatter that rewrites a managed file makes it "edited" — honest and safe.

**Plan/execute split (DD7):** decisions + `updated` reporting happen at plan time (so `safeword diff` previews refreshes); manifest writes are carried as a single `manifest-record` action executed only in executePlan (dry-run records nothing). Setup **merges** into any existing manifest (never truncates) — this is what makes setup-on-a-clone preserve provenance.

**Cleanup (DD1):** explicit rm of the manifest in reset/uninstall-full plans — `executeRmdir` is remove-if-empty, so relying on directory removal was disproven at intake.

**Comments:** schema.ts:86 + schema.ts:1095-1101 + packs/types.ts:136 rewritten to describe manifest-gated refresh.

## Build order (outside-in)

1. `utils/managed-file-manifest.ts` — read (absent | corrupt sentinel | parsed), hash, serialize; unit tests first.
2. Pure decision rule (cases 1–7) — unit tests enumerate the provenance × staleness matrix.
3. Wire into `planManagedFilesActions` (upgrade) + `manifest-record` action + executePlan recording + corrupt-manifest warning surface.
4. Setup-path recording with merge semantics.
5. Reset/uninstall-full explicit rm.
6. Comment corrections.
7. Cucumber step definitions for the 19 scenarios (parameterized steps; real CLI against temp projects), lane green.

## Proof plan

- **Unit (vitest)**: manifest util (parse/corrupt/serialize/sort), decision rule matrix (each of the 7 cases + boundaries: empty manifest, empty file, entry-for-unknown-path inert).
- **Acceptance (cucumber lane)**: the 19 scenarios in `features/managed-file-refresh.feature`, each driving the real CLI (setup/upgrade/diff/reset) in a temp project.
- **Registry neutralization (review finding)**: the diff-preview step must neutralize `fetchRegistryLatestVersion` (offline env/pinned response) — resolve the exact mechanism at that scenario's RED; never a live network call in a Deterministic scenario.

## Decisions

| Decision | Choice | Alternatives considered |
| --- | --- | --- |
| Pristine detection | Provenance manifest (record actual writes) | Static revision hashes — cannot fingerprint ctx-generated output (all motivating configs are generated); check-advisory only — fixes visibility, not propagation |
| Manifest git status | Committed | Gitignored — every fresh clone permanently pre-manifest; defeats the feature (DD3) |
| Adoption | Byte-identity to current resolved output only; same rule heals interrupted upgrades (DD9) | Trust-on-first-upgrade (record whatever exists) — would mark customer content as safeword's; unsafe |
| Corrupt manifest | Fail safe + warn, bytes untouched (DD8) | Treat as absent → re-adoption would replace recorded hashes, losing pristine-stale provenance |
| Recording placement | Execute-only, single `manifest-record` action built at plan time (DD7) | Record inside each write executor — scatters the side effect; dry-run leakage risk |
| Cleanup | Explicit rm on reset/uninstall-full (DD1) | "Structural" via dir removal — disproven: rmdir is remove-if-empty, uninstall rms declared files only |

## Arch alignment

- Extends the existing plan/execute reconcile architecture (computePlan vs executePlan); no new command, no new subsystem.
- Follows the clobber-aversion idiom family (#255 add-if-missing merges, #293 no-churn rerender): refresh only what is provably safeword's.
- Manifest is install state, not a template — deliberately NOT a schema `ownedFiles`/`managedFiles` entry; it is written/removed by dedicated actions.

## Assessment triggers

- If manifest merge conflicts show up in real repos despite sorted-key serialization → revisit format (per-line entries vs JSON).
- If hosts' formatters routinely rewrite managed configs post-setup (mass "edited" states) → consider hashing normalized content; needs evidence first.
- If a future schema rename moves a managed path → old entry inert, new path unrecorded until next write; if that bites, add rename mapping then.
