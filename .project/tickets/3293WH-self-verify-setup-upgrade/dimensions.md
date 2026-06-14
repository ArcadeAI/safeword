# Dimensions — self-verify-setup-upgrade

Derived from intake artifacts (figure-it-out decisions, done_when, scope) +
domain knowledge.

| Dimension              | Partitions                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command verified       | setup, upgrade, standalone check (must stay unchanged)                                                                                                                                        |
| Health result          | clean, advisories-only (print once, exit zero), issues found                                                                                                                                  |
| Network behavior       | update-check absent in self-verify; present (default) in standalone check                                                                                                                     |
| Remediation hint       | standalone check ("run safeword upgrade" — unchanged), post-upgrade (must not self-reference), post-setup (deliberately keeps the upgrade hint — correct, non-self-referencing repair advice) |
| Output volume on clean | exactly one health success line — no duplicate walls                                                                                                                                          |
| Doc surface            | SAFEWORD.md template+dogfood, website cli.mdx (imperative wording only)                                                                                                                       |

Boundary notes: the issues-found partition cannot be produced by a real
fresh-setup fixture (reconcile just wrote everything), so it is proven at the
seam — the shared health module unit-level, plus command wiring with an
injected/broken health result.
