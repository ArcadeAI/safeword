---
id: 144
type: feature
phase: implement
status: in_progress
related: [143]
created: 2026-05-14T15:36:00Z
last_modified: 2026-05-14T16:22:00Z
scope: |
  Safeword-repo-only enforcement of two parity types via the existing
  `SAFEWORD_SCHEMA` (not a parallel JSON manifest). Three artifacts:

  (1) New top-level `SAFEWORD_SCHEMA.contracts: Record<path, { requires: string[] }>`
      field — declares predicate checks like "lib/quality.ts must contain
      QUALITY_REVIEW_MESSAGE, CONFIDENT, BLOCKED, Tried:, Need:".

  (2) Reusable `runParity({ schema, mode, rootDir })` function in
      `packages/cli/src/parity.ts`. `mode` is `'all'` (pairs + contracts) or
      `'contracts-only'`. Pair checks reuse the existing logic from the release test.

  (3) Three surfaces calling `runParity`:
      - `dogfood-parity.release.test.ts` (existing, extended) — `mode: 'all'`,
        catches everything pre-release.
      - `.husky/pre-commit` (extended) — `mode: 'contracts-only'`, hard-blocks
        commits that violate any contract. Pairs are NOT enforced at pre-commit
        because the existing release-only timing is deliberate (preserves
        template-iteration UX, no auto-sync command exists).
      - `.claude/commands/parity-check.md` (new) — `mode: 'all'`, on-demand
        all-up state report. Never blocks.
out_of_scope: |
  - Modifying the customer-facing `packages/cli/templates/commands/audit.md` in any way.
  - Overriding `.claude/commands/audit.md` (would mask customer audit and be clobbered by install).
  - Negative declarations in the schema — add if false positives emerge.
  - Auto-pairing by convention — explicit schema entries only.
  - Generalizing beyond safeword's repo.
  - Building a parallel JSON manifest at `.safeword-project/parity-pairs.json` (pivoted away;
    SAFEWORD_SCHEMA is the single source of truth).
  - Enforcing pair drift at pre-commit time (deliberate UX preservation; release test +
    main test suite catch it before merge).
  - Auto-sync command for template/runtime drift.
done_when: |
  - `SAFEWORD_SCHEMA` has a new `contracts` field (TypeScript type + entries).
  - Initial contract entry seeded for `hooks/lib/quality.ts` requiring `QUALITY_REVIEW_MESSAGE`,
    `CONFIDENT`, `BLOCKED`, `Tried:`, `Need:` (this is the 143 acceptance test).
  - `runParity({ schema, mode, rootDir })` exported from `packages/cli/src/parity.ts`,
    returns structured `{ failures: Failure[], passedCount }`.
  - `dogfood-parity.release.test.ts` extended to call `runParity` with `mode: 'all'`;
    behavior preserved (still pair-checks every ownedFile entry; now also contract-checks).
  - `.husky/pre-commit` invokes the new check script with `mode: 'contracts-only'` and
    hard-blocks (exit non-zero) on any contract violation. `--no-verify` still bypasses.
  - `.claude/commands/parity-check.md` exists, invokes the check script with `mode: 'all'`,
    never blocks regardless of result.
  - Unit tests cover all Rule 1 and Rule 2 scenarios for `runParity` (pair check + contract
    check core behaviors).
  - Integration tests cover pre-commit gate behavior (clean / contract-violation / no-verify
    / multi-failure aggregation) and slash command behavior.
  - `packages/cli/templates/commands/audit.md` byte-identical before/after (customer audit untouched).
  - No `.claude/commands/audit.md` override exists in safeword's repo (only `parity-check.md`).
---

# Safeword cursor-parity enforcement (manifest + pre-commit + slash command)

**Goal:** Stop folklore-driven Cursor parity. Replace it with an explicit manifest of pairs and contracts, enforced at commit-time (pre-commit hook) and on-demand (project-local slash command). Both gates live in safeword's repo only and never reach customers.

**Why:** Safeword has multiple files that must move together — `cursor/stop.ts` in two locations, `audit.md` in two locations (Claude template + Cursor copy), the `QUALITY_REVIEW_MESSAGE` export contract that Cursor depends on, and others that will accrue. Today, parity is folklore: contributors are expected to remember. There's no enforcement, so the cost of breaking it is "Cursor users silently get wrong behavior." Standing enforcement converts a tribal-knowledge invariant into a load-bearing test.

