# Test Definitions — Ticket 144

> 4 rules, 16 scenarios. AODI validated. Covers happy path + failure modes + boundaries.
>
> **Post-pivot note:** The "manifest" is `SAFEWORD_SCHEMA` (TypeScript), not a runtime JSON file. The earlier Rule 5 dissolved — TypeScript's compiler enforces the shape, file-missing cases already live in Rules 1 and 2, and the empty-schema boundary is a degenerate case of Rule 4's format string. Rule 3 narrows from "any parity drift" to "any contract violation" because pair drift is intentionally not enforced at pre-commit (preserves template-iteration UX; release test catches pairs before merge).

## Rule: Pair entries enforce byte-identical files

> Rationale: Today every Claude/Cursor command and every template/runtime hook copy is byte-identical (11 pairs, zero divergence). Enforcing exact byte equality converts current convention into a load-bearing test with a trivial diff signal.

- [ ] When pair files are byte-identical, check passes for that entry
- [ ] When pair files differ in any byte, check fails with `[PAIR]` naming both paths
- [ ] When one side of a pair is missing, check fails identifying the missing path
- [ ] Whitespace-only differences fail (strict byte comparison, not normalized)

## Rule: Contract entries enforce required strings

> Rationale: Some parity invariants aren't file equivalence but content predicates — e.g., `lib/quality.ts` must export `QUALITY_REVIEW_MESSAGE` containing the four 143 markers (`CONFIDENT`, `BLOCKED`, `Tried:`, `Need:`). Contract entries express this without forcing whole-file equality.

- [ ] When all `requires` strings are present in the target file, check passes
- [ ] When one required string is missing, check fails with `[CONTRACT]` naming the missing string and target file
- [ ] When multiple required strings are missing, all missing strings reported in one failure
- [ ] When the target file is missing, check fails identifying the missing path

## Rule: Pre-commit hard-blocks broken contracts

> Rationale: Pre-commit catches **contract violations** at the moment they would land. Pairs are intentionally not enforced here — template iteration is a normal mid-development state and there's no auto-sync command. Pair drift is caught by the release test and the slash command. `--no-verify` bypass is intentional for the rare legitimate case.

- [ ] When working tree has any contract violation, `git commit` exits non-zero
- [ ] When working tree is clean (no contract violations), `git commit` proceeds normally
- [ ] `git commit --no-verify` succeeds even when contracts are violated
- [ ] When multiple contracts fail, all failures are listed before the commit is blocked (no fail-fast)

## Rule: Slash command reports state without blocking

> Rationale: `/parity-check` is the on-demand surface for "is the repo currently in sync?" across both pairs and contracts — useful for investigating drift that bypassed pre-commit, or for verifying state before opening a PR. Informational, not a gate.

- [ ] On clean tree, `/parity-check` reports `All N pairs and M contracts in sync.`
- [ ] On drifted tree, `/parity-check` lists each failure with entry name, type, and diagnostic
- [ ] When multiple entries fail, all failures are listed (no fail-fast)
- [ ] Slash command always exits successfully (informational, not a gate)
