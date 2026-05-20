# Behavioral dimensions — ticket 158

Derived from scope, done_when, and the 5 surfaces enumerated when entering BDD: (1) `safeword ticket new` happy path + EEXIST retry, (2) dual-format active-ticket lookup, (3) duplicate-ID guard, (4) skill prompt regression, (5) cross-branch / cross-session integration.

## Dimension table

| Dimension                      | Partitions                                                                                                                                                                                                   | Source            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| ID character set               | valid Crockford char / forbidden char (`I`, `L`, `O`, `U`) appears                                                                                                                                           | scope (alphabet)  |
| ID length                      | exactly 6 / not 6 (regression guard)                                                                                                                                                                         | scope             |
| ID canonical case              | uppercase on disk and frontmatter / lowercase or mixed (rejected on write)                                                                                                                                   | scope             |
| Mint outcome                   | first-try success / EEXIST once then success / EEXIST N times then success / EEXIST exceeds retry budget then fail loud                                                                                      | done_when (#1)    |
| CLI argument surface           | `<slug>` only / `<slug> --title=...` / `<slug> --type={patch,task,feature}` / missing `<slug>` (error)                                                                                                       | scope             |
| Folder layout (write)          | new ticket → `{ID}/ticket.md` (no slug in path) / frontmatter has both `id` and `slug`                                                                                                                       | scope             |
| Folder layout (read — lookup)  | legacy `{numeric}-{slug}/` / legacy with letter suffix `{102a}-{slug}/` / new `{CROCKFORD}/`                                                                                                                 | scope             |
| Lookup input case              | exact uppercase / lowercase / mixed case (all resolve same target — Crockford rule)                                                                                                                          | scope (Crockford) |
| Lookup hit/miss                | exact match / no match (clear null/error) / multiple matches (defensive: surfaced, not silently picked)                                                                                                      | scope             |
| Duplicate-ID guard environment | pre-commit hook / CI step                                                                                                                                                                                    | scope             |
| Duplicate state                | clean (no dupes) / two new-format folders with same `id:` / two legacy folders with same `id:` (synthetic, since current state has none) / legacy-and-new (different ID spaces by construction — impossible) | scope             |
| Guard failure surface          | exits non-zero / names both offending folder paths / names the duplicate ID                                                                                                                                  | done_when (#3)    |
| Skill prompt content           | contains "find … highest" / "increment" near ID guidance (regression — fail) / references `safeword ticket new` (pass)                                                                                       | done_when (#5)    |
| Concurrency — intra-filesystem | two parallel processes both call `ticket new` / N processes in stress loop                                                                                                                                   | done_when (#1)    |
| Concurrency — cross-branch     | two branches off same parent each create a ticket / merge to main: distinct IDs (likely) OR folder merge conflict (rare) OR silent collision (FORBIDDEN — must fail)                                         | done_when (#2)    |
| Legacy compatibility           | existing `080-ticket-id-collision/` resolves and renders / commit references to old IDs remain valid pointers                                                                                                | done_when (#4)    |

## Notes on partitions intentionally NOT enumerated

- **Birthday-bound collision math** (probability that two random IDs collide in the same session): not a behavioral partition — covered indirectly by stress test + the duplicate-ID guard catching any residual.
- **Crockford ambiguity decoding** (mapping `1`→`I` or `0`→`O` on input): out of scope. We never accept input that looks Crockford-ish but contains I/L/O/U; if the user types `IL00`, lookup miss is fine. Could revisit later.
- **Filesystem case-sensitivity on macOS APFS** (default case-insensitive): irrelevant because canonical on disk is uppercase. A case-insensitive FS can't make `7k9m3p/` and `7K9M3P/` collide because we only ever write the uppercase form.
