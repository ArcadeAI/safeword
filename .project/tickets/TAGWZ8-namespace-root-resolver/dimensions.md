# Behavioral Dimensions — namespace-root resolver

The resolver is a pure function of `(cwd, .safeword/config.json, on-disk dir
presence)`. Dimensions below are partitioned into equivalence classes +
boundaries; each scenario in `test-definitions.md` covers one partition.

| Dimension                        | Partitions (equivalence classes + boundaries)                                                                                                                              | ACs proved           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Root resolution source           | config `paths.projectRoot` set · `.project/` present (no config) · only `.safeword-project/` present · **both present** (boundary) · **neither present** (boundary, fresh) | SM1.AC1, TB1.AC2    |
| Configured-root path type        | relative (resolve against cwd) · absolute (verbatim, boundary)                                                                                                             | TB2.AC1             |
| Per-file override interaction    | no per-file override (derive from root) · per-file `paths.X` set (wins for that file)                                                                                      | TB2.AC2             |
| Default-subpath derivation       | personas · glossary · architecture — each default = `<resolved-root>/<file>.md`                                                                                            | TB1.AC1             |
| Surface consumption (behavioral) | a representative surface (sync-tickets) reads/writes under the resolved root, not a hard-coded literal                                                                     | SM1.AC2              |
| Malformed config (defensive)     | empty-string `paths.projectRoot` (boundary) · missing/unparseable config.json (boundary) — both treated as unset, fall through precedence                                  | SM1.AC1 (robustness) |

**Domain-knowledge boundaries not surfaced in intake:**

- **Both-dirs present** — the resolver returns `.project/` by precedence; the _advisory_ that flags this state is sibling 9MMWS7, out of scope here. This child only pins the value returned.
- **Empty-string / non-string / missing config** — mirrors the existing `readConfiguredPath` defensive semantics (K7N2QM); the new root key must behave identically so a typo'd config never crashes resolution.
