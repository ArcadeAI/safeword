# Named unmapped-case recovery proof

Run `scripts/dev node --import tsx --test --test-concurrency=1 packages/cli/tests/integration/bounded-observation-profile.node.ts`.

The real CLI proof builds a disposable Bun distribution from a committed copy of
the current source, with one shipped mapping row removed. It leaves the project
feature census and registration unchanged. The public request carries no extra
flags or supplied reports. Preflight refuses without a runner report, but its
message is only `Unsupported or unmapped delivery case; review a complete shipped mapping`.
It does not name the actual case that the maintainer must repair.

The intended RED literal is:

`Unmapped-case refusal must name the exact case identity`

The proof requires the omitted case's actual identity in the actor-visible
message and checks execution-only authority, the reviewed complete-mapping
recovery and absence of execution/preparation. This is the accepted unmapped-case
scenario and shipped-profile matrix, not permission for caller-selected maps.
No historical record, delivery test or deferred case is edited.

Cross-agent review 0ae429b2 approved the original RED with two useful warnings.
The refined proof now excludes all 36 still-mapped identities from the refusal,
so a census dump cannot satisfy the missing-case check. It also executes the
complete-mapping recovery, report-absence and retained-diagnostic checks before
the intended failing assertion. The changed proof needs a fresh receipt before
GREEN; the earlier receipt is retained as history.
