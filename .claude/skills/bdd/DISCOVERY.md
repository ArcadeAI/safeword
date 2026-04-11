# Phase 0-2: Understanding & Scope

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Understanding (Propose-and-Converge)

Follow the propose-and-converge pattern from SAFEWORD.md:

1. **Contribute** a perspective on the user's idea before asking questions
2. **Embed open questions** inside your contribution, not before it
3. **Each turn:** incorporate what the user confirmed, narrow remaining open questions
4. **Converge** over 1-3 turns until the user accepts a proposal

**Scope derivation:** Every resolved question produces scope. The choice = In Scope. Rejected alternatives = Out of Scope. Include structured scope in your final proposal (Scope, Out of Scope, Done When).

**Exit understanding:** User accepts proposal AND structured scope written to ticket spec.

## Contribution Techniques

When contributing perspectives on complex features, draw on these techniques as needed — they are not mandatory sequential rounds:

| Technique                | What it surfaces                              | When to use                                        |
| ------------------------ | --------------------------------------------- | -------------------------------------------------- |
| **Failure modes**        | "What breaks? What are the consequences?"     | When reliability or error handling is unclear      |
| **Boundaries**           | "What's the minimum? Maximum?"                | When scope could expand indefinitely               |
| **Scenario walkthrough** | "Walk through a concrete situation"           | When the user's description is abstract            |
| **Regret test**          | "If we skip this, what support tickets come?" | When deciding what's in vs out of scope            |
| **User experience**      | "What does success feel like for the user?"   | When the user hasn't described the desired outcome |

Use these as the **content** of your contributions — not as a separate questioning phase. Weave them into your proposals naturally.

## Phase 0-2 Exit (REQUIRED)

Before proceeding to Phase 3:

1. **Verify ticket exists:** `.safeword-project/tickets/{id}-{slug}/ticket.md`
2. **Verify spec has:** Scope, Out of Scope, Done When
3. **Update frontmatter:** `phase: define-behavior`
4. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 0-2 - Understanding converged, scope established
   ```

## Planning Note

Phase 3 scenarios should draw from resolved questions during understanding — they inform which behavioral space to cover (not the exact scenarios). Add failure-mode scenarios from domain knowledge.

Phase 5 (decomposition) is optional — skip if the architecture is clear from the converged proposal.
