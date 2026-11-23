# Executable Resource Contract for Native Plugin Bundles

**Status:** Accepted
**Date:** 2026-09-13

**Context.** The standalone CLI bundled into the Claude and Codex plugins resolves one canonical, flat `templates/` tree. Their generators instead emitted host-shaped subsets: Claude split resources across `resources/`, `skills/`, and `runtime/hooks/`, while Codex emitted only a handbook and hooks under `templates/`. The inventory checks passed: every file the generators emitted had the expected bytes. The checks never ran the bundled CLI to verify it could find its resources. Separately, Claude treated every cache-integrity failure as exit 2, so PreToolUse denied the repair tools needed to recover the cache.

**Decision.** Both native plugin generators package the complete canonical `templates/` tree in addition to host-native resources. Release tests execute `ticket new` and `install` from each generated payload in a clean repository; catalogue assertions cover key resource classes but do not substitute for execution. Any Claude cache-integrity failure remains a hard failure to trust or execute Safeword hooks. For PreToolUse only, degraded mode returns Claude's structured `ask` decision with repair guidance so a human may explicitly authorize diagnostics or repair; other lifecycle events warn without running unverified hooks.

**Consequences.** Packaging resources in both layouts makes the bundles larger. The host workflows and standalone CLI can now use the same source templates. A damaged cache cannot silently run or automatically permit a mutation, yet it no longer creates an unconditional denial loop. Missing, modified, and unlisted files all remain visible as integrity failures.

**Alternatives.** Teach the runtime to reconstruct one root from host-shaped paths: rejected because required resources are absent as well as relocated, and the split trees do not form one unambiguous flat root. Reshape host-native resources only: rejected because it would couple native discovery layout to the CLI's install layout. Ignore unlisted extras: rejected because auto-discovered skills can be behaviorally active. Keep exit 2 for damaged PreToolUse: rejected because it prevents in-session recovery.

**Reassess when.** The bundled CLI receives an explicit resource-provider abstraction, either host exposes a canonical package-resource API, or Claude introduces a dedicated recoverable plugin-health decision separate from PreToolUse authorization.

**Implementation.** Ticket `HX3KFQ`; native plugin generators and catalogues, generated payloads, dispatcher degraded mode, generator drift checks, and executable release-contract tests.
