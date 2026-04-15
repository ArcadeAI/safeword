# Test Definitions: Ticket/Artifact Folder Reorganization

**Ticket:** 008-ticket-folder-reorganization
**Type:** Feature

---

## Suite 1: CLI Schema Changes

### Test 1.1: ownedDirs excludes .safeword/planning paths

**Status:** Not Implemented
**Description:** Verify `.safeword/planning/*` directories are removed from ownedDirs

**Given:** The SAFEWORD_SCHEMA constant
**When:** I inspect the ownedDirs array
**Then:**

- `.safeword/planning` is NOT in ownedDirs
- `.safeword/planning/specs` is NOT in ownedDirs
- `.safeword/planning/test-definitions` is NOT in ownedDirs
- `.safeword/planning/design` is NOT in ownedDirs
- `.safeword/planning/issues` is NOT in ownedDirs
- `.safeword/planning/plans` is NOT in ownedDirs

---

### Test 1.2: preservedDirs excludes old .safeword/tickets paths

**Status:** Not Implemented
**Description:** Verify `.safeword/tickets/*` directories are removed from preservedDirs

**Given:** The SAFEWORD_SCHEMA constant
**When:** I inspect the preservedDirs array
**Then:**

- `.safeword/tickets` is NOT in preservedDirs
- `.safeword/tickets/completed` is NOT in preservedDirs

---

### Test 1.3: preservedDirs includes new .safeword-project paths

**Status:** Not Implemented
**Description:** Verify new ticket structure paths are in preservedDirs

**Given:** The SAFEWORD_SCHEMA constant
**When:** I inspect the preservedDirs array
**Then:**

- `.safeword-project/tickets` is in preservedDirs
- `.safeword-project/tickets/completed` is in preservedDirs
- `.safeword-project/tmp` is in preservedDirs

---

### Test 1.4: deprecatedDirs includes old planning directories

**Status:** Not Implemented
**Description:** Verify old planning directories are marked for cleanup on upgrade

**Given:** The SAFEWORD_SCHEMA constant
**When:** I inspect the deprecatedDirs array
**Then:**

- `.safeword/planning` is in deprecatedDirs
- `.safeword/tickets` is in deprecatedDirs

---

## Suite 2: Template/Guide Path Updates

### Test 2.1: SAFEWORD.md references new ticket paths

**Status:** Not Implemented
**Description:** Verify SAFEWORD.md template uses `.safeword-project/tickets/` paths

**Given:** The SAFEWORD.md template content
**When:** I search for path references
**Then:**

- `.safeword/planning/specs` does NOT appear
- `.safeword/planning/test-definitions` does NOT appear
- `.safeword/planning/issues` does NOT appear
- `.safeword-project/tickets/` appears for ticket references
- `.safeword-project/tmp/` appears for scratch space

---

### Test 2.2: planning-guide.md references new paths

**Status:** Not Implemented
**Description:** Verify planning guide uses ticket folder paths

**Given:** The planning-guide.md template content
**When:** I search for path references
**Then:**

- `.safeword/planning/specs/` does NOT appear
- `.safeword/planning/test-definitions/` does NOT appear
- References use `.safeword-project/tickets/{id}-{slug}/` structure

---

### Test 2.3: ticket-template.md references new paths

**Status:** Not Implemented
**Description:** Verify ticket template points to colocated files

**Given:** The ticket-template.md content
**When:** I read the related files section
**Then:**

- References `./spec.md` (same folder)
- References `./test-definitions.md` (same folder)
- References `./design.md` (same folder, if applicable)

---

### Test 2.4: BDD skill references new artifact paths

**Status:** Not Implemented
**Description:** Verify BDD skill uses `.safeword-project/tickets/` for artifacts

**Given:** The BDD skill SKILL.md content
**When:** I search for artifact path references
**Then:**

