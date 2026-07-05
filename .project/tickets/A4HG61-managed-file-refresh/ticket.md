---
id: A4HG61
slug: managed-file-refresh
type: feature
phase: scenario-gate
external_issue: https://github.com/ArcadeAI/safeword/issues/849
status: in_progress
scope:
  - provenance manifest under `.safeword/` recording sha256 of every managed file safeword writes (setup and upgrade)
  - upgrade refreshes a managed file iff on-disk hash == recorded hash AND current resolved output differs (pristine + stale)
  - adoption rule for pre-manifest installs — record provenance only when on-disk bytes == current resolved output; otherwise leave file alone and unrecorded
  - refresh visibility in upgrade output (reported like owned-file updates)
  - manifest at `.safeword/managed-files.json`, committed (not transient); explicitly removed on reset/uninstall-full
  - correct the managed-file comments (schema.ts:86/1095, packs/types.ts:136)
out_of_scope:
  - ownedFiles behavior (already correct — content-compare overwrite)
  - healing pre-manifest installs whose files are unedited-but-stale (provenance unprovable; possible advisory follow-up in #849 thread)
  - jsonMerges / textPatches (own add-if-missing / marker mechanisms)
  - configKey-overridden entries (stay suppressed, unchanged)
done_when:
  - upgrade rewrites a pristine managed file when its resolved output changed, and reports it
  - upgrade never rewrites a managed file whose on-disk content differs from its recorded provenance
  - setup and upgrade record provenance for every managed file written; reset/uninstall leave no manifest behind
  - pre-manifest install adopts byte-identical files into provenance and permanently skips differing ones
  - misleading comments corrected; full suite green
created: 2026-07-05T19:28:43.052Z
last_modified: 2026-07-05T19:28:43.052Z
---

# Managed-file provenance refresh on upgrade

**Goal:** Record what safeword actually writes for each managed file (provenance manifest); on upgrade, refresh a file only when its on-disk content is byte-identical to that record (pristine) and the resolved output changed — so shipped fixes to managed configs, including ctx-generated ones, reach existing installs without ever clobbering a customer edit.

**Why:** managedFiles are documented as 'update if safeword content' (schema.ts:86,1095) but planManagedFilesActions skips all existing files with no content check (reconcile.ts:618), so shipped fixes to eslint/tsconfig/ruff/etc. never reach installed hosts. Closes #849.

## Work Log

- 2026-07-05T19:28:43.052Z Started: Created ticket A4HG61
- 2026-07-05T20:12 Complete: define-behavior - 16 scenarios across 8 rules (+1 doc-only rule skipped); dimensions.md first (7 dimensions; load-bearing boundary = provenance x staleness). Branch caught up to main v0.65.0 (rust pack added deny.toml to managedFiles). Criteria converted ACs->Rules per user. Cold-start check found 8 gaps; all resolved in spec.md Design Decisions (manifest = .safeword/managed-files.json, committed, explicitly removed; generator-undefined = skip; execute-only recording).
- 2026-07-05T19:55 Decision (user): full manifest scope chosen over advisory-only / static-hash. Re-sized task→feature; spec.md authored (brief, 3 JTBDs, 9 ACs); scope/out_of_scope/done_when drafted, presenting at intake gates.
- 2026-07-05T19:32 Found (design-blocking): ALL motivating managed configs are ctx-generated (`generator: ctx => …`) — eslint.config.mjs & tsconfig.json (packs/typescript/files.ts:254+), ruff.toml/mypy.ini/.importlinter (packs/python/files.ts:245+), .golangci.yml (golang), clippy.toml/rustfmt.toml (rust), .sqlfluff (sql). A static per-file revision-hash list (cucumber pattern) CANNOT fingerprint generator output across versions → covers only static managed files (BDD lane starters, customer-edited by design). To heal ctx-generated configs requires recording what safeword actually wrote (provenance manifest) — larger surface (persistent .safeword state, setup/upgrade write, uninstall/reset cleanup, forward-only adopt-baseline for existing installs). Re-converging scope with user before building.
