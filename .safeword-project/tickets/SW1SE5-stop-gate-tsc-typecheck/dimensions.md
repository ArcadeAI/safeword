# SW1SE5 — Behavioral Dimensions

The implement-phase-stop incremental `tsc` check. Dimensions that change the
hook's observable behavior, and the partitions of each.

| #   | Dimension                     | Partitions                                 | Drives                                           |
| --- | ----------------------------- | ------------------------------------------ | ------------------------------------------------ |
| 1   | Project type                  | TS (root `tsconfig.json` present) / non-TS | run vs skip                                      |
| 2   | TS files changed this session | ≥1 changed / none changed                  | run vs skip                                      |
| 3   | Type-check result             | clean / has type error(s)                  | silent vs surface advice                         |
| 4   | Stop phase                    | implement (non-done) / done                | gate fires only at non-done; done path unchanged |
| 5   | Enforcement                   | soft (advice only)                         | stop always allowed — even with errors           |
| 6   | Incremental cache             | cold (first) / warm (repeat)               | same advice; warm is fast (non-functional)       |

## Derivation notes

- **D1 + D2 are the run-gate.** The check runs only when both hold: a TS
  project AND ≥1 TS file changed this session. Either failing → skip entirely
  (no tsc spawn, no output). Cheapest correct behavior.
- **D3 is the surfacing axis.** When the check runs: clean → no added output;
  errors → the tsc message is surfaced as advice in the stop output.
- **D4 scopes placement.** `stop-quality.ts` runs commands only at `phase ===
'done'` today; this gate adds behavior to the NON-done (implement) path. The
  done path is out of scope (it already typechecks via /verify→/lint).
- **D5 is fixed soft.** Unlike the done gate (hard block), this surfaces type
  errors as advice and still allows the stop. The done gate remains the
  backstop. No "hard" partition — that was the converged scope decision.
- **D6 (incremental) is non-functional** — it makes repeat runs fast via a
  cached `.tsbuildinfo`. Not a behavioral scenario (asserting `--incremental`
  would test implementation); covered by `done_when`, validated in REFACTOR.
