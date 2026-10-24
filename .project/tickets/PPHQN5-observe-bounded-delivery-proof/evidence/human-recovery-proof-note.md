# Human-readable dirty-input recovery proof

The accepted dirty-input scenario and CLI surface require a named changed input,
a request to commit or clean it, and one concrete recovery action. The new Node
proof invokes the real CLI in human mode on a disposable committed candidate
with one uncommitted proof configuration edit. It does not start the fixed lane.

Run `scripts/dev node --import tsx --test --test-concurrency=1 packages/cli/tests/integration/bounded-observation-human.node.ts`.

Exit code 2, execution-only purpose, the exact changed file, and commit-or-clean
instructions already pass. The output ends with a command to verify the refused
attempt. It omits the fixed observation request that can recover after cleanup.
The intended RED literal is:

`Human refusal must name the fixed observation recovery command`

This is a real human-rendering omission in the accepted recovery behavior,
alongside the already-passing JSON dirty-input control. It adds no scenario,
caller option, closing authority or historical RED credit.
