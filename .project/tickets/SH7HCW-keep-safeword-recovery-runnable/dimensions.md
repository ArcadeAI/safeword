# Behavioral Dimensions

| Dimension | Partitions and boundaries |
| --- | --- |
| Dependency state | missing; stale |
| Command intent | Safeword setup; Safeword diagnostics; unrelated dependency-backed executor |
| Package spelling | unversioned `safeword`; tagged `safeword@latest`; pinned `safeword@0.73.0`; lookalike package; bare package without a recovery subcommand |
| Invocation prefix | direct; environment assignment; documented `--bun` flag |
| Shell composition | command alone; `&&`; `;`; `\|\|`; pipe; newline; background `&`; `$()` substitution; backtick substitution; process substitution |
| Recovery wording | supported `setup`; removed `install` |

The selected scenarios cover both dependency failure states, every allowed
recovery intent, exact package identity boundaries, shell chaining, and the
user-facing recovery instruction.
