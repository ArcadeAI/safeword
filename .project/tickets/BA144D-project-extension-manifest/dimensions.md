# Dimensions: Project Extension Manifest

| Dimension | Partitions | Boundary / Notes |
| --- | --- | --- |
| Extension inventory state | Missing `extensions`; empty `extensions`; populated `extensions`; malformed entries | Missing and empty are no-ops. Populated entries resolve from project root. Malformed entries become `safeword check` diagnostics before adapters are installed. |
| Extension kind | Guide; template; skill; hook | Each declared kind needs at least one supported exposure path. Skills must reuse the neutral skill manifest expansion path. Hooks add safety requirements beyond static content. |
| Source ownership and path safety | Project-owned relative path; missing path; duplicate name; path under safeword-owned/generated directory; path outside project root; absolute path; remote/free-form hook command | Customer source content must never live under resettable safeword-owned or generated adapter paths. Hook targets must be project-local scripts or an allowed runtime with a project-local script argument. |
| Agent surface mapping | Supported Claude mapping; supported Codex mapping; supported Cursor mapping; unsupported agent/event combination | Supported mappings produce owned adapters or pointers. Unsupported mappings fail loudly through `safeword check` and leave existing customer content intact. |
| Lifecycle command | `setup`; `upgrade`; `reset`; `check` | Setup and upgrade add/update adapters without touching source files. Reset removes only safeword-owned adapters. Check validates without mutating. |
| Hook composition | Safeword-owned hook; existing customer hook; declared extension hook; same-event Cursor hook | Reconciliation must preserve customer hooks while adding or updating safeword hooks. Same-event Cursor hooks are the highest-risk merge case. |

## Decisions Baked In

- Use one explicit `.safeword/config.json` `extensions` inventory rather than auto-discovery or per-agent config edits.
- Treat customer-owned extension files as read-only inputs to safeword; safeword owns only generated adapters and merge points.
- Reject extension source paths under safeword-owned or generated adapter directories before install, even if the file exists.
- Reuse the neutral skill manifest expansion path for customer skills rather than introducing a second skill registry.
- Keep v2 team-pack distribution out of scope while documenting it as the future promotion path.
