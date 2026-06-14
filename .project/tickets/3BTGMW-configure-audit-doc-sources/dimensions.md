# Dimensions: Configure Documentation Sources for Audit

| Dimension                                 | Partitions                                                                                                               | Covered by                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Source decision state                     | `docs.sources` absent; `docs.sources: []`; `docs.sources` with valid entries; malformed entries mixed with valid entries | MA1.AC1, MA1.AC3, MA2.AC1, MA2.AC2 |
| Source type                               | local relative path; local absolute path; URL; git repo/path                                                             | MA1.AC1, MA1.AC2                   |
| Audit behavior without configured sources | prompt for decision; suppress prompt after explicit empty choice; fallback discovery still runs                          | MA2.AC1, MA2.AC2, MA2.AC3          |
| Validation boundary                       | configured local path exists; configured local path missing; external source declared but not locally validated          | MA1.AC2, MA2.AC3                   |

Boundary values: empty `docs.sources` array is an explicit user decision, not the same as an absent `docs` block; unsupported non-empty entries are ignored defensively but do not create a no-prompt decision.
