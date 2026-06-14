# Dimensions: Plan-vs-actual reconciliation

| Dimension              | Partitions                                      | Notes                                                                     |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Impl-plan status       | `planned` / `implemented` / invalid-or-missing  | The gate's decision input                                                 |
| Phase at gate time     | implement (pre-exit) / verify / done            | Status check fires at verify+; implement only requires existence (XDNSZA) |
| Ticket flow generation | new-flow (spec.md) / grandfathered (no spec.md) | Same routing as XDNSZA's gate                                             |
| Ticket type            | feature / task                                  | Tasks exempt                                                              |
| Doc surfaces           | canonical TDD.md / dogfood TDD.md               | Parity pair for the reconciliation step + worked example                  |

**Pruning:** XDNSZA's existence/validity gate fires at implement/done only — **this ticket extends it to verify** (new behavior, pinned by `missing_plan_at_verify_blocks` per gate review F1). Invalid-status-value at verify stays pruned: once existence/validity extends, the parser's Unknown-status error rides the same validity block. The implement-phase cell stays exempt from the status check by design (the plan is legitimately `planned` during implementation) — one scenario pins that boundary. Tasks and grandfathered tickets reuse XDNSZA's exemption guards (same function shape); one cell each.
