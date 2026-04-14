# Planning Guide

How to write specs, user stories, and test definitions before implementation.

---

## Artifact Levels

**Triage first - answer IN ORDER, stop at first match:**

| Question                                 | Level       | Artifacts                                            |
| ---------------------------------------- | ----------- | ---------------------------------------------------- |
| User-facing feature with business value? | **feature** | Feature Spec + Test Definitions (+ Design Doc if 3+) |
| Bug, improvement, internal, or refactor? | **task**    | Task Spec with inline tests                          |
| Typo, config, or trivial change?         | **patch**   | Minimal Task Spec, existing tests                    |

**Location:** `.safeword-project/tickets/{id}-{slug}/`

All artifacts colocate in the ticket folder:

- `ticket.md` - Ticket definition
- `test-definitions.md` - BDD scenarios
- `spec.md` - Feature spec (epics only)
- `design.md` - Design doc (complex features)

**If none fit:** Break down the work. A single task spanning all three levels should be split into separate feature + tasks.

---

## Templates

| Need                            | Template                                          |
| ------------------------------- | ------------------------------------------------- |
| feature spec                    | `.safeword/templates/feature-spec-template.md`    |
| task/patch spec                 | `.safeword/templates/task-spec-template.md`       |
| feature Test definitions        | `.safeword/templates/test-definitions-feature.md` |
| Complex feature design          | `.safeword/templates/design-doc-template.md`      |
| Architectural decision          | `.safeword/templates/architecture-template.md`    |
| Context anchor for complex work | `.safeword/templates/ticket-template.md`          |
| Execution scratch pad           | `.safeword/templates/work-log-template.md`        |

---

## Part 1: User Stories

### When to Use Each Format

| Format                         | Best For                                    | Example Trigger              |
| ------------------------------ | ------------------------------------------- | ---------------------------- |
| Standard (As a/I want/So that) | User-facing features, UI flows              | "User can do X"              |
| Given-When-Then                | API behavior, state transitions, edge cases | "When X happens, then Y"     |
| Job Story                      | Problem-solving, user motivation unclear    | "User needs to accomplish X" |

**Decision rule:** Default to Standard. Use Given-When-Then for APIs or complex state. Use Job Story when focusing on the problem, not the solution.

**Edge cases:**

- API with UI? → Standard for UI, Given-When-Then for API contract tests
- Unclear user role? → Job Story to focus on the problem first, convert to Standard later
- Technical task (refactor, upgrade)? → Skip story format, use Technical Task template

### Standard Format (Recommended)

```text
As a [role/persona]
I want [capability/feature]
So that [business value/benefit]

Acceptance Criteria:
- [Specific, testable condition 1]
- [Specific, testable condition 2]
- [Specific, testable condition 3]

Out of Scope:
- [What this story explicitly does NOT include]
```

### Given-When-Then Format (Behavior-Focused)

For feature-level work, run `/bdd` — the BDD skill guides you through drafting scenarios with proper Given/When/Then structure in Phase 3.

### Job Story Format (Outcome-Focused)

```text
When [situation/context]
I want to [motivation/job-to-be-done]
So I can [expected outcome]
```

**Example:**

```text
When I'm debugging a failing test
I want to see the exact LLM prompt and response
So I can identify whether the issue is prompt engineering or code logic
```

---

## INVEST Validation

Before saving any story, verify it passes all six criteria:

- [ ] **Independent** - Can be completed without depending on other stories
- [ ] **Negotiable** - Details emerge through conversation, not a fixed contract
- [ ] **Valuable** - Delivers clear value to user or business
- [ ] **Estimable** - Team can estimate effort (not too vague, not too detailed)
- [ ] **Small** - Completable in one sprint/iteration (typically 1-5 days)
- [ ] **Testable** - Clear acceptance criteria define when it's done

**If a story fails any criteria, it's not ready - refine or split it.**

---

## Writing Good Acceptance Criteria

**✅ GOOD - Specific, user-facing, testable:**

