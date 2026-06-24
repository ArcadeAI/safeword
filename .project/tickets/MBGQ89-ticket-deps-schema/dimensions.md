# Dimensions: epic + blocked_on schema and the blocked_on phase gate

Derived from `done_when` + scope (de-bloated to two fields) + domain knowledge of safeword's ticket reader and hook surfaces. Supersedes the earlier 5-field version.

| Dimension                       | Partitions (equivalence classes + boundaries)                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker status** (gate input) | `done` · non-terminal (`in_progress`/`blocked`) · terminal-not-done (`cancelled`/`superseded`/`wontfix`) · unresolvable (id not in corpus) · unreadable (target exists, `status` missing/garbled) |
| **Phase transition**            | intake→out (gate fires) · already-past-intake (grandfather, no fire) · non-phase frontmatter edit (no fire)                                                                                       |
| **Override**                    | absent · present + substantive reason · present + trivial/empty reason                                                                                                                            |
| **Override staleness**          | matches a real non-done blocker · all blockers now `done` (stale)                                                                                                                                 |
| **Multiplicity**                | single blocker · multiple (gate fires if ANY non-done)                                                                                                                                            |
| **Validation (warn-only)**      | unresolvable ref · cycle (A→B→A) · self-cycle (A→A) · clean                                                                                                                                       |

## Notes

- **No separate cross-repo partition.** Bare ids only, so an unresolvable id is indistinguishable from a typo — both warn (resolves the S3/S5 contradiction the gate surfaced; matches AKZJXC's shipped `findDanglingDependencies`).
- The gate governs **tool-mediated** writes only (the pre-tool hook checks the proposed frontmatter on Write/Edit to ticket.md); a human hand-editing bypasses it — inherent to every pre-tool gate, not a partition.
- `blocked_on_override` carries a **single** reason for the whole advance (v1), not per-blocker.
- `depends_on` is out of scope (shipped via AKZJXC); `paired_with`/`parent` deferred (no consumer).
