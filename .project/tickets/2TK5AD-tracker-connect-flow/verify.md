# Verify: Tracker connect/onboarding flow (2TK5AD)

**Phase:** verify → done. Two+ RGR loops → whole-ticket `/quality-review` + `/audit` required.

## Test suite

Full vitest suite (packages/cli), final state at `2ad28e2`:

- **3465 passed | 5 skipped (3470)** across 243 files, 0 failures. (5 skips are
  pre-existing; the flaky cucumber dogfood test that occasionally fails in the
  full run passed clean here.)
- Targeted `tests/tracker-connect/` — **19 passed (4 files)**: handoff (2),
  orchestration `connect.test.ts` (13), command wiring `connect-command.test.ts`
  (2), setup-offer `offer.test.ts` (2).

## Static checks

| Check        | Result                                        |
| ------------ | --------------------------------------------- |
| typecheck    | ✓ `tsc --noEmit` clean                        |
| eslint       | ✓ clean (incl. unicorn/sonarjs/import-sort)   |
| gherkin-lint | ✓ clean                                       |
| prettier     | ✓ `--check` clean                             |
| depcruise    | ✓ 0 violations (177 modules) — see note below |

### Architecture fix found during verify

depcruise flagged `cli-no-cross-command-imports`: `setup.ts → connect.ts`. Fixed
by extracting the port-wiring composition root to `tracker-connect/run.ts`
(`3adfbc3`); both `commands/connect.ts` and the `setup` offer now call
`runConnect` with an injected logger, so neither command imports the other.
Re-cruise: 0 violations.

## /audit (feature done-gate)

- **Architecture:** no circular deps, no layer violations (depcruise clean).
- **Dead code (knip):** the only unused export is `OWNED_LABEL_PREFIXES`
  (`tracker-sync/labels.ts`, JS5K5G — pre-existing, not this ticket). No unused
  export in `tracker-connect/`. `gh` shows as an "unlisted binary" alongside the
  already-merged `tracker-sync/clients.ts` — the established `execFileSync('gh',…)`
  pattern, not a regression.
- **Duplication:** module is small and distinct; no clones introduced.

## /quality-review (independent, fresh-context reviewer)

**Verdict: APPROVE — no critical issues.** Node APIs verified current this
session: `node:readline/promises` createInterface/question (Stable) and
`child_process.execFileSync` (Stability 2), options used are documented.
Security confirmed: no path writes the token to config/log/argv; verify shells
via an argv array (no injection); `connect.test.ts:113` proves the sentinel
token reaches neither config nor logs.

Two suggestions applied (`2ad28e2`):

1. **handoff.ts** — GitHub PAT step said "paste … when prompted," but v1's
   secret store is env-only; reworded to "export … as `GITHUB_TOKEN`" so the
   printed instruction matches what the code consumes.
2. **run.ts** — dropped the `HAS_ENV_VAR` Set that duplicated the
   `CREDENTIAL_ENV_VAR` keyset; the env-var name is now derived from it.

### Scope-honesty notes (no code change)

- **Linear verify is GitHub-only in v1.** `verify.ts` returns `ok:false` for
  Linear pending the Arcade integration (same deferral as JS5K5G's Linear
  writer), so a Linear connect cannot reach the live/seed path this release.
  Documented in the ticket scope, impl-plan deviations, and the actionable
  error message — surfaced, not silent.
- **Secret store is env-only in v1.** OS-keychain storage (a stdin-fed write to
  keep the token out of argv) is a deferred follow-up; the `SecretStore` port is
  where it slots in. Documented in `secret-store.ts`.

## AC coverage

All 8 ACs implemented and tested through the real orchestration with only the
process boundary (prompt / secret store / verify) mocked — the #363 lesson.
Entry-point coverage from real collaborators: `connect-command.test.ts` (command
→ runConnect → connectTracker) and `offer.test.ts` (setup offer → real
connectTracker). No "X was called" tautologies.

**Verdict: ✅ verify passed — ready to mark done.**