- User can switch campaigns without page reload
- Response time is under 200ms
- Current campaign is visually highlighted
- Error message explains what went wrong

**❌ BAD - Vague, technical, or implementation:**

- Campaign switching works ← Too vague
- Use Zustand for state ← Implementation detail
- Database is fast ← Not user-facing
- Code is clean ← Not testable

---

## Size Guidelines

| Indicator           | Too Big | Just Right | Too Small |
| ------------------- | ------- | ---------- | --------- |
| Acceptance Criteria | 6+      | 1-5        | 0         |
| Personas/Screens    | 3+      | 1-2        | N/A       |
| Duration            | 6+ days | 1-5 days   | <1 hour   |
| **Action**          | Split   | ✅ Ship    | Combine   |

**Decision rule:** When borderline, err on the side of splitting. Smaller stories are easier to estimate and complete.

---

## Technical Constraints Section

**Purpose:** Capture non-functional requirements that inform test definitions.

**When to use:** Fill in constraints BEFORE writing test definitions. Delete sections that don't apply.

| Category       | What It Captures                 | Examples                                        |
| -------------- | -------------------------------- | ----------------------------------------------- |
| Performance    | Speed, throughput, capacity      | Response time < 200ms, 1000 concurrent users    |
| Security       | Auth, validation, rate limiting  | Sanitized inputs, session required, 100 req/min |
| Compatibility  | Browsers, devices, accessibility | Chrome 100+, iOS 14+, WCAG 2.1 AA               |
| Data           | Privacy, retention, compliance   | GDPR delete in 72h, 90-day log retention        |
| Dependencies   | Existing systems, restrictions   | Use AuthService, no new packages                |
| Infrastructure | Resources, offline, deployment   | < 512MB memory, offline-capable                 |

**Include a constraint if:**

- It affects how you write tests
- It limits implementation choices
- Violating it would fail an audit or break SLAs

---

## User Story Examples

### ✅ GOOD Story

```text
As a player with multiple campaigns
I want to switch between campaigns from the sidebar
So that I can quickly resume different games

Acceptance Criteria:
- [ ] Sidebar shows all campaigns with last-played date
- [ ] Clicking campaign loads it within 200ms
- [ ] Current campaign is highlighted

Out of Scope:
- Campaign merging/deletion (separate story)
```

### ❌ BAD Story (Too Big)

```text
As a user
I want a complete campaign management system
So that I can organize my games

Acceptance Criteria:
- [ ] Create, edit, delete campaigns
- [ ] Share campaigns with other players
- [ ] Export/import campaign data
- [ ] Search and filter campaigns
- [ ] Tag campaigns by theme
```

**Problem:** This is 5+ separate stories. Split it.

### ❌ BAD Story (No Value)

```text
As a developer
I want to refactor the GameStore
So that code is cleaner
```

**Problem:** Developer is not a user. "Cleaner code" is not user-facing value.

### ✅ BETTER (Technical Task)

```text
Technical Task: Refactor GameStore to use Immer

Why: Prevent state mutation bugs (3 bugs in last sprint)
Effort: 2-3 hours
Test: All existing tests pass, no new mutations
```

---

## Part 2: Test Definitions

### How to Fill Out Test Definitions

1. Read `.safeword/templates/test-definitions-feature.md`
2. Read user story's Technical Constraints section (if exists)
3. Fill in feature name, issue number, test file path
4. Organize tests into logical suites
5. Create numbered tests (Test 1.1, Test 1.2, etc.)
6. Add status for each test
7. Include detailed steps and expected outcomes
8. Add summary with coverage breakdown
9. Save to `.safeword-project/tickets/{id}-{slug}/test-definitions.md`

---

## Test Status Indicators

Use these consistently:

- **✅ Passing** - Test is implemented and passing
- **⏭️ Skipped** - Test is intentionally skipped (add rationale)
- **❌ Not Implemented** - Test is defined but not yet written
- **🔴 Failing** - Test exists but is currently failing

