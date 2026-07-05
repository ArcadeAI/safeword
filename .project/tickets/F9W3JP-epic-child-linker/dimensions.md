# Dimensions: `ticket new --parent` epic-child linker (F9W3JP)

Derived from spec.md (TB1.AC1–AC4, done_when) + domain knowledge (bidirectional
`parent:`⇄`children:` link, atomic frontmatter mutation, index grouping).

| Dimension                    | Partitions                                                                                          | AC       |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| `--parent` reference         | valid `type: epic`; id of a non-epic ticket (task/feature/patch); id with no folder                 | AC1, AC3 |
| Epic `children:` prior state | empty `[]`; non-empty list; list already containing this child id (idempotency)                     | AC1, AC4 |
| Child link written           | child `parent:` equals the epicId; navigation (`findNextWork`) reaches the child                    | AC1      |
| Index grouping               | linked child appears under its epic's heading in `INDEX.md` (grouped via `parent:`, no `epic:` set) | AC2      |
| Failure atomicity            | on a rejected `--parent`, no child folder is created and the epic file is untouched                 | AC3      |
| Append safety                | existing `children:` entries preserved; id added at most once; epic written atomically (tmp+rename)  | AC4      |
| No-`--parent` (regression)   | `ticket new` without `--parent` writes no `parent:` and mutates no other ticket                     | —        |

**Test layers:** the link mechanics — validate-epic, append-if-absent, atomic write — are a **unit** on a pure helper exercised against a real temp-dir fs (mirrors `hierarchy.ts` helper tests; only fs is the boundary). End-to-end `--parent` behavior (child frontmatter + epic `children:` + exit codes + no-op-on-error) is **command-level** via `runCli` in a temp dir, like `tests/commands/ticket-new.test.ts`. Index grouping is asserted at the **sync-tickets** command level (temp dir → generate `INDEX.md` → assert the child sits under its epic).

**Baked decision (from /figure-it-out):** the child→epic relationship has a
single source of truth, `parent:`. No `epic:` field is written; `INDEX.md`
grouping resolves the epic from `parent:`. This rejects the dual-write
(`parent:` + `epic:`) alternative to avoid drift.
