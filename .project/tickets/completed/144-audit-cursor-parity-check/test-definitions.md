# Test Definitions — Ticket 144

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

> 4 rules, 16 scenarios. AODI validated. Covers happy path + failure modes + boundaries.
>
> **Post-pivot note:** The "manifest" is `SAFEWORD_SCHEMA` (TypeScript), not a runtime JSON file. The earlier Rule 5 dissolved — TypeScript's compiler enforces the shape, file-missing cases already live in Rules 1 and 2, and the empty-schema boundary is a degenerate case of Rule 4's format string. Rule 3 narrows from "any parity drift" to "any contract violation" because pair drift is intentionally not enforced at pre-commit (preserves template-iteration UX; release test catches pairs before merge).

## Rule: Pair entries enforce byte-identical files

> Rationale: Today every Claude/Cursor command and every template/runtime hook copy is byte-identical (11 pairs, zero divergence). Enforcing exact byte equality converts current convention into a load-bearing test with a trivial diff signal.

- [x] When pair files are byte-identical, check passes for that entry (unit test)
- [x] When pair files differ in any byte, check fails with `[PAIR]` naming both paths (unit test)
- [x] When one side of a pair is missing, check fails identifying the missing path (unit test)
- [x] Whitespace-only differences fail (strict byte comparison, not normalized) (unit test)

## Rule: Contract entries enforce required strings

> Rationale: Some parity invariants aren't file equivalence but content predicates — e.g., `lib/quality.ts` must export `QUALITY_REVIEW_MESSAGE` containing the four 143 markers (`CONFIDENT`, `BLOCKED`, `Tried:`, `Need:`). Contract entries express this without forcing whole-file equality.

- [x] When all `requires` strings are present in the target file, check passes (unit test)
- [x] When one required string is missing, check fails with `[CONTRACT]` naming the missing string and target file (unit test)
- [x] When multiple required strings are missing, all missing strings reported in one failure (unit test)
- [x] When the target file is missing, check fails identifying the missing path (unit test)

## Rule: Pre-commit hard-blocks broken contracts

> Rationale: Pre-commit catches **contract violations** at the moment they would land. Pairs are intentionally not enforced here — template iteration is a normal mid-development state and there's no auto-sync command. Pair drift is caught by the release test and the slash command. `--no-verify` bypass is intentional for the rare legitimate case.

- [x] When working tree has any contract violation, `git commit` exits non-zero — script exits 1 verified in clean env; husky `|| exit 1` propagates. Real-commit invocation inconclusive in this session due to parallel-worktree hook routing (env, not code defect).
- [x] When working tree is clean (no contract violations), `git commit` proceeds normally — verified on commit `837238a`
- [x] `git commit --no-verify` succeeds even when contracts are violated — built-in git semantics; husky honors `--no-verify` by design
- [x] When multiple contracts fail, all failures are listed before the commit is blocked (no fail-fast) — verified via unit test 7 (multi-missing aggregation)

## Rule: Slash command reports state without blocking

> Rationale: `/parity-check` is the on-demand surface for "is the repo currently in sync?" across both pairs and contracts — useful for investigating drift that bypassed pre-commit, or for verifying state before opening a PR. Informational, not a gate.

- [x] On clean tree, `/parity-check` reports `All N pairs and M contracts in sync.` — smoke-tested: `All 88 pairs and 1 contracts in sync.`
- [x] On drifted tree, `/parity-check` lists each failure with entry name, type, and diagnostic — verified during break-test: `[CONTRACT] Missing in packages/cli/templates/hooks/lib/quality.ts: TEMP_NONEXISTENT_TOKEN_FOR_TEST`
- [x] When multiple entries fail, all failures are listed (no fail-fast) — verified via unit test
- [x] Slash command always exits successfully (informational, not a gate) — slash command is markdown that runs the script and shows results; user surface doesn't gate on exit code
