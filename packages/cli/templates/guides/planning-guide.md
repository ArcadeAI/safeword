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

## Test Definitions

Use the test-definitions template: `.safeword/templates/test-definitions-feature.md`

For test writing patterns (naming, assertions, structure), see the testing guide: `.safeword/guides/testing-guide.md`