**Constraint that drove the design:** We cannot extend the customer-facing `audit.md`, and we cannot override `.claude/commands/audit.md` in safeword's own repo (would mask customer audit at dev time and would get clobbered by `safeword install`). Solution: keep the parity check entirely outside the customer audit surface — pre-commit + a separate slash command, both reading one manifest.

**Composes with 143.** 143 produces a new stop-hook prompt shape containing CONFIDENT, BLOCKED, Tried:, Need: tokens. 144's manifest will include those tokens as a `contract` entry on `lib/quality.ts`. The enforcement will fail until 143 ships — that's intentional: 144 is the acceptance test for 143's marker contract.

## Work Log

- 2026-05-14T15:36:00Z Started: Split from 143 at user request. Initial design was a /audit Cursor-parity check.
- 2026-05-14T15:42:00Z Promoted to feature (per user directive). Three independent assertions = three testable behaviors with independent failure modes.
- 2026-05-14T16:02:00Z Read existing /audit implementation: it's a markdown slash command in `packages/cli/templates/commands/audit.md` with bash blocks + agent-judgment passes. Severity-coded findings.
- 2026-05-14T16:17:00Z Scope expanded by user: enforcement should cover ALL safeword files with Cursor counterparts, not just 143's. Goes beyond a single /audit extension.
- 2026-05-14T16:20:00Z Surfaced conflict: a `.claude/commands/audit.md` override in safeword's repo would (a) mask the customer-facing audit at dev time and (b) get clobbered by `safeword install`. Pivoted to: pre-commit hook + separate slash command, both reading a project-local manifest. No audit.md modification.
- 2026-05-14T16:22:00Z User confirmed shape: pre-commit + slash command, hard-block on pre-commit, manifest at `.safeword-project/parity-pairs.json`. Phase advanced to `define-behavior`.
- 2026-05-14T16:35:00Z Phase 3 complete: 5 rules, 18 scenarios defined. Empirical research confirmed all 11 current parity pairs are byte-identical today (9 command pairs + 2 hook pairs); Claude/Cursor both accept same markdown+frontmatter format. v1 scope locked: `pair` + `contract` entry types only; `directory_pair`/`canonical`/negative-declarations documented as future. Phase advanced to `scenario-gate`.
- 2026-05-14T16:42:00Z Scenario-gate adversarial pass found 2 gaps (duplicate `name`, missing `name`). Resolved via Option B: dropped `name` field from manifest schema entirely. Paths are the natural identifier. Schema strictly smaller; two bug classes unrepresentable. Total scenarios remain 22 (Rule 5 still has 6; the duplicate/missing-name scenarios collapse). Diagnostic format updated: `[PAIR]` / `[CONTRACT]` with paths inline.
- 2026-05-14T16:44:00Z Phase 5 (decomposition) complete: 6 tasks ordered 1 → 2 → 3 → (4, 5, 6 parallel). Tasks 1-2 unit-tested (pure functions), 3-5 integration-tested (orchestration / hooks). Task 6 seeds the manifest with the 143 marker contract — acts as acceptance test for 143's shape. Phase advanced to `implement`.
- 2026-05-14T16:50:00Z Major pivot mid-implement: discovered `SAFEWORD_SCHEMA.ownedFiles` already declares every parity pair (including Claude/Cursor command pairs) and `dogfood-parity.release.test.ts` already byte-compares them. Avoided building a parallel JSON manifest. New design: add `contracts: Record<path, {requires:string[]}>` field to `SAFEWORD_SCHEMA`; build `runParity({schema,mode,rootDir})` function in `src/parity.ts`; three surfaces (extended release test, new pre-commit script, new slash command) call it with appropriate modes. Pre-commit only runs contracts (preserves template-iteration UX; no auto-sync command exists). Scenarios reduced 22 → 16 (Rule 5 dissolved — TS handles schema validity at compile time, file-missing cases already in Rules 1 and 2, empty-schema is a degenerate of Rule 4 format).

## Task Breakdown (post-pivot)

