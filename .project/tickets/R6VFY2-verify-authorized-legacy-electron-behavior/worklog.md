# Implementation work log

## Root Cause: policy imported the private cutoff mechanism

The existing import-boundary regression failed during the snapshot protection
run on 2026-11-23. The new policy module imported the history core solely to
inspect the Git remote. That violated the existing rule that only the pinned
history entry point can reach the cutoff override mechanism.

Confirmed by the failed source inventory: the extra importer was
`retrospective-policy.ts`. Ruled out an obsolete test: the private cutoff
boundary is still required for both enrolled migrations. Ruled out the new
archive helper exports: none imports the history core. Keep the test unchanged;
perform Git inspection in the existing history entry point and make remote
matching a pure policy operation. This is a local implementation regression,
not a change to the feature's accepted scope or ticket type.

## Real-host refusal: existing compatibility links

The first supported installed observation refused input before Electron launch:
`Proof input must be a regular file without symlink components: packages/desktop/src/services`.
The installed bundle matched the generated source. Git tree inspection confirmed
exactly two existing desktop links: `src/services -> renderer/src/services` and
`src/stores -> renderer/src/stores`. Both predate this exception. No actual
original/mutant execution or verification credit resulted from this attempt.

The live installed probe is the actual failing reproduction for this correction.
The more representative portable fixture was queued behind another checkout's
Vitest run. Its queued log filename is not a RED receipt: production repair
proceeded from the already observed live failure, and portable protection will
be reported only with its actual eventual outcome.

Investigated filesystem traversal safety, committed Git structure, and review
binding. [Node's filesystem API](https://nodejs.org/docs/latest-v24.x/api/fs.html)
distinguishes link metadata from following a link; [Git's tree format](https://git-scm.com/docs/git-ls-tree)
records the committed link separately from its target files.

Decision: pin these two exact compatibility aliases as trusted policy metadata,
validate their literal targets and canonical containment in the committed source
and both archives, and bind that metadata through the policy digest. Requested
test, implementation, and support inputs remain contained regular files. Their
canonical target files are included in the regular executable-input hashes.

Rejected skipping every symlink: an alias could change executable resolution
without invalidating reviewed inputs. Rejected general contained-link support:
this migration does not authorize author-selected aliases. The only new call
site is the Electron adapter; the legacy regular-file reader remains unchanged.
Premortem: a future repository cleanup removes an alias. Refusal is intentional
until the source policy and independent review are renewed; no general alias
framework or additional dependency is needed.

The candidate installed run passed alias validation and reached the independent
frozen install, which refused a different problem: canonicalizing the `pnpm`
shim invoked `mise install --frozen-lockfile` instead of pnpm. This is still a
failed observation, not a mutation kill. The generated candidate was installed
through `codex plugin add`; lifecycle fixture verification from `--fix` could
not start because another checkout owned the package-test lock. No five-surface
verification success is claimed for that regeneration attempt.

## Subsequent executable checks

Preserving the validated external pnpm launcher name corrected mise dispatch.
The next real run installed and built successfully, then exposed the runner's
incorrect preload filename. Soulless's committed configuration and main process
both name `out/preload/index.cjs`; the runner and portable fixture now match.
The following live attempt passed its original and reached the mutant's declared
assertion location, but refused the assertion-message format. No observation was
issued. A standalone Playwright 1.62.1 equality matcher confirmed its object-diff
headers omit scalar-label colons, and a separate synthetic contract probe failed
in the current evaluator. This is formatter research, not an Electron proof.

The queued runner protection finally executed: 10 tests passed, including the
exact compatibility links, external multi-call launcher, correct preload layout,
independent installs/builds, untracked exclusion and failure cleanup. Its log's
earlier RED-oriented filename does not change that actual GREEN-only outcome.

Independent report/request review `ce3d5e88-18bf-4d0b-9c1b-695b943ef037`
(Claude Opus, cross-agent) requested changes for missing one-variable mutation
refusals and missing original-pass refusals. Those characterization matrices are
written; their execution and the object-diff regression remain pending. Warnings
about scenario/title binding and nested file selection also remain to resolve.

The expanded contract suite subsequently ran: 71 cases passed and the new
object-diff case failed for the intended unsupported format. After supporting
both scalar labels and equality-diff headers, all 72 contract cases passed.
Combined focused protection passed 105 tests; the final report-helper cleanup
was protected by 92 report/runner/legacy/CLI tests. Types and all five generated
surface checks passed. The next live run still refused message evidence after
reaching the declared assertion, so current Electron observation remains RED;
additional diagnostics must identify the remaining mismatch before any credit.

## Remaining delivery

- [ ] Implement and protect independent Electron snapshot execution.
- [ ] Expose and prove the installed public observation command.
- [ ] Add authenticated row failure records and exact-set closing replay.
- [ ] Run all 17 actual original/mutant proofs and independent reviews.
- [ ] Complete verification, audit, refactor, and PR readiness.

Original Soulless historical entries remain unchanged. Portable fixture reports
are process-wiring protection and never substitute for real Electron evidence.
