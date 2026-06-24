# Verify — humanize-first-run-runtime (UJSZXB)

## Verify Checklist

**Test Suite:** ✓ 492/492 tests pass (done-gate lane) + 99/99 in the bun-check + dependency-readiness integration tests
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (eslint 0 errors; shellcheck clean on `session-bun-check.sh`; `dependency-readiness.ts` is template-ignored by design)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 4/8 done)
**Reconcile:** N/A — applied the QQJK5S "speak plainly / gloss at the decision point" contract; no new pattern introduced

## What was verified

Reworded the three first-run failure messages an NTB can hit before any agent
translation, applying safety framing and dropping the runtime jargon:

- **`session-bun-check.sh`** (stderr wall) — dropped "PATH", "quality gates /
  auto-linting / review hooks"; now: _"safeword needs a small tool called 'bun'
  to run its safety checks … the agent runs unguarded."_ Install command kept on
  its own line. "Claude Code session" → "your agent session" (safeword is
  cross-agent). Rendered output eyeballed; shellcheck clean.
- **`formatDependencyRecovery`** (deny reason + agent context — one change, both
  surfaces) — dropped "worktree" / "from the project root"; now plain
  ("this project's tools aren't installed yet, so safeword's checks can't run")
  with the install command on its own indented line.
- **`setup.ts` bun warning** — aligned to the same plain, safety-framed wording;
  dropped "quality hooks" / "Hooks will hard-block".

Both hook templates synced **byte-identical** to their dogfood copies. The
bun-check test was updated to assert the plain wording (no "quality hooks").

## Scope call

Deferred a net-new setup-time **preflight gate** — `setup.ts` already warns when
bun is missing, so the gap was the mid-session walls (now humanized), not a
missing setup warning. A new gate would be scope creep. Codex/Cursor inherit the
same reworded `formatDependencyRecovery` (shared lib) and the cross-agent
"your agent session" phrasing.

Ready to mark done.
