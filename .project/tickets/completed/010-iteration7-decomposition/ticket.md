---
id: 010
type: feature
phase: done
status: done
parent: 001
created: 2026-01-07T20:00:00Z
last_modified: 2026-01-07T21:00:00Z
---

# Iteration 7: Decomposition at Checkpoints

**Goal:** Agent suggests splitting large work at 5 checkpoints with calibrated thresholds.

**Parent Epic:** 001-stateful-bdd-flow

## Stories Covered

From parent spec:

- **Story 10:** Decomposition at Checkpoints

## Scope

**In Scope:**

1. Entry checkpoint: Detects epic-level requests → creates epic + feature specs
2. Phase 3 checkpoint: Flags >15 scenarios or 3+ clusters → splits by journey
3. Phase 5 checkpoint: Flags >20 tasks or 5+ components → splits by component
4. Phase 6 checkpoint: Flags >10 tests per slice → breaks into smaller slices
5. TDD Loop checkpoint: Flags >5 unit/integration tests per E2E → breaks E2E into steps
6. Post-split protocol: artifact creation, ticket linking, restart points
7. User override ("proceed anyway") support

**From Spec - Checkpoints, Triggers, and Artifacts:**

| Checkpoint | When                    | Trigger                                                                   | Action                       | Artifacts Created                                   |
| ---------- | ----------------------- | ------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------- |
| Entry      | Before Phase 3          | Multiple outcomes, cross-cutting concerns, multiple personas, vague scope | Split into epic + features   | Epic spec + N feature specs, linked via `children:` |
| Phase 3    | After scenarios drafted | >15 scenarios, 3+ distinct clusters, different personas                   | Split by user journey        | Separate feature specs per journey/persona          |
| Phase 5    | After task breakdown    | >20 tasks, 5+ major components                                            | Split by component/layer     | Separate implementation slices in test-definitions  |
| Phase 6    | Before TDD cycle        | >10 tests per slice                                                       | Break into smaller slices    | Separate test-definition sections                   |
| TDD Loop   | During RED/GREEN cycle  | >5 unit/integration tests for single E2E                                  | Break E2E into smaller steps | Intermediate E2E tests, separate commits            |

**Checkpoint Restart Points:**

| Checkpoint | What's Split             | Restart From | Why                                     |
| ---------- | ------------------------ | ------------ | --------------------------------------- |
| Entry      | Epic → features          | Phase 0      | New features need their own discovery   |
| Phase 3    | Feature → journeys       | Phase 4      | Scenarios exist, validate regrouped set |
| Phase 5    | Feature → components     | Phase 6      | Decomposition done, start implementing  |
| Phase 6    | Slice → smaller slices   | Phase 6      | Stay in implementation                  |
| TDD Loop   | E2E → intermediate steps | Phase 6      | Stay in TDD loop                        |

**Out of Scope:**

- Changes to existing phase implementations (0-7)
- Gherkin adoption (post-v1)
- Automatic split without user approval

## Acceptance Criteria (from Story 10)

- [x] Entry checkpoint: Detects epic-level requests → creates epic + feature specs
- [x] Phase 3 checkpoint: Flags >15 scenarios or 3+ clusters → splits by journey
- [x] Phase 5 checkpoint: Flags >20 tasks or 5+ components → splits by component
- [x] Phase 6 checkpoint: Flags >10 tests per slice → breaks into smaller slices
- [x] TDD Loop checkpoint: Flags >5 unit/integration tests per E2E → breaks E2E into steps
- [x] Agent proposes split with rationale and shows what artifacts will be created
- [x] User can accept or override ("proceed anyway")
- [x] If accepted: Creates appropriate artifacts per checkpoint level
- [x] Post-split: Tickets created for each child feature with `parent:`/`children:` links
- [x] Post-split: Each child restarts at checkpoint-appropriate phase (see table)

## Discovery Questions

- How does the BDD skill detect epic vs feature at Entry checkpoint?
  → **Resolved:** Examples-first + CoT reasoning, human fallback when unclear
- What's the UX for presenting split suggestions?
  → **Resolved:** Summary first, details on request
- How do we handle splits mid-session vs new session?
  → **Resolved:** Promote existing ticket to epic, create children
- Should splits be reversible (merge children back)?
  → **Out of scope** for v1

## Task Breakdown

| #   | Task                                         | Files              | Scenarios  |
| --- | -------------------------------------------- | ------------------ | ---------- |
| 1   | Add Entry checkpoint examples + CoT template | SKILL.md           | 1-5, 21-23 |
| 2   | Add existing ticket promotion protocol       | SKILL.md           | 6-7, 24    |
| 3   | Add Phase 6 checkpoint (>10 tests/slice)     | SKILL.md           | 15-16      |
| 4   | Add TDD Loop checkpoint (>5 unit tests/E2E)  | SKILL.md           | 17-18      |
| 5   | Add split UX (summary + details)             | SKILL.md           | 19-20      |
| 6   | Add user override handling                   | SKILL.md           | 8, 25      |
| 7   | Sync to Cursor rule                          | .mdc file          | All        |
| 8   | Sync to local copies                         | .claude/, .cursor/ | All        |

## Work Log

---

- 2026-01-07T21:00:00Z Complete: All 25 scenarios implemented in BDD skill, synced to Cursor rule and local copies
- 2026-01-07T20:50:00Z Phase 6: Implemented tasks 1-8 (Entry/Phase 6/TDD checkpoints, UX, overrides, sync)
- 2026-01-07T20:35:00Z Phase 5: Task breakdown complete (8 tasks targeting SKILL.md)
- 2026-01-07T19:55:00Z Phase 4: All 25 scenarios validated (atomic, observable, deterministic)
- 2026-01-07T19:20:00Z Phase 3: Drafted 25 scenarios across 5 checkpoints
- 2026-01-07T19:15:00Z Discovery: Decided examples-first + CoT for Entry detection, promote-not-replace for existing tickets
- 2026-01-07T20:00:00Z Created: Ticket for Iteration 7 (Story 10 - Decomposition)
