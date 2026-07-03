# Dimensions: BDD lane collision detection + configurable paths

Derived from ticket.md scope/done_when + spec.md ACs (2026-07-03).

| Dimension                        | Partitions                                                                                                                                                                                                                       | AC       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Harness presence at setup        | none anywhere (default path) · host config file at root (yaml/json/js) · host config in a direct workspace package · `@cucumber/cucumber` dep only, no config file · customer-authored root `cucumber.mjs` (content ≠ template) | TB1.AC1, TB1.AC4 |
| Self-exclusion (upgrade)         | safeword's own scaffold only (template-content `cucumber.mjs` + safeword-added deps) · safeword scaffold coexisting with a host harness (bitten repo)                                                                             | TB1.AC2, TB3.AC2 |
| Uninstall target ownership       | host-owned harness files/deps in a detected-harness repo · files at configured `paths.*` locations · safeword's own scaffold (still removable)                                                                                    | TB1.AC3, TB1.AC5 |
| `paths.*` configuration state    | unset (defaults only) · `features`+`steps` set to existing dirs (augment) · config.json missing · config.json unparseable                                                                                                          | TB2.AC1, TB2.AC3 |
| Consumer of configured paths     | feature-source readers (codify · lint-gherkin · check) · scaffolded `cucumber.mjs` under a real cucumber-js run                                                                                                                    | TB2.AC1, TB2.AC2 |
| Advisory states (`safeword check`) | detected harness + unset `paths.*` → warn · leftover duplicate scaffold → enumerate from schema · healthy default repo → silent · detected harness + `paths.*` set → silent                                                       | TB3.AC1, TB3.AC2 |

Boundary notes:

- Content boundary on `cucumber.mjs`: byte-equal to any shipped safeword template revision → own scaffold; anything else → host harness. (Historical template revisions count as own scaffold, or every pre-change install self-triggers on upgrade.)
- Dep boundary: `@cucumber/cucumber` entry is "safeword-added" only when the starter lane's own files are present at their default locations; a dep with no safeword lane is host evidence.
- Workspace radius: root + direct workspace package manifests/config files (same radius `feature-source.ts` already scans) — not a recursive tree walk.
