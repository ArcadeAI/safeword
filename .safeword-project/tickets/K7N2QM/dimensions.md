# K7N2QM — Behavioral Dimensions

Systematic coverage analysis for the configurable-paths feature. Each dimension
is partitioned into equivalence classes + boundary values; scenarios in
`test-definitions.md` cover one per partition (with boundary cases).

## Dimension table

| Dimension                                         | Partitions                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Override state**                                | unset, set-relative, set-absolute, set-empty-string (boundary)                                              |
| **File existence at resolved location**           | present, missing                                                                                            |
| **File content (when present)**                   | well-formed, malformed                                                                                      |
| **Default-location state (when override is set)** | absent, pre-existing legacy file (boundary — migration trap)                                                |
| **Reset mode (when override is set)**             | reset (plain), reset --full                                                                                 |
| **Forward-looking config keys**                   | `paths.glossary` set, `paths.architecture` set (schema-acceptance only; read sites land in sibling tickets) |

## Notes on derivation

- **Override state** — `unset` and `set-*` are the primary partitions from
  ticket scope. `set-empty-string` is a boundary derived from defensive
  programming: an empty value in JSON config is a real input the read API
  must handle without breaking. Treated as equivalent to unset.

- **Default-location state** — the `pre-existing legacy file` partition is a
  domain-knowledge boundary, not a ticket-scope partition. Surfaced via
  `/figure-it-out` on the question "what does safeword do when the user
  configures an override after already authoring content at the default
  location?" Drives the `safeword check` advisory scenario.

- **Reset mode** — both `reset` and `reset --full` partitions matter
  because they diverge in current reconcile behavior (full removes
  managedFiles; plain doesn't). With `configKey` suppressing the entry
  uniformly, both must skip the default-location file when override is
  configured — a consistency guarantee worth pinning.

- **Forward-looking keys** — partition exists because the ticket's done_when
  requires schema slots for glossary/architecture even though the read
  sites for those files don't ship in K7N2QM. Single schema-acceptance
  scenario covers the partition.
