# Verify — 9MMWS7 upgrade-vehicle migration + both-dirs advisory

Date: 2026-06-12 · Branch: feat/AQJ95G-project-namespace-default · Fresh build, frozen tree.

## Verify Checklist

**Test Suite:** ✓ 2731/2731 tests pass (1 skipped; full suite on fresh dist)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** All 14 scenarios marked complete (42/42 R/G/R boxes)
**Dep Drift:** ✅ Clean (zero dependency changes — readline/promises is a node builtin)
**Parent Epic:** AQJ95G (siblings: 2/2 done — TAGWZ8, N9S5XG; this closes the epic's last child)
**Reconcile:** ✅ No pattern deviation (migration kept out of reconcile per the modes pattern; 3 deviations recorded in impl-plan.md incl. the latent advisory-ordering bug fixed en route)

## Audit

Audit passed (0 errors).

- Architecture: 0 errors; 8 pre-existing cucumber.mjs `no-orphans` baseline warnings.
- Dead code: only the pre-existing personas constants; nothing from this ticket.
- Duplication: 0.66% (10 clones, unchanged baseline).
- Config drift: sync-config clean.

## Done-when evidence

- Interactive upgrade on a legacy install prompts `[Y/n]` defaulting to yes (injected confirm seam, EOF → decline); accepting moves the dir — `git mv` when tracked (git status shows renames, proven), fs rename otherwise — and the same run reconciles on `.project/`.
- Declining (prompt `n` or `--no-migrate-namespace`) leaves the legacy root byte-unchanged; `--migrate-namespace` migrates promptless; non-TTY without flags prints the one-line nudge and never moves.
- Post-move: resolver lands on `.project/`; stale per-file `paths.*` overrides rewritten (value-asserted).
- `safeword check` flags both-dirs with a zero-exit advisory; silent on either single root. En-route fix: advisories were silently swallowed whenever issues existed — now printed first.
- Blocked target (file named `.project`) reports the cause and the upgrade continues on legacy — never a half-moved tree.
