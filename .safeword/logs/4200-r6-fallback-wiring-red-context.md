# R6 retrospective wiring RED

This is a retrospective reproduction of the missing Cucumber bindings, not a
claim that production recovery was broken. The packaged BDD TDD guide explicitly
permits undefined/pending feature steps as the initial wiring RED. The new
bindings and ordering controls are already committed in 85e9ee5a1; no earlier
RED chronology is invented. GREEN annotation was refused until independent
executable RED approval exists, even with a truthful characterization RED skip.

The disposable source snapshot at
`.safeword/tmp/4200-fallback-red-41e38e3e1` is `git archive 41e38e3e1`, the actual
published pre-binding head. Its step tree genuinely lacks the new fallback-order
module. Only the current accepted feature test source is copied in, so the same
three examples run against the missing implementation bindings. No production
source or existing binding was removed or weakened. The source/template and two
retro package diffs between that baseline and current committed HEAD are empty.
Installed dependencies and compiled distributions are linked from the same
pinned local build; production source is identical. The repository's original
scripts/dev launcher supplies its trusted Bun/Node pins while retaining snapshot
cwd. An untrusted copied mise config and then missing untracked distributions
caused two infrastructure failures; neither is RED evidence. The ready run has
three undefined scenarios and nine undefined steps with completed background
steps, not an import failure, timeout, or dry-run.

Exact command, from snapshot cwd:
`../../../scripts/dev node --import tsx node_modules/.bin/cucumber-js
features/keep-plan-reviews-current-and-trustworthy.feature
features/keep-plan-reviews-current-and-trustworthy.feature:211:212:213`.
Expected failure literal: `Undefined scenarios:`. The independent coordinator
must execute and attest this command itself; the retained author run at
`/tmp/4200-r6-fallback-captured-baseline-red-ready.log` is supporting evidence only.

Current source passes fourteen related root cases (798 steps) and fifty proof-tag
checks. Final proof-quality review 47ec610b-f46f-40c4-b657-663efbd97ca9 approves.
All three examples retain actor-visible typed failures, ordering, valid premature
later-tier refusal, authenticated same-job recovery, and explicit host-context
limits. Do not interpret a wiring RED as a functional regression demonstration,
live-host evidence, or completion of other scenarios.