- Phase 0-2 ticket path is `.safeword-project/tickets/{id}-{slug}/ticket.md`
- Phase 3 test-definitions path is `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
- `.safeword-project/issues/` does NOT appear
- `.safeword-project/test-definitions/` does NOT appear

---

### Test 2.5: done.md command references new paths

**Status:** Not Implemented
**Description:** Verify /done command uses ticket folder paths

**Given:** The done.md command content
**When:** I search for glob patterns
**Then:**

- Searches `.safeword-project/tickets/*/ticket.md`
- Searches `.safeword-project/tickets/*/test-definitions.md`
- `.safeword-project/issues/` does NOT appear

---

### Test 2.6: stop-quality.ts hook references new paths

**Status:** Not Implemented
**Description:** Verify quality hook uses ticket folder paths

**Given:** The stop-quality.ts hook content
**When:** I search for path references
**Then:**

- References `.safeword-project/tickets/` for ticket detection
- `.safeword-project/issues/` does NOT appear

---

## Suite 3: This Project Migration

### Test 3.1: All issues migrated to ticket folders

**Status:** Not Implemented
**Description:** Verify existing issues become ticket folders

**Given:** The `.safeword-project/` directory after migration
**When:** I list the contents
**Then:**

- `.safeword-project/issues/` directory does NOT exist
- `.safeword-project/tickets/001-stateful-bdd-flow/ticket.md` exists
- `.safeword-project/tickets/002-cross-platform-skill-source/ticket.md` exists
- (etc. for all 12 tickets)

---

### Test 3.2: Test definitions colocated in ticket folders

**Status:** Not Implemented
**Description:** Verify test definitions moved to matching ticket folders

**Given:** The `.safeword-project/` directory after migration
**When:** I list the contents
**Then:**

- `.safeword-project/test-definitions/` directory does NOT exist
- `.safeword-project/tickets/001-stateful-bdd-flow/test-definitions.md` exists (if applicable)
- `.safeword-project/tickets/006-phase-aware-quality/test-definitions.md` exists

---

### Test 3.3: Feature spec colocated in epic ticket folder

**Status:** Not Implemented
**Description:** Verify feature-stateful-bdd-flow.md moves to ticket folder

**Given:** The `.safeword-project/` directory after migration
**When:** I check the specs folder
**Then:**

- `.safeword-project/specs/feature-stateful-bdd-flow.md` does NOT exist
- `.safeword-project/tickets/001-stateful-bdd-flow/spec.md` exists

---

### Test 3.4: Stale planning content deleted

**Status:** Not Implemented
**Description:** Verify old planning artifacts are removed

**Given:** The `.safeword/` directory after migration
**When:** I check for planning directory
**Then:**

- `.safeword/planning/` directory does NOT exist
- `.safeword/tickets/` directory does NOT exist

---

### Test 3.5: Linting reviews deleted

**Status:** Not Implemented
**Description:** Verify linting review files are removed

**Given:** The filesystem after migration
**When:** I search for linting review files
**Then:**

- No files matching `.safeword/planning/linting/*.md` exist
- No files matching `.safeword-project/tmp/linting/*.md` exist

---

### Test 3.6: Roadmap preserved in backlog

**Status:** Not Implemented
**Description:** Verify roadmap file moves to backlog

**Given:** The `.safeword-project/` directory after migration
**When:** I check the backlog folder
**Then:**

- `.safeword-project/backlog/roadmap-2025-12.md` exists
- `.safeword/planning/specs/roadmap-2025-12.md` does NOT exist

---

## Suite 4: CLI Behavior Verification

### Test 4.1: safeword setup creates correct directories

**Status:** Not Implemented
**Description:** Verify setup creates new folder structure

**Given:** A fresh project without safeword
**When:** I run `safeword setup`
**Then:**

- `.safeword-project/tickets/` is created
- `.safeword-project/tickets/completed/` is created
- `.safeword-project/tmp/` is created
- `.safeword/planning/` is NOT created

---

### Test 4.2: safeword reset preserves ticket folders

**Status:** Not Implemented
**Description:** Verify reset doesn't delete user tickets

**Given:** A project with tickets in `.safeword-project/tickets/`
**When:** I run `safeword reset`
**Then:**

- `.safeword-project/tickets/` still exists with all tickets
- `.safeword-project/tmp/` still exists

---

### Test 4.3: safeword upgrade migrates old structure

**Status:** Not Implemented
**Description:** Verify upgrade handles legacy planning directories

**Given:** A project with old `.safeword/planning/` structure
**When:** I run `safeword upgrade`
**Then:**

- `.safeword/planning/` is deleted (via deprecatedDirs)
- `.safeword/tickets/` is deleted (via deprecatedDirs)
- Warning shown about manual migration if planning/ had content

---

---

## Coverage Summary

**Total:** 17 tests
**Passing:** 0 tests (0%)
**Not Implemented:** 17 tests (100%)

### By Suite:

- Suite 1 (Schema Changes): 4 tests
- Suite 2 (Template/Guide Updates): 6 tests
- Suite 3 (Project Migration): 6 tests
- Suite 4 (CLI Behavior): 3 tests (integration)
