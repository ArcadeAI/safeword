# Test Definitions: One predictable Safeword CLI (K53GQ9)

Feature source: `packages/cli/features/predictable-safeword-cli.feature`

Each scenario below carries RED, GREEN, and REFACTOR evidence during
implementation.

## Rule ledger

| Rule | Scenarios | RED | GREEN | REFACTOR |
| --- | ---: | --- | --- | --- |
| TBU1.R1 default status | 2 | [ ] | [ ] | [ ] |
| TBU1.R2 read-only invariants | 9 | [ ] | [ ] | [ ] |
| TBU1.R3 human renderer | 5 | [ ] | [ ] | [ ] |
| TBU1.R4 destructive confirmation | 4 | [ ] | [ ] | [ ] |
| TBU1.R5 setup convergence | 1 | [ ] | [ ] | [ ] |
| NTB1.R1 exit semantics | 3 | [ ] | [ ] | [ ] |
| NTB1.R2 non-interactive safety | 2 | [ ] | [ ] | [ ] |
| SWM1.R1 typed boundary | 2 | [ ] | [ ] | [ ] |
| SWM1.R2 machine contract | 11 | [ ] | [ ] | [ ] |
| SWM1.R3 JSON envelope | 3 | [ ] | [ ] | [ ] |
| SWM1.R4 capabilities | 1 | [ ] | [ ] | [ ] |
| SWM1.R5 hierarchy and aliases | 35 | [ ] | [ ] | [ ] |
| SWM1.R6 hook safety | 4 | [ ] | [ ] | [ ] |
| Interactive progress | 1 | [ ] | [ ] | [ ] |

Total: 83 scenario instances. Commit identifiers replace each checkbox as its
slice moves through RED → GREEN → REFACTOR.
