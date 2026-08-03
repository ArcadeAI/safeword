# Manual acceptance: Generate compliant replies without correction loops

## Live Claude walkthrough

- Runtime: Claude Code 2.1.170, local print-mode session in a fresh project installed from this worktree.
- Attempted task: create `proof.txt`, then report the completed edit.
- Result: runtime limitation. Claude initialized the managed session, but the API rejected the configured `claude-opus-4-20250514` model with HTTP 404. Explicit `sonnet` and `fable` aliases were also rejected before any tool call or builder-visible completion.
- Evidence boundary: this is recorded as unavailable live-runtime proof. Passing hook subprocess tests are not represented as builder-visible evidence.

## Parser reference benchmark

- Runner: local Apple host, Bun 1.3.14.
- Workload: 4,194,393-byte adversarial reply containing a large prose prefix and an ignored HTML-block decision-brief lookalike.
- Method: in-process parser; 10 warm-up evaluations followed by 20 measured repetitions; every evaluation rejected the workload.
- Timing: minimum 1.615 ms; median 1.680 ms; p95 1.835 ms; maximum 1.930 ms.
- Budget result: pass. Every measured evaluation completed below the 500 ms ceiling.
