# Proposal under review — exact preceding answer

Yes—IDE and CLI need separate integration checks, but they should share Safeword’s implementation and behavior tests.
Cursor offers the same Agent/Plan/Ask modes in both, but a successful CLI run doesn’t establish that the IDE loads the plugin, fires its hooks, or continues unfinished work correctly. That’s why we checked both.
For “agents,” the useful distinction is where and how they execute:

- IDE and CLI: Plugin loading, permissions, hooks, continuation.
- Cloud agents: Installation and enforcement in their remote environment.
- Subagents: Required context, restrictions, and completion handling across delegation.
- Different models or named agents: No full duplicate suite merely because the name/model changes.
Cloud agents run in isolated VMs; subagents have separate context windows, so neither should automatically inherit a “works” claim.
The architecture should be: define behavior once, test shared policy once, then run a small reusable compatibility suite at each execution boundary.
The separate checks were necessary. The amount of manual IDE setup has been excessive; routine development should use automated CLI/shared tests, with focused IDE compatibility checks. Safeword should manage that distinction for you.

# Review questions (not changes to proposal)

Review this conceptual testing/architecture proposal, not the entire unfinished feature or implementation. Does the wording permit false coverage, automatic scope expansion, inadequate model-sensitive workflow validation, or needless duplication? Is it aligned with the accepted contract scope? Give concrete actionable errors; distinguish nonblocking clarification from errors. Cloud is excluded from the accepted ticket's new delivery claims; evaluate whether the answer should clarify that. Do not infer implementation completed from this proposal. No new code entry points.