---

## Test Definition Naming

**✅ GOOD - Descriptive and specific:**

- "Render all three panes"
- "Cmd+J toggles AI pane visibility"
- "State persistence across sessions"

**❌ BAD - Vague or technical:**

- "Test 1" (no description)
- "Check state" (too vague)
- "Verify useUIStore hook" (implementation detail)

---

## Writing Test Steps

**✅ GOOD - Clear, actionable steps:**

```text
**Steps**:
1. Toggle AI pane visible
2. Get bounding box for AI pane
3. Get bounding box for Editor pane
4. Compare X coordinates
```

**❌ BAD - Vague or incomplete:**

```text
**Steps**:
1. Check panes
2. Verify order
```

---

## Writing Expected Outcomes

**✅ GOOD - Specific, testable assertions:**

```text
**Expected**:
- AI pane X coordinate < Editor pane X coordinate
- Explorer pane X coordinate > Editor pane X coordinate
- All coordinates are positive numbers
```

**❌ BAD - Vague expectations:**

```text
**Expected**:
- Panes are in correct order
- Everything works
```

---

## Organizing Test Suites

Group related tests:

- **Layout/Structure** - DOM structure, element presence, positioning
- **User Interactions** - Clicks, keyboard shortcuts, drag/drop
- **State Management** - State changes, persistence, reactivity
- **Accessibility** - ARIA labels, keyboard navigation, focus
- **Edge Cases** - Error handling, boundary conditions
- **Technical Constraints** - Non-functional requirements from user story

---

## Coverage Summary

**Always include:**

- Total test count
- Breakdown by status (passing, skipped, not implemented, failing)
- Percentages for each category
- Rationale for skipped tests

**Example:**

```text
**Total**: 20 tests
**Passing**: 9 tests (45%)
**Skipped**: 4 tests (20%)
**Not Implemented**: 7 tests (35%)
**Failing**: 0 tests
```

---

## Testing Technical Constraints

User stories include Technical Constraints. These MUST have corresponding tests.

| Constraint Category | Test Type                  | What to Verify                                |
| ------------------- | -------------------------- | --------------------------------------------- |
| Performance         | Load/timing tests          | Response times, throughput, capacity          |
| Security            | Security tests             | Input sanitization, auth, rate limiting       |
| Compatibility       | Cross-browser/device tests | Browser versions, mobile, accessibility       |
| Data                | Compliance tests           | Retention, deletion, privacy rules            |
| Dependencies        | Integration tests          | Required services work, no forbidden packages |
| Infrastructure      | Resource tests             | Memory limits, offline behavior               |

---

## Test Definition Example

```markdown
### Test 3.1: Cmd+J toggles AI pane visibility ✅

**Status**: ✅ Passing
**Description**: Verifies Cmd+J keyboard shortcut toggles AI pane

**Steps**:

1. Verify AI pane hidden initially (default state)
2. Press Cmd+J (Mac) or Ctrl+J (Windows/Linux)
3. Verify AI pane becomes visible
4. Press Cmd+J again
5. Verify AI pane becomes hidden

**Expected**:

- AI pane starts hidden
- After first toggle: AI pane visible
- After second toggle: AI pane hidden
```

---

## Ticket Folder Naming

**Structure:** `.safeword-project/tickets/{id}-{slug}/`

**Good folder names:**

- `001-campaign-switching/`
- `012-fix-login-timeout/`

**Bad folder names:**

- `story-1/` ← Not descriptive
- `CAMPAIGN_FINAL_v2/` ← Bloated

---

## Quick Reference

**User Story Red Flags (INVEST Violations):**

- No acceptance criteria → Too vague
- > 5 acceptance criteria → Split into multiple stories
- Technical implementation details → Wrong audience
- Missing "So that" → No clear value

**Test Definition Red Flags:**

- Test name doesn't describe behavior → Rename
- Steps are vague → Add detail
- No expected outcomes → Add assertions
- No coverage summary → Add totals
