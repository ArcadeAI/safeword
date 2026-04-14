# Phase 0-2: Understanding & Scope

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Understanding (Propose-and-Converge)

Follow the understanding pattern from SAFEWORD.md — including contribution techniques and the specificity self-test. Converge until the user accepts a proposal with structured scope (Scope, Out of Scope, Done When) written to the ticket spec.

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
