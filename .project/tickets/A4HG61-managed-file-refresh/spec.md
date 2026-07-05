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

#### managed-file-refresh.TB1.AC1 — an unedited managed file is refreshed to current output when safeword ships a change

#### managed-file-refresh.TB1.AC2 — refreshes are visible in upgrade output, so nothing changes silently

#### managed-file-refresh.TB1.AC3 — an unchanged managed file is not rewritten (no churn on no-op upgrades)

### managed-file-refresh.TB2 — customized configs survive upgrade untouched

**Persona:** Technical Builder (TB)

> When I've edited a managed config to my house style, I want upgrade to leave that file exactly as I left it, so upgrading safeword never clobbers my customization.

#### managed-file-refresh.TB2.AC1 — a managed file whose on-disk content differs from what safeword last wrote is never rewritten

#### managed-file-refresh.TB2.AC2 — pristine/edited status is re-evaluated every upgrade — editing after an earlier refresh protects the file on the next one

#### managed-file-refresh.TB2.AC3 — uninstall/reset leaves no manifest state behind

### managed-file-refresh.SM1 — a shipped template fix reaches the installed base

**Persona:** Safeword Maintainer (SM)

> When I ship a fix to a managed template or generator, I want existing installs to pick it up on their next upgrade when the file is unedited, so the installed base doesn't silently fork across revisions.

#### managed-file-refresh.SM1.AC1 — ctx-generated configs (generator output), not just static templates, are provenance-tracked and refreshable

#### managed-file-refresh.SM1.AC2 — installs predating the manifest adopt safely: a file byte-identical to current resolved output gains provenance; a differing file is left alone and stays unmanaged (never guessed pristine)

#### managed-file-refresh.SM1.AC3 — schema documentation states the actual behavior (comments at schema.ts:86/1095, packs/types.ts:136 corrected)

## Rave Moment

skip: table-stakes — the win is an upgrade that quietly does the right thing; the observable moment is the absence of a bad one (no clobber, no fork). Nothing here beats an expectation in a peer-retellable way.

## Open Questions

(none — resolved during intake: manifest location `.safeword/` so reset/uninstall cleanup is structural; adoption rule is byte-match-only; pre-manifest stale installs are explicitly unhealable, deferred to the #849 thread as a possible advisory follow-up)
