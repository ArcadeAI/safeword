# Phase 0-2: Context Check & Discovery

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Context Check

Check if spec exists with required context:

1. **Read spec** (or note if missing)
2. **Check for goal AND scope sections**
3. **If missing or incomplete** → ask context questions:
   - "What's the goal? What should users be able to do?"
   - "What's in scope? What are we building?"
   - "What's explicitly out of scope?"
4. **Create/update spec** with answers

**Exit context check:** Spec has goal AND scope sections.

**Edge case:** User gives partial answer (goal but not scope) → Ask only for missing field, don't re-ask answered questions.

## Discovery (Optional)

After context check, offer discovery:

> "Want to spitball edge cases before we dive in?"

**If user declines** (or says "ready") → update ticket to `define-behavior`, proceed to Phase 3.

**If user accepts** → run discovery rounds:

1. Ask 2-3 PM-style questions per round:
   - Round 1: User experience ("What does success feel like?")
   - Round 2: Failure modes ("What breaks? What are consequences?")
   - Round 3: Boundaries ("What's the minimum? Maximum?")
   - Round 4: Scenarios ("Walk through a concrete situation")
   - Round 5: Regret ("If we skip this, what support tickets come?")
2. Capture insights in spec under "## Discovery" section
3. After each round: "Another round or ready to proceed?"
4. **Max 5 rounds** — after round 5, proceed automatically

**Exit discovery:** User says "ready" OR max rounds reached → update ticket to `define-behavior`.

**Example round:**

> Agent: "Round 2 - Failure modes. What happens when a session expires mid-flow?"
> User: "They lose progress. We'd get support tickets about lost work."
> Agent: "Got it - session expiry = data loss risk. Another round or ready?"

## Phase 0-2 Exit (REQUIRED)

Before proceeding to Phase 3:

1. **Verify ticket exists:** `.safeword-project/tickets/{id}-{slug}/ticket.md`
2. **Update frontmatter:** `phase: define-behavior`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 0-2 - Context established
   ```
