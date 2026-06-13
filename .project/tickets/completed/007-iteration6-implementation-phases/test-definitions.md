# Test Definitions: Iteration 6 - Implementation Phases

**Ticket:** [007-iteration6-implementation-phases](../issues/007-iteration6-implementation-phases.md)

## Scenarios

### /audit - Code Quality (existing behavior, verify still works)

- [ ] **Scenario 1:** Runs architecture checks
  - Given a project with dependency-cruiser config
  - When running /audit
  - Then output includes circular deps and layer violation checks

- [ ] **Scenario 2:** Runs dead code detection
  - Given a project with package.json
  - When running /audit
  - Then knip runs and reports unused exports

- [ ] **Scenario 3:** Runs duplication detection
  - Given a project with source files
  - When running /audit
  - Then jscpd runs and reports clone percentage

- [ ] **Scenario 4:** Runs outdated package checks
  - Given a project with package.json
  - When running /audit
  - Then outdated packages are listed

### /audit - Report Format (new)

- [ ] **Scenario 4a:** Report shows errors with codes
  - Given audit finds dead refs and drift issues
  - When running /audit
  - Then output shows "### Errors (must fix)" section with [E001], [E002] prefixed items

- [ ] **Scenario 4b:** Report shows warnings with codes
  - Given audit finds size and staleness issues
  - When running /audit
  - Then output shows "### Warnings (should review)" section with [W001], [W002] prefixed items

- [ ] **Scenario 4c:** Report shows summary with counts
  - Given audit completes
  - When viewing output
  - Then output ends with "Errors: N | Warnings: N | Passed: N"

- [ ] **Scenario 4d:** Audit fails when errors present
  - Given audit finds errors (dead refs or drift)
  - When audit completes
  - Then report states "Audit failed" in summary

- [ ] **Scenario 4e:** Audit passes with warnings
  - Given audit finds only warnings (no errors)
  - When audit completes
  - Then report states "Audit passed with warnings"

- [ ] **Scenario 4f:** Audit passes clean
  - Given audit finds no issues
  - When audit completes
  - Then report states "Audit passed"

### /audit - Agent Config Checks (new)

- [ ] **Scenario 5:** Discovers all agent configs recursively (excludes .safeword/)
  - Given project has:
    - /CLAUDE.md
    - /AGENTS.md
    - /packages/cli/CLAUDE.md
    - /.safeword/CLAUDE.md (should be ignored)
  - When running /audit
  - Then audit checks 3 config files (excludes .safeword/)

- [ ] **Scenario 6:** Reports agent config over size limits
  - Given CLAUDE.md has 250+ instructions
  - When running /audit
  - Then output reports "CLAUDE.md exceeds recommended 150-200 instructions"

- [ ] **Scenario 7:** Reports dead file references in agent configs
  - Given /packages/cli/CLAUDE.md references "src/removed.ts"
  - And src/removed.ts doesn't exist
  - When running /audit
  - Then output reports "references missing: src/removed.ts"

- [ ] **Scenario 8:** Ignores external URLs in agent configs
  - Given CLAUDE.md references "https://example.com/docs"
  - When running /audit
  - Then no "missing reference" error for URLs

- [ ] **Scenario 9:** Reports stale agent configs (with git history)
  - Given AGENTS.md last modified 30+ days ago
  - And commits exist since then
  - When running /audit
  - Then output reports "AGENTS.md may be stale"

- [ ] **Scenario 10:** Skips staleness check without git
  - Given project is not a git repo
  - When running /audit
  - Then staleness checks are skipped (no error)

### /audit - Project Documentation Checks (new, absorbs /drift)

- [ ] **Scenario 11:** Reports ARCHITECTURE.md drift
  - Given ARCHITECTURE.md documents "Redux"
  - And code uses Zustand (in package.json)
  - When running /audit
  - Then output reports drift between docs and code

- [ ] **Scenario 12:** Creates ARCHITECTURE.md if missing
  - Given project has no ARCHITECTURE.md
  - When running /audit
  - Then ARCHITECTURE.md is created from template

- [ ] **Scenario 13:** Reports undocumented dependencies as gaps
  - Given package.json has @tanstack/query
  - And ARCHITECTURE.md doesn't mention it
  - When running /audit
  - Then output reports gap for undocumented dependency

- [ ] **Scenario 14:** Reports stale README
  - Given README.md last modified 30+ days ago
  - And commits exist since then
  - When running /audit
  - Then output reports "README.md may be stale"

- [ ] **Scenario 15:** Detects and checks docs site
  - Given project has docs/ with Starlight config
  - When running /audit
  - Then output includes docs site staleness check

### Command Removal

- [x] **Scenario 16:** /drift command removed
  - Given /drift command existed in templates
  - When checking templates/commands/
  - Then drift.md does not exist

### BDD Skill Phase 6 Enrichments

- [x] **Scenario 17:** Phase 6 explains outside-in test layering
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Phase 6 section
  - Then contains "E2E first" or "outside-in" guidance

- [x] **Scenario 18:** Phase 6 includes fixture setup guidance
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Phase 6 section
  - Then contains guidance on test fixtures or factories

### BDD Skill Phase 7 Enrichments

- [x] **Scenario 19:** Phase 7 includes cross-scenario refactor table
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Phase 7 section
  - Then contains refactoring opportunities table

- [x] **Scenario 20:** Phase 7 mentions flake detection
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Phase 7 section
  - Then contains "run tests multiple times" or "flake" guidance

- [x] **Scenario 21:** Phase 7 mentions scenario tagging
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Phase 7 section
  - Then contains "@smoke" or "@regression" tagging guidance

---

## Agent Config Best Practices Reference

Embedded in /audit for checking (no runtime web lookup needed):

**Sources:**

- [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Cursor Docs](https://cursor.com/docs/context/rules)
- [Cursor Forum](https://forum.cursor.com/t/my-best-practices-for-mdc-rules-and-troubleshooting/50526)

| Check      | Applies To          | Criteria                        | Severity |
| ---------- | ------------------- | ------------------------------- | -------- |
| Size limit | CLAUDE.md/AGENTS.md | ~150-200 instructions           | warn     |
| Size limit | Cursor rules        | 500 lines per rule              | warn     |
| Structure  | All                 | Has WHAT/WHY/HOW sections       | warn     |
| Dead refs  | All                 | Referenced files/skills exist   | error    |
| Drift      | ARCHITECTURE.md     | Docs contradict code            | error    |
| Gap        | ARCHITECTURE.md     | Undocumented major deps         | warn     |
| Staleness  | All                 | Last modified vs recent commits | warn     |
