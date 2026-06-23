---
id: QYYC5Y
slug: self-report-capture
type: feature
phase: done
status: done
created: 2026-06-23T03:43:37.802Z
last_modified: 2026-06-23T14:50:00.000Z
---

# Capture safeword's own runtime signals to a sanitized local spool (#345)

**Goal:** {One sentence: what are we trying to achieve?}

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-23T03:43:37.802Z Started: Created ticket QYYC5Y
- 2026-06-23T04:00:00Z Increment 1 (capture core + viewer + CLI producer), RED→GREEN:
  - `templates/hooks/lib/self-report.ts` — self-contained capture core: deny-by-default
    sanitizer (allowlist record; frame filter keeps safeword-internal frames, strips
    absolute/home prefix at the last `safeword/` segment), `recordSignal` (best-effort,
    never throws), `readReports`, `summarizeReports`. Single-homed under templates so
    both hooks (bun) and CLI `src/` (tsup-bundled) import it.
  - Guardrail test green: a signal whose message carries an abs path + `ghp_` token +
    file snippet persists a record containing NONE of them, while RETAINING the safeword
    frame + errorClass (pins the epic premortem).
  - `safeword self-report` viewer (`src/commands/self-report.ts`, `--json`) + cli.ts wiring.
  - CLI non-zero-exit producer (`src/self-report-capture.ts`) via `process.on('exit')`,
    gated to configured safeword projects (never litters unrelated dirs).
  - schema: registered `.safeword/hooks/lib/self-report.ts` (dogfood byte-parity copied);
    added `.safeword/self-reports/` to `SAFEWORD_TRANSIENT_PATHS`.
  - 16 new tests; parity + schema suites green; lint + (my) typecheck clean.
- DEFERRED to Increment 2 (touches hook files + settings + parity/sh): wire `recordSignal`
  into hook swallow sites (`catch → exit 0`); dedicated Stop-hook surfacing via
  `hookSpecificOutput.additionalContext` (factual phrasing, exit 0).
- 2026-06-23T05:22:00Z Increment 2a (Stop surfacing), GREEN:
  - `lib/self-report.ts`: added `readSessionReports` (single-session read) and
    `formatSelfReportSurfacing` (factual, non-imperative one-liner; null-free).
  - New `templates/hooks/stop-self-report.ts`: at Stop, surfaces this session's
    captured signals via `hookSpecificOutput.additionalContext` (exit 0, best-effort);
    silent when nothing captured. Registered in `SETTINGS_HOOKS.Stop` (config.ts) +
    `managedFiles` (schema.ts); dogfood hook + `.claude/settings.json` Stop entry added
    (surgical, no unrelated 0.49→0.55 drift pulled in); both dogfood files byte-identical.
  - Tests: lib units (readSessionReports isolation, surfacing factual-phrasing) +
    integration spawn of the real hook (emits additionalContext / silent on empty).
  - (superseded) Increment 2b below wires the crash-capture backstop.
- 2026-06-23T06:00:00Z Increment 2b (hook crash-capture backstop), GREEN:
  - `lib/self-report.ts`: `installCrashCapture(hookName)` registers
    uncaughtException/unhandledRejection handlers that capture a sanitized signal
    then exit 0 — preserving safeword's swallow-and-continue contract while no
    longer discarding the bug. Reads the installed version from `.safeword/version`.
    Explicitly-caught expected conditions never reach it, so it only fires on real bugs.
  - Wired into the four core hooks that run on every tool call / session end:
    post-tool-quality, pre-tool-quality, stop-quality, post-tool-lint (one import +
    one call each; dogfood copies byte-identical). Remaining hooks can adopt the
    same one-liner incrementally.
  - Integration test: a fixture hook that installs the backstop then throws →
    captured (source + errorClass, message never stored) and still exits 0.
