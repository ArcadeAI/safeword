---
id: 036
type: task
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Convert simple hooks from TypeScript/Bun to bash for lower overhead

**Goal:** Replace lightweight TypeScript hooks with bash equivalents to reduce per-edit latency.

**Why:** Every hook runs `bun ...`, paying ~50-100ms startup cost. With 5-7 hooks per edit, that's 250-700ms overhead. Simple hooks like `prompt-timestamp.ts` (inject current time) and `post-tool-bypass-warn.ts` (grep for patterns) don't need a runtime — they're one-liners in bash.

## Candidates

| Hook                     | Current                   | Complexity | Bash feasible?       |
| ------------------------ | ------------------------- | ---------- | -------------------- |
| prompt-timestamp.ts      | Inject UTC + local time   | Trivial    | Yes — `date` command |
| post-tool-bypass-warn.ts | Grep for patterns in file | Low        | Yes — `grep` + `jq`  |
| session-version.ts       | Read package.json version | Low        | Yes — `jq`           |
| pre-tool-config-guard.ts | Check file path patterns  | Low        | Yes — pattern match  |

## Acceptance Criteria

- [ ] Identified hooks converted to bash with equivalent behavior
- [ ] Bun startup overhead measured before/after
- [ ] No behavioral change for any hook
- [ ] Tests pass
