# Test Definitions — Ticket 153: Boundary Resilience (Epic-Anchor Hook + Replan-on-Resume)

## Rule 1 — Epic anchor injects on `UserPromptSubmit` when sub-ticket has `epic:` field

### Scenario 1.1: Sub-ticket with valid `epic:` → epic's `## Contracts` injected

- [ ] **Given** a sub-ticket whose frontmatter contains `epic: 999` and an epic ticket at `.safeword-project/tickets/999-*/ticket.md` whose body contains a `## Contracts` section with body text under 10000 chars
      **When** the `UserPromptSubmit` hook fires for that sub-ticket
      **Then** the hook's `hookSpecificOutput.additionalContext` contains the exact section text from the epic

      RED / GREEN / REFACTOR

### Scenario 1.2: Sub-ticket without `epic:` field → no epic injection

- [ ] **Given** a sub-ticket whose frontmatter has no `epic:` key
      **When** the `UserPromptSubmit` hook fires
      **Then** the hook's `additionalContext` contains no epic-anchor block (existing behavior preserved)

      RED / GREEN / REFACTOR

---

## Rule 2 — Epic anchor re-injects on `SessionStart:compact`

### Scenario 2.1: After compaction with sub-ticket active → next-turn injection includes epic contracts from disk

- [ ] **Given** a session where the active ticket has `epic: 999` and `/compact` has just fired
      **When** the `SessionStart` hook runs with matcher `compact`
      **Then** the hook's output contains the epic's `## Contracts` section, freshly read from disk (not from any cache)

      RED / GREEN / REFACTOR

---

## Rule 3 — Epic file resolution and graceful failure modes

### Scenario 3.1: `epic:` points to existing file → file located and read

- [ ] **Given** a sub-ticket with `epic: 999` and an epic ticket folder at `.safeword-project/tickets/999-<any-slug>/ticket.md`
      **When** the epic anchor hook resolves the epic file
      **Then** it locates the file by id-prefix match (glob `.safeword-project/tickets/999-*/ticket.md`) regardless of the slug suffix

      RED / GREEN / REFACTOR

### Scenario 3.2: `epic:` points to non-existent epic → no injection

- [ ] **Given** a sub-ticket with `epic: 999` but no folder matching `.safeword-project/tickets/999-*/`
      **When** the `UserPromptSubmit` hook fires
      **Then** `additionalContext` contains no epic-anchor block

      RED / GREEN / REFACTOR

### Scenario 3.3: `epic:` points to non-existent epic → stderr warning emitted

- [ ] **Given** the same setup as 3.2
      **When** the `UserPromptSubmit` hook fires
      **Then** the hook process emits a single-line warning to stderr identifying the missing epic id

      RED / GREEN / REFACTOR

### Scenario 3.4: Malformed `epic:` value → no injection, no crash

- [ ] **Given** a sub-ticket with `epic:` set to a non-numeric, non-stringy value (e.g., `epic: [1, 2]` or `epic: null`)
      **When** the `UserPromptSubmit` hook fires
      **Then** the hook exits 0, emits no epic-anchor injection, and does not crash

      RED / GREEN / REFACTOR

---

## Rule 4 — Section parsing, size cap, and stub fallback

### Scenario 4.1: `## Contracts` section ≤ 10000 chars → injected verbatim

- [ ] **Given** an epic whose `## Contracts` section text (heading + body, up to but not including the next `##`) is exactly 9000 characters
      **When** the hook injects
      **Then** the injected `additionalContext` contains that section text verbatim

      RED / GREEN / REFACTOR

### Scenario 4.2: Boundary — section exactly 10000 chars → injected verbatim

- [ ] **Given** an epic whose `## Contracts` section text is exactly 10000 characters
      **When** the hook injects
      **Then** the injected `additionalContext` contains that section text verbatim (cap is inclusive on `≤ 10000`)

      RED / GREEN / REFACTOR

### Scenario 4.3: Section > 10000 chars → static stub injected

- [ ] **Given** an epic whose `## Contracts` section text is 10001 characters
      **When** the hook injects
      **Then** the injected `additionalContext` contains the literal string `[epic <id>] ## Contracts section exceeds injection budget; see <epic-path>` (with `<id>` and `<epic-path>` substituted) and nothing else from the section

      RED / GREEN / REFACTOR

### Scenario 4.4: Oversized section → full section text absent from payload

- [ ] **Given** the setup from 4.3
      **When** the hook injects
      **Then** none of the section body characters past the stub appear in `additionalContext` (regression guard against silent truncation)

      RED / GREEN / REFACTOR

### Scenario 4.5: Heading match is strict literal `## Contracts`

- [ ] **Given** an epic whose body contains a heading line that is exactly `## Contracts` (level-2, exact case, no suffix)
      **When** the section parser runs
      **Then** the parser identifies that heading as the section start

      RED / GREEN / REFACTOR

