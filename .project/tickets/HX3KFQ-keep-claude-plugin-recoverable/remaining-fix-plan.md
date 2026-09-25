# Remaining fix plan

## Problem

Failures before `verifyPlugin` runs still use `startupFailure`, which returns exit 2 for every known
event except `UserPromptSubmit`. On `PreToolUse`, Claude treats exit 2 as an unconditional denial, so
a missing or unresolvable `CLAUDE_PLUGIN_ROOT` can block every command needed to repair the plugin.

## Approach

Route failures that happen before `verifyPlugin` through the same event-aware degraded response as
verified cache damage. `PreToolUse` is the sole structured-`ask` event. `UserPromptSubmit` continues
with an advisory. Every other supplied event, including future events unknown to this runtime,
continues with an exit-0 stderr warning. Only an invocation with no event argument retains a hard
failure because the dispatcher cannot identify which host contract applies.

Keep the trust boundary unchanged: startup recovery never runs configured hooks or reads executable
policy from the unverified plugin cache. Prove the behavior through the real dispatcher process with
this event matrix: `PreToolUse` returns `ask`; `UserPromptSubmit` returns an advisory; `SessionStart`,
`PostToolUse`, and `Stop` return exit 0 with stderr; an arbitrary future event follows that same
warning path; and an invocation with no event returns exit 2. Exercise both missing and unresolvable
`CLAUDE_PLUGIN_ROOT` values across the matrix without duplicating every equivalent combination.

The exit-0 warning branch is deliberately less visible than the current exit-2 error on lifecycle
events. That matches the accepted verified-cache-damage behavior and avoids changing host control
flow; `PreToolUse` remains the visible recovery signal. Startup error details may include the
host-supplied plugin path, matching the existing damaged-cache diagnostics inside the same trusted
host boundary.

Add one release regression that places an unexpected file at the generated plugin root and asserts
that Claude plugin generation in `--check` mode fails with `unexpected <filename>`. This protects the
existing guarantee that release validation and runtime inventory enforcement cover the same whole
plugin tree. Do not replace or duplicate the generator's current whole-tree comparison.

## Verification

Run the focused dispatcher and release-contract tests, regenerate the Claude plugin, run generated
payload drift checks, then run the repository's full verification, audit, refactor review, and final
quality review in that order.
