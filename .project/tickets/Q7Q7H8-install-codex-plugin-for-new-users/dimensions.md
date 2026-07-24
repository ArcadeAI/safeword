# Behavior Dimensions

| Dimension | Partitions | Boundary / risk covered |
| --- | --- | --- |
| Entry point | `setup`, `upgrade`, `codex install`, legacy migration alias | New-user guidance is clear while scripts using the old command continue to work. |
| Project state | no `.codex`, Safe Word legacy hooks, mixed Safe Word/custom hooks | Installation never creates project Codex files; cleanup touches only Safe Word-owned registrations. |
| Plugin state | install succeeds and enabled, install fails, plugin disabled | The profile must be verified before success or destructive cleanup. |
| Cleanup intent | omitted, explicit `--remove-legacy-hooks` | No legacy hooks are removed without an explicit request. |
