---
id: YGH23C
slug: include-cited-architecture-records
type: task
phase: done
status: done
created: 2026-11-23T18:12:28.142Z
last_modified: 2026-11-23T18:12:28.142Z
---

# Include cited architecture records for plan reviewers

**Goal:** When building a review packet for a ticket-owned plan, include the architecture decision records it cites in the repository. If a cited file is missing, report its path.

**Why:** The loader includes the configured architecture records and files passed as explicit context. It skips records referenced only by a Markdown link.

## Acceptance criteria

- Capture repository Markdown linked from the Architecture applicability section, and links elsewhere in the plan when the configured overview indexes the same record. A qualifying citation takes precedence over a section skip.
- Resolve links relative to their source document, ignore fragments, decode URL escapes and retain literal percent signs. Include each qualifying record once.
- For execution review, inspect both the execution plan and its upstream implementation plan. Bind captured record bytes to review identity.
- Report a missing required record with its repository path. Reject repository escapes and exclude absolute and external links.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-23T18:12:28.142Z Started: Created ticket YGH23C
