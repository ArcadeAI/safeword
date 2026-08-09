## Spike result: PARTIAL

- Question: Can Claude Code Cloud run a completion carrier that posts and receives a public relay receipt within 500 ms?
- Hypothesis: A documented Cloud lifecycle hook can perform the bounded relay exchange before its task ends.
- Pre-spike base: `53b4fa479591c0efba7bad981d9ed60fd37215a7`
- Proof command or walkthrough: A new Claude Code Cloud task on `spike/claude-cloud-carrier-health` ended immediately. Its synchronous `Stop` hook made one `fetch` request to Railway's `/health` endpoint with a 450 ms abort deadline and wrote the result to `.project/tmp/claude-cloud-carrier-health.json`.
- Evidence: Cloud wrote `{ "marker": "safeword-claude-cloud-carrier-v1", "completedAt": "2026-08-09T16:25:18.802Z", "elapsedMs": 452, "outcome": "unreachable", "errorKind": "TimeoutError" }`. The marker proves the Cloud `Stop` hook ran; no response arrived before the conservative deadline. The same probe returned HTTP 200 in 311 ms locally, so this is Cloud-path timing or egress behavior, not a malformed endpoint.
- Constraints or wall: The deployed service has no public receipt endpoint yet, so the probe could validate only the existing `/health` leg. It cannot prove an end-to-end public-retro receipt. With one Cloud task budgeted, there is no second measurement to distinguish transient network delay from a consistently slow or restricted Cloud egress path.
- Useful shortcuts: A Cloud `Stop` hook can write local evidence. It must therefore be treated as an available lifecycle carrier, but not as a delivery-confirmed one.
- Decision: Do not ship a Claude Code Cloud completion path that waits for a relay receipt during `Stop`. Keep Cloud submission disabled until a separately bounded experiment proves a detached completion carrier or a durable Cloud-native handoff.
- Production consequences: Re-plan C705RE so local harnesses may use the planned bounded relay protocol, while Claude Code Cloud has no public-ingress sender in the first release. The public receiver, quarantine, and operator recovery work remains independently useful, but its acceptance criteria must not claim Cloud delivery.
