---
id: W8G4RP
slug: keep-website-verification-clear-for-maintainers
type: patch
phase: done
status: done
scope:
  - update website Astro to 7.4.7 and align root Vite 8.3.5 and Zod 4.6.7 pins with its declared requirements
  - retain the generated lockfile graph and verify audit, website and workspace compatibility
out_of_scope:
  - updating unrelated direct dependencies or adopting the 33-package bulk update
  - modifying converter dependencies, qualification, review routes or archived EP9 eligibility
done_when:
  - raw Bun audit clears both Astro advisories without suppressions
  - website build and typecheck and workspace checks pass with supported dependency ranges
  - independent review and current-head verification support the exact bounded patch
created: 2026-11-14T01:11:32.932Z
last_modified: 2026-11-14T01:11:32.932Z
---

# Clear website dependency advisories for maintainers

**Goal:** Update Astro and its required Vite and Zod pins within compatible majors so the repository audit passes

**Why:** User approved the separate tested dependency fix and administrative merges after green checks

## Work Log

- 2026-11-14T01:11:32.932Z Started: Created ticket W8G4RP
