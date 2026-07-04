# Verify: Gate Bash-channel writes to the R/G/R ledger (#644 G3)

## Verify Checklist

**Test Suite:** ✓ 4513/4513 tests pass (5 skipped, 314 files; full `bun run test`, 950s)
**Gherkin:** ✅ Acceptance lane passes (181/181 scenarios, 3414 steps)
**Build:** ⏭️ Skipped — no build step (empty test-plan)
**Lint:** ✅ Clean (eslint + lint-gherkin + tsc --noEmit)
**Scenarios:** All 17 scenarios marked complete (+ cross-scenario row 63fcf57)
**PR Scope:** ✅ Diff matches ticket scope — predicate + shell-segments extraction + Bash-branch deny + Cursor pre-filter widen + tests + feature source; the one adjacent change (schema.ts self-reports preservedDir, commit 4655012) was a required-to-push blocker documented in the work log, not piggybacked feature work
**Dep Drift:** ✅ Clean — no new dependencies (node stdlib + intra-repo imports only)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — joins the pre-tool-quality gate family; adapter-as-source-of-truth pattern followed (gate logic in the Claude hook, Cursor pre-filter delegates)
**Experience:** ⏭️ N/A — internal enforcement plumbing; the SM persona experiences it as a denial message, covered by the TB1.AC1 scenario (message names the Edit channel + validation reason)
**Evidence limits:** ✅ None — full suite and Gherkin lane ran to completion in-sandbox

## Audit

- **Config drift:** ✅ `safeword sync-config --check` in sync
- **Architecture (depcruise):** ✅ no dependency violations (550 modules, 1670 deps); the new `lib/` modules import only sibling `lib/` files, cursor adapter imports from `lib/` (correct direction)
- **Dead code (knip):** ✅ no new unused exports from this ticket (the 5 reported unused exports — `CODEX_SESSION_START_HOOK_PATCH`, `OWNED_LABEL_PREFIXES`, `MONITOR_SOURCES`, `normalizeMarkdown`, `SYNCTICKETS_QUIET_COMMAND` — are all pre-existing, untouched)
- **Duplication (jscpd):** ✅ 1.47% overall; the template↔dogfood mirror pairs are intentional (enforced byte-identical by parity-check)
- **Outdated deps:** all dev-only, patch/minor (eslint 10.5→10.6, prettier 3.8→3.9, tsx, @types/node, knip, markdownlint-cli2) — low risk, defer to routine bump
- **Learning files:** ✅ all conform to Covers: convention

**Audit passed** (warnings: routine dev-dep freshness only — none introduced by this ticket).

## Evidence notes

- The literal #644 G3 bypass (`sed -i 's/^- \[ \] /- [x] /' <ledger>`) is denied end-to-end
  through the real Claude hook (integration test, anchor scenario 5d6930d).
- Three harnesses covered: Claude (Bash branch, source of truth), Codex (adapter translation,
  deny + clean pass-through), Cursor (`requiresFailClosedShellGate` widened, deny + allow).
- Detection limits (variables, eval, substitution, script files, single-`&`, `dd of=`,
  heredoc bodies, quoted-`>`) documented in the predicate module and pinned by a doc-contract
  test; the done-gate's distinct-SHA validation remains the backstop.
- The whole-ticket /quality-review (fresh-context, APPROVE) surfaced 6 verified suggestions;
  3 applied as the cross-scenario refactor (`&>`/`>|`, `mv/cp -t`, basename boundary), 3
  documented as accepted limits.
