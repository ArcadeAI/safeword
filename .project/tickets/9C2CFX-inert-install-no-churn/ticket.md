---
id: 9C2CFX
slug: inert-install-no-churn
type: task
phase: intake
status: in_progress
parent: 2H2XKH
created: 2026-06-18T17:00:07.083Z
last_modified: 2026-06-18T17:03:00.000Z
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
