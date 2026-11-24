# Behavior dimensions

| Dimension | Partitions | Proof / boundary |
| --- | --- | --- |
| Authority | trusted SGWMBS migration, legacy CKWE2D, author-only opt-in, unrelated ticket/scenario, author-written or same-actor review claim | Exact source-defined policy and authenticated separate-reviewer receipt; opt-in cannot grant permission |
| History | valid fixed cutoff/baseline, changed cutoff, unavailable ancestry, absent explanation, changed scenario | Existing real Git/excerpt checks and independent eligibility review |
| Host proof | original pass + assertion-killed mutation, surviving mutation, different assertion, uncaught exception/crash, setup/build/syntax failure, timeout, skip, retry, ambiguous selection, original fails on replay | Fresh structured runner reports; no exit-code-only acceptance |
| Isolation | committed archives, original and mutant separately built, external live output/server, untracked source | Exact committed snapshots and private Electron profile/server ownership |
| Input ownership | source/test/support/config/lock/policy/review unchanged or changed | Digests and authenticated response identity; no project-defined command |
| Commit movement | exact current row, new metadata commit, changed implementation | Every new HEAD reruns real original/mutant execution; unchanged review bytes alone can retain review approval |
| Aggregate closure | all required rows current, one missing/stale/foreign row, dirty tracked tree | Replayed rows and current committed aggregate signature |
| Compatibility | CKWE2D legacy data, ordinary TDD, new SGWMBS records | Do not reinterpret legacy receipts or relax existing hook decisions |
| Delivery surface | public CLI observation, generated Codex runtime, shared Claude/Cursor gate | Supported installation and parity checks, no cache patching |

Intentionally excluded: arbitrary enrollment, user-authored runner commands,
generalized test scheduling, automatic history creation, and replacing original
RED/GREEN/REFACTOR with retrospective evidence. Real-host proof is executed on
the supported local Electron host; unit boundary fixtures are described as
simulated execution and cannot be represented as that real-host evidence.

The scenarios tagged `@requires.real-electron-proof` require actual public
CLI observations on the supported Electron host, independently reviewed and
authorized, before their GREEN or feature completion can be claimed. Portable
Vitest contracts alone are insufficient. This tag is an acceptance obligation,
not a new runner routing mechanism. Generated host parity checks cover transport
wiring; the shared-runtime scenario does not claim separate native host runs.

Lower-level report contract matrices distinguish assertion matcher retries from
test retries or global timeouts: a Playwright matcher exhausting its wait at the
declared expectation can be valid discrimination; launch/setup/global timeouts
cannot. Policy validation binds canonical repository identity plus fixed-cutoff
ancestry. Untracked files are never archived; unrelated untracked files do not
invalidate an otherwise clean committed proof. Declared untracked inputs do.

The changed-input contract matrix binds test source and selection, mutation and
assertion definitions, implementation and declared executable support to the
proof-review fingerprint; eligibility baseline/scenario/explanation bytes bind
the eligibility-review fingerprint. Changing a reviewed target or context needs
its fresh review. Changing only HEAD retains unchanged reviews but always needs
fresh original/mutant execution. The execution, selection, anchoring and unsafe
preparation outlines are representative refusal classes; their detailed parser
permutations belong in lower-level report/request contract tests.
