# Manual acceptance: Generate compliant replies without correction loops

## Live Claude walkthrough

- Runtime: explicit `/Users/alex/.local/share/fnm/node-versions/v22.22.3/installation/bin/claude`, Claude Code 2.1.220, local print-mode session against this configured worktree.
- Attempted task: report that PR #1835 is ready, all CI checks pass, and no implementation work remains while following project reply instructions.
- Result: pass. Claude returned one structurally compliant CONFIDENT decision brief in one turn (`num_turns: 1`), with Decided, Open, and terminal Next paragraphs. No format-correction rewrite appeared.
- Earlier failure diagnosis: an unqualified login-shell invocation selected `/usr/local/bin/claude` 1.0.43. That obsolete installation maps `sonnet` to removed model `claude-sonnet-4-20250514` and reproduced the exact HTTP 404 independently of Safeword. Absolute-path probes through Claude Code 2.1.170 and 2.1.220 succeeded.
- Evidence boundary: this proves the local Claude Code surface. It does not prove an Anthropic-managed Claude Code Cloud session, which this environment cannot launch.

## Parser reference benchmark

- Runner: local Apple host, Bun 1.3.14.
- Workload: 4,194,454-byte adversarial reply containing a large prose prefix and an ignored HTML-block decision-brief lookalike.
- Method: in-process parser; 10 warm-up evaluations followed by 20 measured repetitions; every evaluation rejected the workload.
- Instrumentation: 16,777,661 examined characters, within the declared eight-times fixed linear bound.
- Timing after quality-review remediation: minimum 1.542 ms; median 1.582 ms; p95 1.698 ms; maximum 1.741 ms.
- Budget result: pass. Every measured evaluation completed below the 500 ms ceiling.
