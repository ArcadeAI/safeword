---
id: '054'
type: feature
phase: define-behavior
status: in_progress
created: 2026-03-26T20:56:55Z
last_modified: 2026-03-26T23:23:00Z
---

# Declarative rule engine for enforcement policies

**Goal:** Replace the ad-hoc TypeScript hook enforcement with a declarative rule engine where every policy is defined in a single format, evaluated by a single engine, and verifiable for consistency.

**Why:** Today's enforcement logic is spread across 5+ hook files with different patterns. Users can't customize rules. Adding new gates requires modifying TypeScript. A rule engine makes policies portable, customizable, and checkable.

## Work Log

- 2026-03-26T23:23:00Z Spec: wrote feature spec with 4 stories (refs: ./spec.md)
- 2026-03-26T20:56:55Z Created: ticket from formal verification research discussion

## Problem

Current enforcement is imperative and scattered:

- `pre-tool-quality.ts` — phase blocking, gate enforcement
- `post-tool-quality.ts` — LOC counting, phase/TDD detection, gate firing
- `pre-tool-config-guard.ts` — config file protection
- `stop-quality.ts` — done gate evidence
- `post-tool-bypass-warn.ts` — bypass detection

Each hook has its own logic, its own state reads, its own condition checks. There's no single place to see "what are ALL the rules?" and no way to check whether rules conflict.

## Proposed approach

### Rule format (strawman)

```yaml
rules:
  - name: block-code-edits-in-planning
    trigger: pre-tool-use
    tools: [Edit, Write, MultiEdit]
    when:
      phase_in: [intake, define-behavior, scenario-gate, decomposition, done]
    action: deny
    message: 'Phase {phase} does not allow code edits'

  - name: loc-gate
    trigger: post-tool-use
    tools: [Edit, Write]
    when:
      loc_since_commit_gt: 400
    action: gate
    gate_id: loc

  - name: config-guard
    trigger: pre-tool-use
    tools: [Edit, Write]
    when:
      file_matches: ['eslint.config.*', 'tsconfig.*', '.prettierrc']
    action: ask-approval
    message: "Config change detected. Fix code, don't weaken configs."
```

### Rule engine responsibilities

1. **Load** — Parse rule files (built-in + user-defined)
2. **Evaluate** — On each hook event, find matching rules, evaluate predicates, return action
3. **Verify** — Static check: no contradictions, no gaps, deterministic resolution order
4. **Report** — `safeword rules list`, `safeword rules check` CLI commands

### Migration path

- Phase 1: Define rule format, build engine, port ONE hook (config-guard — simplest)
- Phase 2: Port remaining hooks, keep old hooks as fallback
- Phase 3: Remove old hooks, add user-defined rule support
- Phase 4: Add `safeword rules check` (consistency verification)

## Open questions

- Rule conflict resolution: priority order? first-match? most-specific-wins?
- Should user rules be able to override built-in rules, or only add new ones?
- Where do user rules live? `.safeword-project/rules.yaml`? Per-ticket rules?
- How does the rule engine interact with quality-state.json? Does state management stay separate or become part of the engine?
- Performance: is YAML parsing on every hook call acceptable, or do we need a compiled/cached format?

## Acceptance criteria

- [ ] Rule format defined and documented
- [ ] Rule engine evaluates built-in rules correctly (parity with current hooks)
- [ ] User-defined rules supported
- [ ] `safeword rules check` verifies rule set consistency
- [ ] All existing hook behavior preserved (no regressions)
- [ ] At least one team has tested custom rules

## Dependencies

- Optionally informed by ticket 053 (state machine model clarifies what rules need to express)

## Estimated effort

Multi-week feature
