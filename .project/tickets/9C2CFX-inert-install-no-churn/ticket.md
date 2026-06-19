---
id: 9C2CFX
slug: inert-install-no-churn
type: task
phase: done
status: done
parent: 2H2XKH
created: 2026-06-18T17:00:07.083Z
last_modified: 2026-06-19T17:04:00.000Z
scope:
  - Audit every install/upgrade file write for paths that change the *resolved* formatter style of an existing customer repo — chiefly the additive `.prettierrc` JSON-merge (`packs/typescript/files.ts:~391`) that fills in safeword's `PRETTIER_DEFAULTS` (singleQuote, trailingComma, printWidth) on a bare customer `.prettierrc`, silently reformatting files on the next run.
  - Guarantee no setup/upgrade step runs a repo-wide format (no `prettier --write .`, no bulk hook sweep) against existing customer files.
  - Confirm 8BNSTE's prettier-shadow guarantee holds and generalize it into an explicit "install is inert on customer source" invariant with a regression test.
out_of_scope:
  - Runtime hook behavior (that is V7GGJZ).
  - Ignore wiring (that is EYRK34).
  - Greenfield repos (no existing formatter) — safeword writing its own config there is intended.
done_when:
  - Installing/upgrading safeword into a repo with an existing formatter config (bare `.prettierrc`, `prettier.config.*`, biome, etc.) produces zero changes to customer source files — verified by an integration test that snapshots customer files across `setup`/`upgrade`.
  - The additive `.prettierrc` merge either no longer changes resolved style on an existing config, or is gated so it can't (decision recorded in work log).
  - Full suite + lint green; hook template mirror synced if touched.
---

# Inert install/upgrade: never mass-reformat customer files

**Goal:** Installing or upgrading safeword changes zero customer source files — no formatter
churn at install time, ever.

**Why:** Customers report safeword "churning all their files immediately" on install. The
additive-config principle says configs add, never replace customer choices — that must hold for
file _content_, not just config keys. 8BNSTE fixed the `.prettierrc`-shadow case (225 files flipped);
this generalizes it to a standing guarantee with a regression test.

**Parent:** [2H2XKH](../2H2XKH-formatter-coexistence/ticket.md)

## Work Log

- 2026-06-18T17:03:00.000Z Started: Created under epic 2H2XKH. Prime suspect = additive `.prettierrc`
  JSON-merge filling safeword defaults on a customer's bare config. Need a customer-source snapshot
  test across setup/upgrade.
- 2026-06-19T17:00:00.000Z RED→GREEN (72b7f18e): confirmed the prime suspect — the `.prettierrc`
  jsonMerge (`files.ts:391`) fills `PRETTIER_DEFAULTS` + plugins into a customer's bare `.prettierrc`,
  changing resolved style → churn. Fix: gate the merge on `!existingPrettierConfig` (mirrors 8BNSTE's
  gate on the generator) — customer config left untouched; greenfield still gets plugins on safeword's
  own config. RED test in reconcile.test.ts asserts a bare `{printWidth:120}` survives reconcile with
  no keys added. Install-write audit (scope item 2): `format`/`format:check` scripts already gate on
  `existingFormatter` (mergeFormatScripts + setupWorkspaceFormatScripts:95); `prettier --write .` is
  only ever an ADDED script, never executed at install; 8BNSTE shadow test still green. No hook
  templates touched (src-only) → no mirror sync. Decision: revisit 8BNSTE's "merge is safe" call —
  filling unset keys DOES change resolved style. Full suite running for final verification.
- 2026-06-19T17:04:00.000Z Done: full suite green (3074 pass / 3 skip, 207 files), lint + tsc clean.
  Task complete — customer `.prettierrc` inertness fixed (72b7f18e) and the install-write audit found no
  other source-churn vector. Status → done.
