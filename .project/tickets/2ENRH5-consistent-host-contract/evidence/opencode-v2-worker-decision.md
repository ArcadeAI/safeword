# Preserve canonical worker restrictions through native V2 delegation

## Investigation plan

Decide how a plugin guidance entrypoint can retain fresh worker context and the
canonical Read-only reviewer authority without inventing named-agent creation.
Research the exact SDK's agent/delegation API, request-scoped tool enforcement,
and canonical worker ownership. Compare native generic delegation with scoped
session hooks, a custom delegation tool, and generated named-agent config.

## Evidence

The exact SDK agent editor can update existing agents but cannot add one. The
native subagent tool creates a new child when sessionID is absent and accepts
no per-call tool mask. Its public session context hook can remove tools from
an individual request. Canonical safeword-reviewer declares tools: Read and
prohibits commands, mutation and delegation. The retro-filer has no explicit
tool allowlist; its existing sealed spool and egress authorities remain shared.

The real 2.0.32 CLI experiment at
`/tmp/safeword-2enrh5-targets.aOFAud/opencode-v2-worker-ppNdGB` observes a
distinct native general child and no parent-only nonce in any child request.
Prompt-only Read guidance still permits the child to execute a shell sentinel
write. This is research evidence of the missing restriction, not a contract
receipt or a production bridge result.

A separate disposable mechanism experiment at
`/tmp/safeword-2enrh5-targets.aOFAud/opencode-v2-worker-controls-s9ot7D` removes
non-read tools for that child through the context hook. A deliberately
noncompliant model still emits the shell call. The actual host rejects it with
"Tool is not available for this request: shell" and the sentinel stays absent.
The parent retains its normal tools. This plugin supplies test-owned controls:
it proves SDK mechanics only and cannot certify Safeword enforcement. Add a
permitted read contrast and independent CLI/TUI proof through production next.

Sources:

- [Exact native subagent implementation](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/tool/plugin/subagent.ts).
- [Exact Promise session hooks](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/plugin/src/promise/session.ts).
- [Exact agent semantics](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/agents.mdx).

## Decision

Generated named-agent config would provide familiar names and native permission
rules, but introduces another registration surface and diverges from the
accepted guidance bridge. A custom delegation tool could create child sessions
with permissions, but would duplicate native foreground/background completion,
cancellation and parent linkage. Neither is needed for the accepted soft worker
semantics.

Use the native generic delegation entrypoint with a canonical worker identifier
in its guidance prompt. Resolve procedure and declared tool authority from the
single packaged canonical definition; translate only host tool names. Scope
the context tool mask to the actual native child, preserving unrelated parent
and generic-worker requests. Do not infer review independence or grant egress
authority from delegation. Do not change the generic agent's global settings.

Premortem: identifying a worker by incidental prose could restrict an unrelated
session or miss the intended child. Use an explicit bridge marker and actual
child identity, and prove the parent keeps its tool authority.

Next: add native fresh-context and paired Read/forbidden-action proof before
production bridge implementation. A real forbidden side effect is RED; setup
failure is unavailable. Preserve the already-passing freshness baseline.


## Executable RED preparation

The shared native-opencode command now runs the worker component after its
unchanged Cucumber shell guard component. Author run:
`/tmp/safeword-v2-worker-group-red.log`; shell guard component passes both
scenarios / eight steps, plus V1 controls. Both actual worker runtimes pass
freshness and permitted packet Read, then fail specifically because the native
shell creates worker-forbidden.txt. No test-owned hook supplies a denial. The
candidate is the committed shell-only carrier native-v2-green-4. Missing
worker restriction is V2_WORKER_FORBIDDEN_ACTION, exit 2; infrastructure stays 3.

This is the additional worker denial population of the existing "A denied
action has no side effect" outline, with the shared canonical reviewer's Read
allowlist as policy input. The accepted PR 2 task 2 explicitly requires this
supporting native worker proof without adding a Gherkin scenario. It does not
replace the outline's other required host cases or claim catalogue completion.
GREEN must preserve fresh context, prove a permitted Read returns the unique
packet bytes, block the actual malicious shell call even when the model emits
it despite the advertised mask, leave its sentinel absent, and preserve parent
authority. All authority comes from the shipped canonical worker definition;
the test supplies only synthetic input, model tool requests and observation.

The new scripted model transport is shared with the existing write probe;
owned native setup/process execution and observational plugin are shared too.
The native group regression above rechecks the unchanged allowed/denied
behavior after that test-fixture extraction. CLI typecheck and targeted ESLint
pass. The queued population regressions eventually ran after the foreign
Vitest owner finished: three files / 13 tests passed in 113 ms.
