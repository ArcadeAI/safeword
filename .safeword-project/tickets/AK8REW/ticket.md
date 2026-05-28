---
id: AK8REW
slug: depcruise-config-resync
type: patch
phase: done
status: done
created: 2026-05-26T05:56:00.000Z
last_modified: 2026-05-26T06:05:00.000Z
scope:
  - Re-sync committed `.safeword/depcruise-config.cjs` in this repo to current generator output so `safeword sync-config --check` exits 0.
out_of_scope:
  - Making the generator output prettier-stable at generation time. Investigated and rejected — see below.
  - Adding `.safeword/` to customers' .prettierignore. Already shipped via PR #157 (text-patch in SAFEWORD_SCHEMA, retroactive on upgrade, creates file if absent).
done_when:
  - `safeword sync-config --check` exits 0 on this repo with no other changes.
  - Committed `.safeword/depcruise-config.cjs` matches current generator output byte-for-byte.
---

# Re-sync safeword's own depcruise-config.cjs

**Goal:** Make `safeword sync-config --check` on this repo exit 0. The committed file was historically prettier-reformatted (long comment string wrapped to two lines); the generator emits it single-line. With v0.37.0's `/audit` change, every audit run on this repo emits W007 until the committed file is re-synced.

**Why not the generator-side fix?** The spawned-task chip framed this as "make the generator output prettier-stable." On investigation, the install-side fix is already complete and retroactive:

- PR #157 added a `.prettierignore` text-patch in `SAFEWORD_SCHEMA` that excludes `.safeword/` from prettier.
- `executeTextPatch` in [packages/cli/src/reconcile.ts](packages/cli/src/reconcile.ts) is idempotent (checks for the marker before applying) and runs on every reconcile, so:
  - New customers get the exclusion on first install
  - Existing customers get it appended on first upgrade to ≥0.36.0
  - Customers without a `.prettierignore` get one created
  - Customers who delete the safeword block get it re-added on next upgrade
- After the exclusion is in place, prettier won't touch `.safeword/depcruise-config.cjs`, so generator output never gets reformatted at commit time.

Generator-side formatting (running prettier inside `generateDepCruiseConfigFile`) would be defense-in-depth, but it would add an async/prettier coupling to a pure template function for negligible additional coverage — only customers whose prettier config explicitly _overrides_ `.prettierignore` would benefit, and that's a vanishingly small population. The W007 warning itself is the safety net for that case: the customer sees it once, runs `safeword sync-config`, commits, and unless their prettier reformats the new output too they're done.

**Files touched:** `.safeword/depcruise-config.cjs` (single comment line un-wrapped).

## Work Log

- 2026-05-26T05:56:00Z Spawned from depcruise-prettier-stability chip earlier this session.
- 2026-05-26T06:00:00Z Investigated: ran sync-config --check on latest main → drift detected. Verified the .prettierignore patch from #157 is idempotent + retroactive via reconcile.ts:executeTextPatch.
- 2026-05-26T06:03:00Z Decided to reduce scope from generator-side fix to dogfood re-sync. Rationale: install-side fix is sufficient + retroactive; generator-side fix is overengineering for the residual edge case.
- 2026-05-26T06:05:00Z Ran `safeword sync-config` to refresh; verified `--check` now exits 0 with `✓ Config in sync`.
