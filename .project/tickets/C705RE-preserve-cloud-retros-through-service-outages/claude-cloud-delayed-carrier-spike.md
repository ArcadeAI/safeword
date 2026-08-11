## Spike result: INVALIDATED

- Question: Can Claude Code Cloud's provider-managed delayed-message facility resume a completed task and run a bounded relay request without delaying the original builder result?
- Hypothesis: The Cloud-exposed `mcp__Claude_Code_Remote__send_later` tool can schedule one delayed continuation, so the follow-up execution is detached from task completion.
- Pre-spike base: `3d53d25c026f624a1840997237d6eea8f0ecde39`
- Proof command or walkthrough: A Claude Code Cloud task on `spike/claude-cloud-delayed-resume` attempted one `send_later` call with the tool's one-minute minimum delay. Its scheduled instruction was to run `bun .claude/spike-claude-cloud-delayed-carrier.mjs` and report completion. After the user approved in chat, one bounded repeat still failed before registration.
- Evidence: Both attempts were denied by Cloud's auto-mode permission classifier. No delayed message registered, the probe script did not run, and no repository files were read or changed by the Cloud task. The classifier treats conversational approval as insufficient; it requires a harness permission rule or a non-auto session mode.
- Constraints or wall: A project or local permission exception, a different session mode, or a trigger workaround would change the tested operating contract. The last two either require user configuration or attempt the same deferred-execution capability through another route, so they cannot prove zero-setup automatic delivery.
- Useful shortcuts: `send_later` has one-minute granularity. Cloud tool presence does not imply permission in auto mode, and user approval inside the conversation cannot lift the auto-mode classifier.
- Decision: Do not use Cloud delayed messages or triggers as the Safe Word carrier. Do not add a permission rule merely to make the spike pass.
- Production consequences: Keep all Claude Code Cloud public-retro routes disabled. The feature remains blocked on a Cloud completion carrier that is available by default in the normal auto-mode task environment and can prove a real public-ingest receipt. This result does not change the private relay or #1479's authentication boundary.
