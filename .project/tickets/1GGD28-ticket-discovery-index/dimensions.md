# Dimensions — sync-tickets index

Derived from scope, done-when, and the `learning-sync` parser's known edge cases
(irregular frontmatter is the dominant risk: 49 bare-ID folders, optional
`title:`/`epic:`, Crockford vs numeric ids).

| Dimension                | Partitions                                                                                               | Proves |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ------ |
| Frontmatter completeness | full (id+title+status+epic) · missing title (→ H1 → slug) · missing epic (→ "—") · **missing id (skip)** | AC1    |
| Id format                | Crockford (`1GGD28`) · numeric (`001`) · quoted (`'001'`)                                                | AC1    |
| Goal one-liner           | `**Goal:**` present (extract) · absent (omit)                                                            | AC1    |
| Epic grouping            | tickets sharing an epic (one heading) · no epic (ungrouped section) · deterministic order                | AC2    |
| Idempotency / drift      | first run writes · unchanged → no-op · changed → rewrite · removed → entry drops                         | AC3    |
| Output hygiene           | auto-generated/do-not-edit header · INDEX\*.md excluded from its own scan                                | AC3    |
| Scope split              | active → INDEX.md · completed/ → INDEX-completed.md · completed-only · missing tickets dir (no-op)       | AC4    |

Regen wiring (command / `safeword check` step / `ticket new`) is integration glue
over the pure `ticket-sync` module — verified by command + integration checks,
not enumerated as behavioral partitions here.
