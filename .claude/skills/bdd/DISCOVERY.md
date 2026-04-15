# Phase 0-2: Understanding & Scope

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Understanding (Propose-and-Converge)

Follow the understanding pattern from SAFEWORD.md — including contribution techniques and the specificity self-test. Converge until the user accepts a proposal with structured scope (Scope, Out of Scope, Done When) written to the ticket spec.

### Concrete example

**Context:** User says "I want to add a --verbose flag to the lint command."

**Agent turn 1:**

> You want `--verbose` on lint to show more detail during linting. I'd frame this as: verbose mode surfaces which files are being checked, which linters ran, and any warnings that are currently suppressed.
>
> A couple of things to nail down — the output format (structured JSON vs human-readable lines) and whether verbose shows passing files too or just failures. My instinct is human-readable, failures + warnings only. What do you think?

**User:** "Human-readable, but show passing files too — I want to see it's actually checking everything."

**Agent turn 2:**

> Got it. Here's the proposal:
>
> **Scope:** `--verbose` flag on lint command. Shows each file checked, linter used, and result (pass/warning/fail). Human-readable output.
> **Out of Scope:** Structured JSON output, debug-level linter internals, verbose mode for other commands.
> **Done When:** `--verbose` produces per-file output showing filename, linter, and result for every file checked.
>
> Ready to proceed?

**User:** "Yes."

**Result:** Zero open questions → proceed to sizing.

## Phase 0-2 Exit (REQUIRED)

Before proceeding to Phase 3:

1. **Verify ticket exists:** `.safeword-project/tickets/{id}-{slug}/ticket.md`
2. **Verify frontmatter has:** `scope`, `out_of_scope`, `done_when` fields (non-empty)
3. **Update frontmatter:** `phase: define-behavior`
4. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 0-2 - Understanding converged, scope established
   ```

## Planning Note

Phase 3 scenarios draw from the self-test: behavior that changes seeds happy paths and error paths, observable done states seed acceptance criteria. Behavior that stays the same is protected by the existing test suite — it informs out-of-scope, not new scenarios. Add failure-mode scenarios from domain knowledge.

Phase 5 (decomposition) is optional — skip if the architecture is clear from the converged proposal.
