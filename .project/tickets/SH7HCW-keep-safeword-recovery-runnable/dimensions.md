# Behavioral Dimensions

| Dimension | Partitions and boundaries |
| --- | --- |
| Dependency state | missing; stale |
| Command intent | Safeword setup; Safeword diagnostics; unrelated dependency-backed executor |
| Package spelling | unversioned `safeword`; tagged `safeword@latest`; pinned `safeword@0.73.0`; lookalike package; scoped lookalike; bare package without a recovery subcommand |
| Invocation prefix | direct; benign environment assignment; environment-value command substitution; multiple assignments; documented `--bun` flag |
| Pre-verb Safeword option | none; boolean global (`--quiet`); value global, separated and `=`-joined (`--cwd`); missing recovery verb after value consumption; unrecognized flag |
| Post-verb argument | none; supported option; benign positional token; quoted literal metacharacter; shell-evaluation token |
| Shell composition | command alone; recovery-only `&&`; recovery-first guarded `&&`; guarded-first `&&`; `;`; `\|\|`; pipe; newline; background `&`; `$()` substitution; backtick substitution; process substitution |
| Recovery wording | supported `setup`; removed `install` |

The selected scenarios cover both dependency failure states, every allowed
recovery intent, exact package identity boundaries, shell chaining, and the
user-facing recovery instruction.