### Scenario 4.6: Heading variants do not match → no injection

- [ ] **Given** an epic whose `Contracts` heading appears in any of these forms only: `### Contracts`, `## contracts`, `## Contracts (v2)`, `## Contracts` (trailing space)
      **When** the section parser runs
      **Then** no section is identified, and `additionalContext` contains no epic-anchor block

      RED / GREEN / REFACTOR

### Scenario 4.7: Empty section body → no injection

- [ ] **Given** an epic whose body contains a literal `## Contracts` heading but the section body is blank (no text until the next `##` or end-of-file)
      **When** the hook fires
      **Then** `additionalContext` contains no epic-anchor block (empty section is equivalent to absent section)

      RED / GREEN / REFACTOR

### Scenario 4.8: No `## Contracts` heading at all → no injection

- [ ] **Given** an epic whose body contains no `## Contracts` heading
      **When** the hook fires
      **Then** `additionalContext` contains no epic-anchor block

      RED / GREEN / REFACTOR

---

## Rule 5 — Disk-resident truth: epic re-read on every injection

### Scenario 5.1: Epic file edited between turns → next injection reflects new content

- [ ] **Given** a session where turn N already injected the epic's `## Contracts` section, and between turn N and turn N+1 the epic file is edited (e.g., new contract line added)
      **When** the `UserPromptSubmit` hook fires for turn N+1
      **Then** `additionalContext` reflects the post-edit content (no caching layer between disk and injection)

      RED / GREEN / REFACTOR

---

## Rule 6 — Replan-on-resume trigger gating

### Scenario 6.1: Non-epic sub-ticket + ≥1 commit since `last_modified` → replan fires

- [ ] **Given** `quality-state.json:activeTicket` transitions to a ticket whose `type` is `task` / `feature` / `patch` (not `epic`), and `git log <ticket.last_modified>..HEAD --oneline | wc -l` returns ≥ 1
      **When** the `UserPromptSubmit` hook runs for that turn
      **Then** the hook injects an instruction making the model's first action a replan investigation

      RED / GREEN / REFACTOR

### Scenario 6.2: Non-epic ticket + 0 commits since `last_modified` → no replan

- [ ] **Given** `activeTicket` transitions to a non-epic ticket, and `git log <last_modified>..HEAD --oneline | wc -l` returns 0
      **When** the hook runs
      **Then** no replan-investigation instruction is injected

      RED / GREEN / REFACTOR

### Scenario 6.3: Epic ticket as activeTicket → never fires (filtered upstream)

- [ ] **Given** a ticket file whose frontmatter has `type: epic`
      **When** `getActiveTicket()` from [active-ticket.ts](.safeword/hooks/lib/active-ticket.ts) is called
      **Then** the epic ticket is excluded from the result (existing behavior preserved at line 152)
      **And** consequently the replan trigger never observes an epic as `activeTicket`

      RED / GREEN / REFACTOR

---

## Rule 7 — Replan runs in an isolated sub-agent with safe failure modes

### Scenario 7.1: Replan triggers → wrapper invokes Agent tool with `isolation: 'worktree'`

- [ ] **Given** the hook-injected replan instruction prompts the model to call the replan wrapper function
      **When** the wrapper is invoked
      **Then** it issues an Agent tool call whose options object includes `isolation: 'worktree'` (asserted at the wrapper layer, where options are inspectable, rather than at Claude Code internals)

      RED / GREEN / REFACTOR

### Scenario 7.2: Sub-agent returns condensed report → report appears in chat

- [ ] **Given** the replan sub-agent completes and returns a string report
      **When** the parent receives the return value
      **Then** the report text appears verbatim in the parent's chat output for that turn

      RED / GREEN / REFACTOR

### Scenario 7.3: Sub-agent fails or times out → parent proceeds, stderr log emitted

- [ ] **Given** the replan sub-agent throws an error or exceeds its timeout budget
      **When** the parent receives the failure
      **Then** the parent does not crash, the model continues with the ticket's work, and a single-line stderr log identifies the failure cause

      RED / GREEN / REFACTOR

### Scenario 7.4: Sub-agent failure → `last_modified` still updates

- [ ] **Given** the setup from 7.3
      **When** the parent records the replan completion
      **Then** the ticket's `last_modified` is updated to the current time (prevents indefinite re-debate loops on persistent failure)

      RED / GREEN / REFACTOR

---

## Rule 8 — Replan output safety: ticket files unchanged without explicit approval

### Scenario 8.1: Replan completes + user takes no action → ticket frontmatter/body unchanged

- [ ] **Given** the replan report appears in chat and the user types no further input that approves any proposed change
      **When** the turn ends
      **Then** the ticket file's frontmatter and body (excluding `last_modified` per Rule 9) are byte-identical to their pre-replan state

      RED / GREEN / REFACTOR

