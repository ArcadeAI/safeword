# Dimensions: OpenCode independent review fallback

| Dimension | Partitions and boundaries | Scenario consequence |
| --- | --- | --- |
| Author runtime | Claude, Codex, OpenCode; Cursor/unknown unchanged | Preserve both existing preferred pairings; add explicit OpenCode-author routing without widening unsupported authors. |
| Preferred route | completes, retryable failure, terminal failure, insufficient shared deadline | OpenCode runs only after the preferred agent's eligible routes are exhausted and only when the shared deadline can fund it. |
| OpenCode route | usable and authenticated, absent/unsupported, unauthenticated, timeout/process failure | A valid OpenCode result remains independent for Claude/Codex authors; failures continue to the existing degraded or exhausted outcome. |
| Independence policy | prefer, require | Same-author fallback remains advisory under prefer and blocked under require; OpenCode self-review never satisfies either gate. |
| OpenCode-authored routing | Claude succeeds, Claude fails and Codex succeeds, both fail | Another runtime must supply the evidence; no OpenCode self-review route is admitted as independent. |
| Output stream | complete valid JSON events, malformed events, no final text, oversized output | Only a complete closed Safeword result is accepted; ambiguous exit-zero runs fail closed. |
| Provenance | matching reviewer and dispatch, missing identity, contradictory identity | OpenCode must identify both itself and the assigned dispatch exactly. |
| Side effects | no tool request, denied tool request, source mutation, packet mutation | Review remains tool-free and read-only; source changes make it stale and packet writes fail the review. |
| Execution bound | completes within budget, per-attempt timeout, no remaining route budget | OpenCode shares the coordinator deadline and never starts an unfundable fallback. |
| Result reporting | preferred success, independent fallback success, no independent success | Public metadata names the actual reviewer and honestly distinguishes independent, degraded, and exhausted results. |

## Boundaries deliberately covered below the feature lane

- Exhaustive malformed-event and schema-field combinations belong in table-driven runtime tests.
- Absent, unsupported, and unauthenticated OpenCode installations share the same public fallback outcome; their distinct classifications belong in the capability-probe runtime matrix.
- Multiple complete results are invalid-output schema cases covered by the lower-level OpenCode event-parser matrix.
- Platform executable discovery, writable-ancestor trust, process-group cleanup, and byte limits reuse the existing reviewer-runtime contract tests with OpenCode cases.
- Live model/provider conformance stays opt-in because credentials are user-owned and CI cannot assume an authenticated OpenCode provider. The feature scenario proves deny-all invocation with a controlled reviewer; the pinned, credential-free OpenCode conformance lane proves the real runtime honors that denial against a local loopback provider.
