# Test Definitions: One predictable Safeword CLI (K53GQ9)

Feature source: `packages/cli/features/predictable-safeword-cli.feature`

Each scenario below carries RED, GREEN, and REFACTOR evidence during
implementation.

## Rule ledger

| Rule | Scenarios | RED | GREEN | REFACTOR |
| --- | ---: | --- | --- | --- |
| TBU1.R1 default status | 2 | `b178e7e8c` | `97ee66679` | `fb01c7e59` |
| TBU1.R2 read-only invariants | 9 | `f2dfcda1e` | `886c61a57` | `fb01c7e59` |
| TBU1.R3 human renderer | 5 | `0fbf6e24b` | `75928ace1` | `a1fd38c90` |
| TBU1.R4 destructive confirmation | 4 | `6ab9915c2` | `b1b03789b` | `7e74674e3` |
| TBU1.R5 setup convergence | 1 | `6bc2b8942` | `643072543` | `fb01c7e59` |
| NTB1.R1 exit semantics | 3 | `fc9159487` | `1875aa5ee` | `75928ace1` |
| NTB1.R2 non-interactive safety | 2 | `6ab9915c2` | `b1b03789b` | `fb01c7e59` |
| SWM1.R1 typed boundary | 2 | `46790fe42` | `cb247c5b5` | `fb01c7e59` |
| SWM1.R2 machine contract | 11 | `46790fe42` | `cb247c5b5` | `fb01c7e59` |
| SWM1.R3 JSON envelope | 3 | `fc9159487` | `1875aa5ee` | `75928ace1` |
| SWM1.R4 capabilities | 1 | `a07d6f38d` | `3cf149e31` | `cb247c5b5` |
| SWM1.R5 hierarchy and aliases | 35 | `c84d5dea2` | `3e4bc2be5` | `cb247c5b5` |
| SWM1.R6 hook safety | 4 | `bfd3e24f3` | `f2dfcda1e` | `fb01c7e59` |
| Interactive progress | 1 | `37477964b` | `45235c2d4` | `fb01c7e59` |

Total: 83 scenario instances. Commit identifiers replace each checkbox as its
slice moves through RED → GREEN → REFACTOR.
