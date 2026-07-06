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
| Reconcile eligibility    | provenance + file-path surface (eligible); no provenance / pre-feature (skip); `process/<slug>` surface (skip); closed issues (never listed)    |
| Side-effect discipline   | first flag adds comment + label only (issue stays open); re-run against unchanged state adds nothing; close is never issued                     |

Boundary notes:

- Recorded dogfood SHAs live on squash-merged branches — never ancestors of main
  and possibly unresolvable later; the capture time is the load-bearing field.
- An old-version encounter observed *today* keys on its release-tag date, not
  wall clock, so it stays flaggable as possibly-resolved-by-a-newer-release.
