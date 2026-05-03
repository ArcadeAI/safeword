---
id: 139
type: task
phase: implement
status: ready
created: 2026-04-19T13:29:51Z
last_modified: 2026-04-19T13:29:51Z
scope: |
  Harden the unified customer override contract shipped in ticket 138.
  Three concrete changes:

  1. Delete getSafewordEslintConfigStandalone; always use the extending
     template so customer overrides propagate to the LLM hook from the
     first `safeword setup` (currently they only propagate after the
     first `safeword upgrade` — verified bug).

  2. Narrow the extending template's catch using an existsSync gate, so
     customer config syntax errors and missing-plugin errors surface loud
     instead of silently dropping overrides.

  3. Add parameterized Scenario 2.4 in
     packages/cli/tests/integration/override-survival.test.ts covering
     Ruff unified-standalone mode (3 override types: ignore,
     per-file-ignores, extend-select).
out_of_scope: |
  - Hardening the legacy `.eslintrc.*` template — ESLint 10 (ticket 099)
    removes legacy support entirely; hardening now is disproportionate.
  - Deleting getSafewordEslintConfigLegacy — stays in 099's scope.
  - Tightening hasLegacyCustomerRuffExtend regex — lower-priority
    minor hardening; spawn separately if it surfaces.
done_when: |
  - getSafewordEslintConfigStandalone deleted from
    packages/cli/src/templates/config.ts.
  - getSafewordEslintConfig dispatch simplified (no standalone branch).
  - Extending template uses `existsSync` gate + re-throws on any import
    error when the customer file exists.
  - Scenario 2.4 added as parameterized `it.each` (3 rows) and GREEN.
  - Ticket 137's Rule 1 + Rule 2 + Scenario 1.4 still GREEN.
  - Manual smoke verified: fresh `safeword setup` + customer override +
    LLM hook (no `upgrade` run) honors the override.
---

# Harden the unified customer override contract (follow-up to #138)

Specs and debate live in ticket [138's follow-up section](../completed/138-unify-customer-override-contract/ticket.md). This ticket is the actionable form so tooling / future sessions find it as an active task.

## Why this exists

Ticket 138 unified the customer override contract across ESLint and Ruff. Quality review + post-commit verification exposed three gaps:

1. **Fresh-setup bug (user-visible, empirically proven).** After `safeword setup` on a fresh project, `.safeword/eslint.config.mjs` uses the STANDALONE template — doesn't import customer's project config. Customer overrides to project `eslint.config.mjs` are silently ignored by the LLM hook until the customer runs `safeword upgrade` (which triggers re-detection). Root cause: `reconcile.ts` captures `ctx` once with `existingEslintConfig = undefined`; plans owned files first (standalone content computed) then managed files (customer file written). No re-detection between steps.

2. **Extending template's catch is too broad.** `try/catch` around `await import('../eslint.config.mjs')` swallows ALL errors, including customer syntax errors and nested missing-plugin errors (both fire `ERR_MODULE_NOT_FOUND` — verified empirically). Silent correctness loss — contradicts safeword's mission to surface errors to Claude.

3. **Scenario 2.4 coverage gap.** Ruff unified-standalone mode (fresh project → customer adds override to safeword-generated ruff.toml → hook honors it) is manually verified in 138's follow-up but not codified as a regression test.

## Action plan

### 1. Delete standalone template (~35 LOC removed)

**File:** `packages/cli/src/templates/config.ts`

- Remove `getSafewordEslintConfigStandalone(...)` function body (~31 LOC).
- Simplify dispatch in `getSafewordEslintConfig` (~4 LOC removed):

```ts
export function getSafewordEslintConfig(
  existingConfig: string | undefined,
  hasExistingFormatter = false,
): string {
  if (existingConfig?.startsWith('.eslintrc')) {
    return getSafewordEslintConfigLegacy(existingConfig, hasExistingFormatter);
  }
  // existingConfig truthy OR undefined → extending template.
  // When undefined, safeword's managedFiles generates customer's
  // eslint.config.mjs in the same setup run; by hook-execution time
  // the file exists and extend template's existsSync gate succeeds.
  return getSafewordEslintConfigExtending(
    existingConfig ?? 'eslint.config.mjs',
    hasExistingFormatter,
  );
}
```

### 2. Narrow catch in extending template (~8-10 LOC changed)

**File:** `packages/cli/src/templates/config.ts` (`getSafewordEslintConfigExtending` template string)

```js
import { existsSync } from 'node:fs';
// ... existing imports ...

let projectConfig = [];
const projectConfigPath = new URL('../eslint.config.mjs', import.meta.url);
if (existsSync(projectConfigPath)) {
  // File exists — any import failure is a real error (syntax, missing plugin, etc.)
  // Let it throw so the hook fails loud instead of silently dropping overrides.
  projectConfig = (await import('../eslint.config.mjs')).default;
  if (!Array.isArray(projectConfig)) projectConfig = [projectConfig];
}
// File absent → projectConfig stays [] → hook runs with safeword defaults only.
```

Universal Node 20+ compatibility (doesn't depend on `import.meta.dirname` which is Node 20.11+).

### 3. Add Scenario 2.4 (~80-100 LOC added)

**File:** `packages/cli/tests/integration/override-survival.test.ts`

New describe block `Rule: Python overrides in standalone-generated ruff.toml (ticket 139)` with one parameterized `it.each` covering 3 override types (ignore, per-file-ignores, extend-select). Match Rule 2's describe structure but use parameterized shape per 2026 BDD guidance.

### Acceptance

- [ ] Standalone template function + dispatch branch deleted
- [ ] Extending template uses `existsSync` gate, no broad catch
- [ ] Scenario 2.4 added and GREEN (all 3 parameterized rows)
- [ ] Full `override-survival.test.ts` suite GREEN (existing 7 + new 3 rows = 10)
- [ ] Manual smoke: fresh `safeword setup`, no `upgrade`, customer override honored
- [ ] Rebuild: `bun run build` in `packages/cli/` succeeds

## Related

- **Supersedes** the follow-up section of [ticket 138](../completed/138-unify-customer-override-contract/ticket.md).
- **Should land before** [ticket 099 (ESLint 10 migration)](../099-eslint-10-migration/ticket.md) unblocks — template-set simplification keeps 099's diff clean.
- **Does not** touch `getSafewordEslintConfigLegacy` — that deletion stays in 099's scope.
- Ticket [019](./../completed/019-customer-override-rules/ticket.md) already superseded by 138; no further change here.

## Work Log

---

- 2026-04-19T13:29:51Z Filed from 138's follow-up section. Specs debated and locked in 138's ticket body; this ticket is the actionable form tooling can surface.

---
