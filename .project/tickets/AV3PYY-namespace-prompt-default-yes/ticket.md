---
id: AV3PYY
slug: namespace-prompt-default-yes
parent: K6CAJN-ntb-experience-epic
type: task
phase: done
status: done
created: 2026-06-24T00:46:00Z
last_modified: 2026-06-24T00:52:00Z
---

# Flip the interactive namespace prompt default to Yes

**Goal:** Make the `safeword upgrade` namespace-migration prompt accept on Enter (default Yes), so a non-technical user who doesn't parse the question gets the recommended outcome by hitting Enter.

**Why:** Resolves the deferred decision from KRUEWC (de-jargon the CLI). The prompt wording was already humanized; this changes the _default answer_. **Explicit product decision by the user (2026-06-24)** after being shown the tradeoff.

## The tradeoff (accepted)

This reverts part of issue #227's safety choice: `promptNoDefault` defaulted to **No** specifically because _agentic environments hit Enter automatically_, and Yes-default lets an agent silently migrate (move many tracked files) without real consent. The user chose Yes-default with this risk in view. Mitigation kept: a closed/EOF stream still **declines** (only a deliberate Enter accepts), preserving the anti-hang fix.

## Scope

- Rename `promptNoDefault` → `promptYesDefault` in `upgrade.ts` (its only caller is the migration prompt). Enter/empty → accept; `n…` → decline; EOF/close → decline (sentinel-distinguished from Enter).
- Prompt string `[y/N]` → `[Y/n]`.
- Update the function doc + reconcile with `resolveMigrationConsent`'s comment (which already said "defaulting to yes").
- Update unit tests: Enter now accepts; EOF still declines.

## Work Log

- 2026-06-24T00:46:00Z Created — resolves KRUEWC's deferred default-flip; user chose Yes with the #227 tradeoff shown.
