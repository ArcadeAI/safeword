# Behavioral dimensions — ticket J7VBGJ

Derived from scope, done_when, and the three surfaces this feature touches: (1) the write-time Edit/Write hook on `test-definitions.md`, (2) the commit-time Bash hook on `git commit *`, (3) the stop-time done gate.

## Dimension table

| Dimension                            | Partitions                                                                                                            | Source                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Checkbox transition annotation       | with SHA / with `skip: <reason>` / `skip:` with empty reason / `skip:` with whitespace-only reason / no annotation    | scope (write-time hook)          |
| Pre-existing checkbox state          | `[x]` written before feature ships (no annotation) — silently passes at done                                          | out_of_scope (no migration code) |
| TDD step at commit time              | RED / GREEN / REFACTOR / unknown (no test-definitions.md) — gate only fires when step is determinable                 | scope (commit-time hook)         |
| Staged file shape per step           | tests only / app only / both / docs+config only                                                                       | scope (file-path heuristic)      |
| Allowed/blocked commit matrix        | RED+tests=allow / RED+app=block / GREEN+anything=allow / REFACTOR+tests=block / REFACTOR+app=allow                    | scope (per-step file rule)       |
| Done-gate SHA validity per scenario  | all three distinct & reachable / two share a SHA / SHA unreachable from HEAD / mix of real-SHA and `skip:` / all-skip | done_when (per-scenario)         |
| Cross-scenario refactor row presence | row present with SHA / row present with `skip:` / row missing entirely / row present with empty `skip:` reason        | done_when (feature-level row)    |
| Skip-reason validation surface       | write-time (Edit/Write hook) / done-time (stop hook) — both apply the same non-empty rule                             | done_when (skip-reason rule)     |
| Documentation propagation            | bdd/TDD.md describes new format / bdd/VERIFY.md describes cross-scenario row format                                   | scope (docs)                     |

## Notes on partitions intentionally NOT enumerated

- **Auto-filling SHAs for the agent** — explicitly out of scope. The agent writes the SHA; the hook validates. No auto-detection of "which commit corresponds to this checkbox."
- **Categorized skip reasons / allowlist of valid reason strings** — out of scope. Free-form non-empty string is the rule; the reason is the agent's accountability, not the hook's classifier.
- **Commit message prefix conventions (`RED:` / `GREEN:` / `REFACTOR:`)** — out of scope. The step is derived from checkbox state and validated against the file-path heuristic, not the commit message.
- **AST-level "this looks like a refactor" detection on GREEN commits** — out of scope. GREEN is unrestricted by design; agents are trusted at GREEN, the discipline gate is on REFACTOR via the file-path rule.
- **Multi-ticket cross-validation** (e.g., catching a SHA reused across two tickets) — not a concern. Done-gate operates per-ticket.
- **Per-task aggregation** — out of scope. Per-scenario is the chosen unit, matching safeword's existing TDD discipline (TDD.md line 20: "Pick first unchecked scenario … cycle through RED → GREEN → REFACTOR"). The annotation extends the existing per-scenario checkboxes rather than introducing a parallel task-level ledger.
- **Migration of pre-existing tickets** — out of scope. Pre-existing `[x]` with no annotation is silently allowed; new transitions must comply. No grandfathering code, no version-conditional branches.
