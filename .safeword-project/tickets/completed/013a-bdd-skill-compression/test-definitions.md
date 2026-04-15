# Test Definitions: 013a BDD Skill Compression

## Suite 1: SAFEWORD.md Cleanup

### [x] Scenario 1.1: Feature Development section removed

**Given** the template SAFEWORD.md at `packages/cli/templates/SAFEWORD.md`
**When** I search for "## Feature Development"
**Then** no matches are found
**And** the file is under 360 lines (was ~380, removing ~26)

### [x] Scenario 1.2: Resumption pre-check added

**Given** the Work Level Detection section in SAFEWORD.md
**When** I read the first lines of that section
**Then** I see a resumption check that routes to ticket's `type:` field
**And** it handles "resume", "continue", or ticket ID references

### [x] Scenario 1.3: Announcements use explicit skill invocation

**Given** the Work Level Detection announcements in SAFEWORD.md
**When** I read the feature announcement line
**Then** it says "Run `/bdd`" (not prose description of BDD phases)

### [x] Scenario 1.4: Installed copy updated

**Given** both `.safeword/SAFEWORD.md` and `packages/cli/templates/SAFEWORD.md`
**When** I compare the relevant sections
**Then** both have identical changes (Feature Development removed, pre-check added, announcements updated)

---

## Suite 2: BDD Skill Description

### [x] Scenario 2.1: Description includes resume triggers

**Given** the BDD skill at `packages/cli/templates/skills/safeword-bdd-orchestrating/SKILL.md`
**When** I read the description field
**Then** it includes 'resume', 'continue', and 'ticket' as trigger words

---

## Suite 3: Claude Code Phase Files

### [x] Scenario 3.1: SKILL.md is dispatcher only

**Given** the main SKILL.md in `packages/cli/templates/skills/safeword-bdd-orchestrating/`
**When** I count the lines
**Then** it is under 200 lines (107 lines)
**And** it references phase files for detailed content

### [x] Scenario 3.2: Phase files exist and are under 100 lines

**Given** the BDD skill directory
**When** I check for phase files
**Then** these files exist:

- DISCOVERY.md (47 lines)
- SCENARIOS.md (44 lines)
- DECOMPOSITION.md (34 lines)
- TDD.md (64 lines)
- DONE.md (44 lines)
- SPLITTING.md (56 lines)
  **And** each file is under 100 lines

### [x] Scenario 3.3: Phase 6.3 delegates to /refactor

**Given** the TDD.md phase file
**When** I search for REFACTOR content
**Then** it says to run `/refactor` for cleanup
**And** there is no inline refactoring protocol (smells table, revert instructions)

---

## Suite 4: Cursor Rules

### [x] Scenario 4.1: Old monolithic rule deleted

**Given** the Cursor rules directory at `packages/cli/templates/cursor/rules/`
**When** I check for `safeword-bdd-orchestrating.mdc`
**Then** the file does not exist

### [x] Scenario 4.2: Split rules exist and are under 100 lines

**Given** the Cursor rules directory
**When** I check for BDD rules
**Then** these files exist:

- bdd-core.mdc (52 lines)
- bdd-discovery.mdc (40 lines)
- bdd-scenarios.mdc (42 lines)
- bdd-decomposition.mdc (39 lines)
- bdd-tdd.mdc (50 lines)
- bdd-done.mdc (44 lines)
- bdd-splitting.mdc (51 lines)
  **And** each file is under 100 lines

### [x] Scenario 4.3: Rules have USE WHEN descriptions

**Given** each Cursor BDD rule file
**When** I read the description field
**Then** it starts with "USE WHEN" followed by activation conditions

---

## Suite 5: Schema & Parity

### [x] Scenario 5.1: Schema registers all new files

**Given** the schema at `packages/cli/src/schema.ts`
**When** I check for BDD file registrations
**Then** all 6 Claude Code phase files are registered
**And** all 7 Cursor rule files are registered

### [x] Scenario 5.2: Given/When/Then removed from planning-guide

**Given** the planning guide at `packages/cli/templates/guides/planning-guide.md`
**When** I search for Given-When-Then format examples
**Then** the detailed format section is removed (delegated to BDD skill)
**But** basic mention of the format for test definitions remains

### [x] Scenario 5.3: Content parity between platforms

**Given** corresponding Claude Code and Cursor files
**When** I compare their behavioral content
**Then** they contain equivalent instructions (format may differ)

---

## Summary

**Total Scenarios:** 13
**Status:** 13/13 complete