### Scenario 8.2: Replan completes + user explicitly accepts proposal → changes applied

- [ ] **Given** the replan report appears and the user replies with an explicit acceptance (e.g., "yes, apply that scope change")
      **When** the model processes the acceptance
      **Then** the ticket frontmatter/body is updated to reflect the accepted proposal, and the change is logged in the ticket's Work Log

      RED / GREEN / REFACTOR

---

## Rule 9 — `last_modified` updates once at replan-complete

### Scenario 9.1: User approves changes → `last_modified` set to current time

- [ ] **Given** a replan completes and the user accepts the proposal
      **When** the replan-complete handler runs
      **Then** the ticket's `last_modified` is set to the current ISO-8601 UTC timestamp

      RED / GREEN / REFACTOR

### Scenario 9.2: User rejects → `last_modified` still set to current time

- [ ] **Given** a replan completes and the user explicitly rejects all proposals
      **When** the replan-complete handler runs
      **Then** the ticket's `last_modified` is still set to the current timestamp (so subsequent resumes don't re-debate the same commits)

      RED / GREEN / REFACTOR

---

## Rule 10 — Cascade hint conditioning

### Scenario 10.1: Replan concludes "still good" → no cascade hint

- [ ] **Given** the sub-agent's report conclusion is `still-good`
      **When** the report is rendered to chat
      **Then** the report contains no "may also affect" line

      RED / GREEN / REFACTOR

### Scenario 10.2: Invalidation + siblings exist → cascade hint lists likely-affected siblings

- [ ] **Given** the sub-agent's report concludes invalidation (any of: `change-scope`, `cancel`, `split`, `merge`) AND the active ticket has `epic: <id>` AND the epic has at least one other sub-ticket whose `status` is not `done`
      **When** the report is rendered
      **Then** the report ends with exactly one line in the form `may also affect: ticket-X, ticket-Y` listing those sibling ticket ids

      RED / GREEN / REFACTOR

### Scenario 10.3: Invalidation + no siblings → no cascade hint

- [ ] **Given** invalidation found but the active ticket has no `epic:` field OR the epic has no other open sub-tickets
      **When** the report is rendered
      **Then** the report contains no "may also affect" line

      RED / GREEN / REFACTOR

---

## Rule 11 — Verify-skill soft-prompt for cross-ticket contract promotion

### Scenario 11.1: `/verify` on sub-ticket with `epic:` field → soft-prompt appears

- [ ] **Given** `/verify` is invoked on a sub-ticket whose frontmatter contains `epic: <id>`
      **When** the verify checklist renders
      **Then** the output includes a non-blocking item asking whether this sub-ticket finalized interface decisions that future siblings must honor, with guidance to append to `<epic-path>` `## Contracts` if so

      RED / GREEN / REFACTOR

### Scenario 11.2: `/verify` on ticket without `epic:` field → soft-prompt absent

- [ ] **Given** `/verify` is invoked on a ticket whose frontmatter has no `epic:` key
      **When** the verify checklist renders
      **Then** the cross-ticket promotion prompt is absent (existing verify behavior preserved)

      RED / GREEN / REFACTOR

### Scenario 11.3: Soft-prompt is non-blocking

- [ ] **Given** the soft-prompt has appeared in a verify run
      **When** the user answers either yes or no (or skips)
      **Then** `/verify` can complete and emit `verify.md` (the prompt does not gate the verify artifact)

      RED / GREEN / REFACTOR

---

## Rule 12 — Regression guard for #14281 (no double-injection)

### Scenario 12.1: Epic-anchor content appears exactly once in hook output per turn

- [ ] **Given** a sub-ticket with `epic: <id>` and one fired `UserPromptSubmit` event
      **When** the hook's stdout / JSON output is captured
      **Then** the epic's `## Contracts` content appears exactly one time in `hookSpecificOutput.additionalContext` (regression guard for the historical [#14281](https://github.com/anthropics/claude-code/issues/14281) double-inject pathology)

      RED / GREEN / REFACTOR

---

## Invariants

These are structural / repo-health guards rather than behavioral scenarios. They run in CI / release gates, not in the standard RED/GREEN/REFACTOR loop.

- **I1 — Pair parity:** After all 153-related commits land, `diff -r packages/cli/templates/hooks/ .safeword/hooks/` returns no differences. Enforced by the existing pair-parity release-gate test.
- **I2 — Test scope:** Scenarios in this file assert against the hook-emitted payload (stdout / JSON) and inspectable filesystem state — not against the model's interpretation of injected content. The model's view is non-deterministic; the hook's emission is our testable surface.
- **I3 — Test runner:** Run scenarios as Vitest unit tests under `packages/cli/tests/` for hook behaviors, and as integration tests for the replan trigger + sub-agent wrapper.
