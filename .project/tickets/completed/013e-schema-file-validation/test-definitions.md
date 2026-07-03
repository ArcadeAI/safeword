# Test Definitions: Schema File Validation

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

## Scenario 1: All templates have schema entries (happy path)

- [x] **Given** all template files in `templates/` have corresponding `template:` entries in schema
- [x] **When** the validation test runs
- [x] **Then** the test passes with no errors

## Scenario 2: Orphan template file detected

- [x] **Given** a template file exists in `templates/` without a `template:` reference in schema
- [x] **When** the validation test runs
- [x] **Then** the test fails listing the orphan file path

## Scenario 3: Dangling schema reference detected

- [x] **Given** a schema entry has `template: 'path'` pointing to a non-existent file
- [x] **When** the validation test runs
- [x] **Then** the test fails listing the dangling reference

## Scenario 4: Generator entries are skipped

- [x] **Given** a schema entry uses `generator: () => ...` instead of `template:`
- [x] **When** the validation test runs
- [x] **Then** that entry is not validated for file existence

## Scenario 5: Content entries are skipped

- [x] **Given** a schema entry uses `content: () => ...` instead of `template:`
- [x] **When** the validation test runs
- [x] **Then** that entry is not validated for file existence
