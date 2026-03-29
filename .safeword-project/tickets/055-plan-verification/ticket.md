---
id: '055'
type: feature
phase: define-behavior
status: backlog
created: 2026-03-26T20:56:55Z
last_modified: 2026-03-27T00:36:00Z
---

# Pre-execution plan verification for agent workflows

**Goal:** Before an agent executes a multi-step workflow (BDD, TDD), verify the plan against declared constraints and reject invalid plans before work begins.

**Why:** Today's enforcement is reactive — the agent hits a gate mid-work, backs up, retries. Plan verification catches problems before the first line of code, saving time and tokens. Research (VeriGuard, Google Research Oct 2025) showed pre-verified policies improve both safety AND task completion rates.

## Work Log

- 2026-03-27T00:36:00Z Spec: wrote feature spec with 5 stories — MCP server + plan verification (refs: ./spec.md)
- 2026-03-26T20:56:55Z Created: ticket from formal verification research discussion

## Problem

Current enforcement model:

1. Agent starts working
2. Agent does something that violates a rule
3. Hook blocks the action
4. Agent backs up and adjusts
5. Repeat until agent gets it right

This works but is wasteful. For a 5-scenario BDD feature, the agent might hit gates 3-5 times during execution. Each gate hit costs a tool call, a hook round-trip, and agent reasoning to recover.

## Proposed approach

### Plan submission

Before executing a workflow, the agent submits a structured plan:

```yaml
plan:
  ticket: 042
  type: feature
  phases:
    - intake: { artifacts: [spec.md] }
    - define-behavior: { artifacts: [test-definitions.md], scenarios: 4 }
    - decomposition: { tasks: 4 }
    - implement:
        scenarios:
          - name: 'user login'
            tdd: [red, green, refactor]
          - name: 'session timeout'
            tdd: [red, green, refactor]
          - name: 'password reset'
            tdd: [red, green, refactor]
          - name: 'account lockout'
            tdd: [red, green, refactor]
    - done: { evidence: [tests, scenarios, audit] }
```

### Plan verification

The system checks:

- All required phases are present and in order
- Each scenario includes complete TDD cycle (red, green, refactor)
- Done phase includes all required evidence types
- No phase attempts actions that violate its restrictions
- Plan is consistent with ticket type (patches don't need full BDD)

### Runtime: plan + enforcement

Plan verification does NOT replace runtime enforcement. It's additive:

- Plan check catches structural problems (missing phases, incomplete TDD cycles)
- Runtime hooks catch execution problems (LOC overflow, manual deviations)
- Together: fewer gate hits, faster completion

## Open questions

- How does the agent submit a plan? New hook event? New MCP tool? BDD orchestrator generates it?
- How granular should plans be? Full workflow? Per-phase? Per-scenario?
- What happens when the agent deviates from an approved plan? Warning? Block? Re-plan?
- Do custom team rules (from ticket 054) apply to plan verification?
- How do we handle plan amendments mid-execution? (Scope discovered during implement phase)

## Dependencies

- **Requires ticket 054** (declarative rule engine) — rules must be machine-readable to check plans against
- Informed by ticket 053 (state machine model defines valid phase transitions)

## Acceptance criteria

- [ ] Plan format defined
- [ ] Plan verification checks all structural properties
- [ ] BDD orchestrator generates plans automatically
- [ ] Agent interaction pattern designed (submit, approve/reject, revise)
- [ ] Measurable reduction in gate hits during execution (compared to reactive-only)
- [ ] Runtime enforcement still active as safety net

## Estimated effort

Months (after ticket 054 is complete)

## Research references

- VeriGuard (Google Research, Oct 2025): Pre-verified policies improved task completion 63% vs 40%
- VeriPlan / JPMorgan (CHI 2025): 96.3% F1 on plan validation with GPT-5
- AgentSpec (ICSE 2026): Runtime enforcement with formal semantics (complementary to plan verification)
