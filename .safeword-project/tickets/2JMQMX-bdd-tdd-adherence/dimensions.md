# Dimensions — resolveStopPhase (status-close gate)

The decision is a pure function `resolveStopPhase(details, hasTestDefinitions)
→ {phase, type, folder}`. Four variables partition its behavior.

| Dimension           | Partitions                                | Proves   |
| ------------------- | ----------------------------------------- | -------- |
| status              | in_progress · done · other (backlog)      | AC1–AC3  |
| phase at close      | ≠ done · == done (already gated)          | AC1, AC3 |
| type                | feature · task · epic · patch · undefined | AC1–AC3  |
| test-definitions.md | present · absent                          | AC1, AC3 |

Decision table (status=done, phase≠done):

| type            | hasTestDefs | → phase | severity when gate runs             |
| --------------- | ----------- | ------- | ----------------------------------- |
| feature / task  | yes         | `done`  | tests + scenarios + verify + skills |
| epic            | (n/a)       | `done`  | tests + verify.md only              |
| feature / task  | no          | exempt  | —                                   |
| patch/undefined | any         | exempt  | —                                   |

Passthrough: status=in_progress → returns the ticket's real phase. Already-done:
status=done & phase=done → exempt (no re-gate loop). Integration: the full Stop
hook must actually block a feature status-close missing verify.md (proves the
surfaced `phase: 'done'` reaches the real gate, not just the unit).
