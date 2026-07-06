# Dimensions: retro-filing-provenance

Derived from intake (environment split, scope, done-when) plus domain knowledge
of the ledger's attacker-influenceable parse path and squash-merge git topology.

| Dimension                | Partitions                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture environment      | dogfood repo (SHA + capture time); customer install (version + capture time); git state unavailable (provenance omitted, filing proceeds)      |
| Filing path              | new issue (seeded ledger); recurrence bump (newest provenance wins); bump onto a pre-provenance ledger (back-compat)                            |
| Ledger input trust       | well-formed provenance; attacker-shaped/oversized values (coerced, never echoed); absent fields (safe defaults)                                 |
| Code-state normalization | SHA encounter → capture time; version encounter → release-tag date; mixed ledger → newest code state governs (not newest wall clock)            |
| Surface touch state      | surface touched on default branch after newest code-state date (flag); untouched since (no flag)                                                |
| Reconcile eligibility    | provenance + file-path surface (eligible); no provenance / pre-feature (skip); `process/<slug>` surface (skip); version with unresolvable release-tag date (skip); closed or non-retro-labeled issues (never considered) |
| Side-effect discipline   | first flag adds comment + label only (issue stays open); re-run against unchanged state adds nothing; close is never issued                     |

Boundary notes:

- Recorded dogfood SHAs live on squash-merged branches — never ancestors of main
  and possibly unresolvable later; the capture time is the load-bearing field.
- An old-version encounter observed *today* keys on its release-tag date, not
  wall clock, so it stays flaggable as possibly-resolved-by-a-newer-release.
- Tag→date resolution is fallible (annotated-only tag-object endpoint,
  lightweight tags, deleted/absent tags for dev builds) — unresolvable is a
  first-class skip partition, never a guess.
- `since` on list-commits is assumed committer-date-based (git semantics; GitHub
  docs ambiguous). Committer date favors this design: a squash-merged fix's
  committer date is merge time. Clock skew between capture and committer clocks
  is tolerated — reconcile is flag-only and human-verified.
- The sweep bounds its API operations per run (actions/stale precedent).
