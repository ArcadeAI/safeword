# Dimensions: Plan-vs-actual reconciliation

| Dimension              | Partitions                                      | Notes                                                                     |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Impl-plan status       | `planned` / `implemented` / invalid-or-missing  | The gate's decision input                                                 |
| Phase at gate time     | implement (pre-exit) / verify / done            | Status check fires at verify+; implement only requires existence (XDNSZA) |
| Ticket flow generation | new-flow (spec.md) / grandfathered (no spec.md) | Same routing as XDNSZA's gate                                             |
| Ticket type            | feature / task                                  | Tasks exempt                                                              |
| Doc surfaces           | canonical TDD.md / dogfood TDD.md               | Parity pair for the reconciliation step + worked example                  |

**Pruning:** invalid-or-missing impl-plan at verify is already blocked by XDNSZA's existence/validity gate — the status check only adds the planned-vs-implemented distinction, so invalid cells aren't re-sampled. The implement-phase cell stays exempt from the status check by design (the plan is legitimately `planned` during implementation) — one scenario pins that boundary. Tasks and grandfathered tickets reuse XDNSZA's exemption guards (same function shape); one cell each.
