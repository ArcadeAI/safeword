# Behavioral Dimensions: migrate consumers to test-plan

| Dimension                      | Partitions                                                        | Boundary / edge                                 | Covered by scenario                                    |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Output format                  | `json` (TS hook) · **`sh`** (bash skill) · human                  | sh is the new mode                              | sh-cd-command; sh-skip-echo                            |
| sh entry state                 | available → `( cd <cwd> && <cmd> )` · **unavailable → skip echo** | unavailable must not emit a bare command        | sh-skip-echo                                           |
| sh runnability                 | the emitted script actually executes                              | eval produces the suite's output                | sh-eval-runs                                           |
| Languages via consumer         | JS-script · native (go/rust/python) · **polyglot**                | polyglot = all suites                           | sh-polyglot; runner-non-js                             |
| test-runner suite source       | resolver plan (no inline strings)                                 | structural: zero language commands in the file  | test-runner-no-lang-strings                            |
| Stop-hook behavior (preserved) | JS test+bdd · non-JS native · **no suite → skip**                 | skip must never block                           | runner-js-preserved; runner-non-js; runner-empty-skips |
| /verify command source         | `test-plan --format sh` (no inline bash)                          | structural: zero language branches in section 2 | verify-no-inline-lang                                  |

**Notes**

- The load-bearing guarantee is **no language command string appears in two places** — pinned by two structural scenarios (test-runner.ts, /verify) plus the behavioral proof that the migrated paths still run the right suites.
- `test:bdd` (JS acceptance lane) stays a consumer-side step — _not_ a dimension of `test-plan`; the stop-hook/verify scenarios assert it still runs.
- Determinism: `--format sh` toolchain availability is driven by the `SAFEWORD_FAKE_TOOLS` seam (BKTTZA), so sh-output scenarios don't depend on the host.
- Out of scope (no dimension): /audit (dead-code/outdated tooling — different domain).