| Task                                                                                    | Scenarios            | Test type         | Depends on |
| --------------------------------------------------------------------------------------- | -------------------- | ----------------- | ---------- |
| 1. Add `ContractDefinition` type + `contracts: {}` to `SAFEWORD_SCHEMA`                 | — (type only)        | typecheck         | —          |
| 2. `runParity()` core: pair + contract checks + failure aggregation                     | 1-8, 12, 15          | unit              | Task 1     |
| 3. Replace internals of `dogfood-parity.release.test.ts` with `runParity({mode:'all'})` | (regression)         | regression smoke  | Task 2     |
| 4. New CLI script `scripts/parity-check.ts` (mode flag, exit codes)                     | 14, 16               | integration       | Task 2     |
| 5. `.husky/pre-commit` invokes script with `--mode=contracts-only`                      | 9, 10, 11, 12        | integration bash  | Task 4     |
| 6. `.claude/commands/parity-check.md` invokes script with `--mode=all`                  | 13, 14, 16           | integration smoke | Task 4     |
| 7. Seed initial contract entry (143 markers on `hooks/lib/quality.ts`)                  | (acceptance for 143) | —                 | Task 1     |

**Note:** Rule 3 scenarios reworded — "any parity drift" → "any contract violation" — because pair drift is intentionally not enforced at pre-commit (preserves template-iteration UX; release test + main test suite catch pairs before merge).

---

## Related Files

- `.safeword-project/parity-pairs.json` — manifest (to be created)
- `.husky/pre-commit` (or wherever safeword's husky config sits) — pre-commit gate (to be extended)
- `.claude/commands/parity-check.md` — on-demand slash command (to be created)
- `packages/cli/templates/hooks/lib/quality.ts` — first contract target
- `packages/cli/templates/hooks/cursor/stop.ts` / `.safeword/hooks/cursor/stop.ts` — first pair target
- `packages/cli/templates/commands/audit.md` / `.cursor/commands/audit.md` — second pair target (audit.md itself drifts between Claude/Cursor surfaces; manifest can capture)
- `packages/cli/templates/commands/audit.md` (customer-facing) — **must remain untouched** (sanity assertion in done_when)

## Design Notes

**Manifest schema (initial sketch — finalize in implement):**

```json
{
  "pairs": [
    {
      "a": "packages/cli/templates/hooks/cursor/stop.ts",
      "b": ".safeword/hooks/cursor/stop.ts"
    },
    {
      "a": "packages/cli/templates/commands/audit.md",
      "b": ".cursor/commands/audit.md"
    }
  ],
  "contracts": [
    {
      "file": "packages/cli/templates/hooks/lib/quality.ts",
      "requires": ["QUALITY_REVIEW_MESSAGE", "CONFIDENT", "BLOCKED", "Tried:", "Need:"]
    }
  ]
}
```

**No `name` field.** Paths are the natural identifier. Removes a class of manifest authoring errors (duplicate names, missing/empty names) by making them unrepresentable.

**Check semantics:**

- `pair` — both files must exist and be byte-identical. Failure: `[PAIR] Drift detected: <a> ≠ <b>`.
- `contract` — file must exist and contain all `requires` strings (verbatim, case-sensitive). Failure: `[CONTRACT] Missing: <list of missing strings> in <file>`.

**Pre-commit semantics:**

- Runs on every commit, against the working tree (not staged-only — drift on un-staged files still counts as broken state).
- Hard-blocks (exit 1) on any failure.
- Bypassable via `--no-verify`.

**Slash command semantics:**

- Runs the same check, but as an interactive report (no exit code blocking).
- Shows pass/fail per entry.

**Where the check logic lives:** Single TypeScript script (e.g., `packages/cli/scripts/parity-check.ts`) invoked by both the pre-commit hook and the slash command. One implementation, two entrypoints.

## Resolved Open Questions

- **Pre-commit + audit, or one?** Both — pre-commit catches changes, on-demand command catches state.
- **Manifest format** — JSON (simple, no parse complexity, language-agnostic).
- **Manifest location** — `.safeword-project/parity-pairs.json` (alongside other safeword-internal artifacts).
- **Cross-name pairs** — supported via the `contract` entry type, separate from `pair`.
- **Convention vs. manifest** — manifest only. Convention fails edge cases silently.
- **Audit.md override** — rejected (mask + clobber risks). Separate slash command + pre-commit instead.
- **Hard-block vs. warn on pre-commit** — hard-block, bypassable via `--no-verify`.

## Open Questions for Implementation (resolve in implement phase, not blocking define-behavior)

- **Where exactly does safeword's existing pre-commit live?** Check `.husky/`, package.json scripts, or other locations during implement. Adjust the extension target accordingly.
- **Manifest TS type** — generate from JSON Schema, or hand-write the type? Lean: hand-write (small, doesn't need a tool).
