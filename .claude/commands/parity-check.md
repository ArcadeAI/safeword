---
description: Report safeword parity drift (pairs + contracts). Safeword-repo only.
---

# Parity Check

Run the safeword parity check against `SAFEWORD_SCHEMA`. Reports drift on both pair entries (template ↔ dogfood byte-equality) and contract entries (file must contain specific strings). Informational — never blocks.

This command exists only in the safeword repo. It is NOT a customer-facing command and is NOT installed by `safeword install`.

```bash
bun scripts/parity-check.ts --mode=all
```

## What gets checked

- **Pairs** (from `SAFEWORD_SCHEMA.ownedFiles`): every entry with a `template` field is compared byte-for-byte against its dogfood counterpart. Currently 88 pairs.
- **Contracts** (from `SAFEWORD_SCHEMA.contracts`): every entry asserts its target file contains all required strings. Currently 1 contract.

## When to use

- Verifying repo state before opening a PR.
- Investigating drift that bypassed pre-commit (pre-commit only runs contracts).
- Auditing after a `git pull` of others' work.

## When NOT to use

- Mid-template-iteration: pair drift is expected while editing templates without syncing to dogfood. The release test catches pair drift pre-release; the slash command will surface it as informational here.

## Adding a new parity rule

- **New pair** (Claude/Cursor command, hook copy, etc.): add to `SAFEWORD_SCHEMA.ownedFiles` in `packages/cli/src/schema.ts`. The check picks it up automatically.
- **New contract** (file must contain string): add to `SAFEWORD_SCHEMA.contracts` in `packages/cli/src/schema.ts`.
