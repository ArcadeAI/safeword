# Feature Spec: Managed-file provenance refresh (Issue #849)

**Feature**: Record what safeword actually writes for each managed file (a provenance manifest), so `safeword upgrade` can refresh files the customer never edited — including ctx-generated toolchain configs — while never touching customized ones.

**Related Issue**: [#849](https://github.com/ArcadeAI/safeword/issues/849)
**Status**: 🚧 In Progress

---

## Intake Brief

- **Requested by:** alex@arcade.dev, from the ArcadeAI/monorepo adoption audit (session of 2026-07-05); upstream issue #849 filed the defect.
- **Cost of inaction:** every shipped fix to a managed config (eslint/tsconfig/ruff/mypy/golangci/clippy/rustfmt/sqlfluff, lane starters) reaches only fresh installs — the installed base silently forks and stays on whatever revision it first scaffolded, while schema comments claim otherwise (schema.ts:86/1095, packs/types.ts:136).
- **Reversibility:** cross-cutting — touches setup, upgrade, and uninstall/reset, and introduces persistent per-install state (the manifest). Treat as one-way for planning purposes: once installs carry a manifest, removing the mechanism needs a deprecation path. The refresh write itself is guarded (only files byte-identical to what safeword last wrote), so the data-loss risk is bounded by design.

---

## Surfaces

Affected:

- `Claude Code` — skip: mechanism is CLI-internal (`safeword upgrade`), not agent-runtime-specific; covered by CLI-level scenarios
- `OpenAI Codex` — skip: same CLI-internal mechanism
- `Cursor` — skip: same CLI-internal mechanism

Unaffected:

- `Claude Code on the Web` / `OpenAI Codex Cloud` — fresh clones run setup, not upgrade-with-history; no distinct behavior

---

## Jobs To Be Done

### managed-file-refresh.TB1 — shipped config fixes arrive on upgrade

**Persona:** Technical Builder (TB)

> When I run `safeword upgrade` on a project whose managed configs I haven't touched, I want safeword's shipped fixes to those configs to land automatically, so I get the improvements without hand-diffing tool configs against a changelog.

#### managed-file-refresh.TB1.R1 — an upgrade brings every pristine managed file to current resolved output

#### managed-file-refresh.TB1.R2 — every refresh is reported in upgrade output; no managed file changes silently

#### managed-file-refresh.TB1.R3 — a managed file already at current output is never rewritten (no churn)

### managed-file-refresh.TB2 — customized configs survive upgrade untouched

**Persona:** Technical Builder (TB)

> When I've edited a managed config to my house style, I want upgrade to leave that file exactly as I left it, so upgrading safeword never clobbers my customization.

#### managed-file-refresh.TB2.R1 — upgrade never rewrites a managed file whose on-disk bytes differ from safeword's recorded write

#### managed-file-refresh.TB2.R2 — pristine status is re-derived from on-disk bytes at every upgrade, never cached — an edit after an earlier refresh protects the file on the next one

#### managed-file-refresh.TB2.R3 — no manifest state survives uninstall/reset

### managed-file-refresh.SM1 — a shipped template fix reaches the installed base

**Persona:** Safeword Maintainer (SM)

> When I ship a fix to a managed template or generator, I want existing installs to pick it up on their next upgrade when the file is unedited, so the installed base doesn't silently fork across revisions.

#### managed-file-refresh.SM1.R1 — provenance covers generator output as well as static templates; no managed-file kind is exempt

#### managed-file-refresh.SM1.R2 — a file that cannot be proven pristine is never refreshed; byte-identity to current resolved output is the only adoption path into provenance

#### managed-file-refresh.SM1.R3 — schema documentation states the actual behavior (comments at schema.ts:86/1095, packs/types.ts:136 corrected)

## Rave Moment

skip: table-stakes — the win is an upgrade that quietly does the right thing; the observable moment is the absence of a bad one (no clobber, no fork). Nothing here beats an expectation in a peer-retellable way.

## Design Decisions (cold-start check resolutions)

The intake-exit cold-start review surfaced 8 plannability gaps; resolutions:

1. **Manifest removal is explicit, not structural.** `executeRmdir` is remove-if-empty and uninstall removes only declared files (reconcile.ts:806-808) — an undeclared manifest would survive and violate TB2.R3. The manifest is declared for removal on reset and uninstall-full (explicit rm, alongside the ownedFiles pass).
2. **Manifest lives at `.safeword/managed-files.json`**; keys are the on-disk relative paths as written (post-namespace-translation). After a `paths.projectRoot` migration, moved files' old keys no longer match → the file is simply unrecorded and the byte-identity adoption rule applies. Safe by construction; no migration logic.
3. **The manifest is committed, not gitignored** (not in `SAFEWORD_TRANSIENT_PATHS`). Provenance must travel with the repo — installs are repos, not machines; a gitignored manifest would make every fresh clone permanently pre-manifest and defeat the feature. Churn is bounded: the manifest changes only in commits that also change the managed files themselves.
4. **Generator returns undefined → skip.** SM1.R1's "no kind is exempt" means generated content is *trackable*, not that suppression forces action: a recorded file whose generator now resolves nothing is left untouched (no delete, no refresh), its entry inert. Scenario'd.
5. **Recorded-but-missing file → today's create-if-missing parity**: recreated, reported as created, hash re-recorded. User deletion is not treated as a customization (matches current behavior). Scenario'd.
6. **Entries are never pruned by edits.** An edited file's entry stays — so edit-then-revert restores pristine status (TB2.R2's re-derivation). configKey-suppressed and schema-removed paths simply have inert entries; pruning is out of scope.
7. **Recording/adoption is execute-only; reporting is plan-time.** Refresh candidates appear in the plan's `updated` output (so `safeword diff` previews them, scenario'd); manifest writes happen only in executePlan.
8. **Corrupt manifest → fail safe, loudly**: treated as unable-to-prove-pristine (refresh nothing), upgrade succeeds, the manifest file is left byte-for-byte alone (never re-adopted in the same run), and the upgrade output warns that the manifest is unreadable — TB1.R2's spirit applied to refusals: nothing degrades silently. Scenario'd.
9. **Interrupted-upgrade healing (scenario-gate addition)**: a file whose on-disk bytes equal the currently resolved output but whose record differs has its record healed (re-recorded, no write). Byte-identity to current output proves the content is safeword's — the same principle that justifies adoption — and it makes the mechanism self-healing after a crash between file write and manifest write (DD7's execute-only recording makes that window real). Scenario'd.
10. **configKey suppression pins the reachable flow (implement-phase correction)**: setup refuses to run when `.safeword/` exists, so override-before-setup is unreachable by construction — the real flow is override-after-install. The scenario pins that: with the override set and the default-location file moved away, upgrade neither recreates the file nor touches its (inert) manifest entry — the reviewer's sanctioned alternative form of MF1.

## Open Questions

(none — all cold-start gaps resolved above; pre-manifest unedited-but-stale installs remain explicitly unhealable, deferred to the #849 thread as a possible advisory follow-up)
