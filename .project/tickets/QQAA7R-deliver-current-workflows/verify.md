# Release preparation evidence

**PR Scope:** ✅ Compared against current source 22307b60d: version-only sources,
generated native-plugin carriers, required dogfood version metadata and this
release ticket. No dependency resolution or model behavior changes in this PR.

The current local results are in the final section. The preparation history
below records superseded failures and missing evidence; it does not describe
current readiness. Current external merge gates are hosted CI for the final
head, source-first ordering, release retargeting and the PR readiness checks.

## Historical preparation log

All three hand-edited version sources and generated native plugin identities
are 1.2.0. All five surfaces regenerated after the source compatibility fix.
Version-sync and check:claude-plugin pass. The lock differs in only the CLI
workspace version; replacing that value yields byte equality with the base.
Frozen installation succeeds. The production-retro readiness manifest is false,
so its protected release job is expected to skip.

The first release run found stale .safeword/version and passed 80/81 tests.
Synchronizing project metadata through the installer corrects that mismatch.
The following run passed 76/81, with five timeouts in native-plugin checks.
A direct standalone Claude check returned aligned, exit 0, in 117.84 seconds.
No test timeout was increased and no test was skipped or weakened. Exact-head
hosted CI must pass all release checks before the PR merges.

The installer updated project metadata but could not activate unpublished 1.2.0
in the existing native profiles. That is not a successful installed-cache update.
The old installed version remains the supported fallback until publication.
The installer also reordered .claude/settings.json keys; that unrelated churn
was restored. No source templates or profile settings were hand-edited.

After waiting for the shared lock, all five deterministic Codex activation
tests pass. The isolated authenticated packaged-cache smoke passes with explicit
gpt-6-luna (one cache test passed; the separate opt-in migration case was not
requested and skipped). The smoke proves all five cached hook events and
correctly leaves Desktop activation pending. Logs: release-activation.log and
release-live.log in .project/tmp. Earlier exit-75 attempts started no tests.
This is isolated-cache evidence, not a successful upgrade of the user profile.

At this earlier stage, hosted CI, activation/cache evidence and independent
review were outstanding. The current section below supersedes that list:
activation/cache and local review now pass; current-head hosted CI, source-first
ordering, release retargeting and the PR readiness checks remain merge gates.
Publishing, stable promotion and a supported installed-plugin upgrade are
separate from the requested admin merges.

## Review coverage limitation (historical, before authorization)

Independent Claude/Opus review 62672243-76cd-4cec-a1a0-0de645c3e1af approved all
version carriers and the bounded lock diff/normalized whole-file proof. The
coordinator refuses bun.lock as a logical target because it exceeds 262,144
bytes. Context proof does not count as file coverage for an implement stamp.
That stamp is not recorded and this task remains in implementation.

A proposed generated-file annotation was independently rejected by review
568204e4-806b-446c-b435-9aea4d120385 because it could hide future dependency
resolution changes. It was reverted; .gitattributes and reviewGate are unchanged.
No receipt was fabricated and no independence claim was weakened. A permanent
bounded lock-diff review capability or explicit one-time human exception is
needed before implementation can advance under this gate.

Receipt lookup also needs a published distribution: .safeword/version is 1.2.0
but that package is not published yet. The actual installed, unmodified 1.1.0
runtime can report the signed review successfully; use that distribution route
for release bootstrapping, never an unauthenticated project-supplied substitute.

## Refresh on the reviewed source (historical: 807c87b23)

Merged source 807c87b23 (including main 25b548622) without rewriting the published
release branch. The only conflict was generated plugin identity; canonical
regeneration resolved it and verified all five surfaces. All version sources
and native identities remain 1.2.0. Current proof: frozen install checked 1,088
installs with no changes, 81/81 release contracts pass, version-sync and explicit
Claude-plugin release checks pass, and 276 parity pairs/11 contracts pass.
The normalized full lockfile equals source 807c87b23 byte for byte after only
the workspace version is reset to 1.1.0; actual size 343,758 bytes. No resolution,
review policy or generated-file attribute changed.

Logs are .project/tmp/release-current-source-{generate,install,contracts,parity}.log
and release-current-lock-proof.json. Old bb711 hosted CI and isolated-cache
activation results remain historical; new release-head CI and fresh review are
required. No current Desktop activation or supported profile upgrade is claimed.
The task stays implement/in_progress because bun.lock exceeds the 262,144-byte
logical-target cap and context does not count as coverage. No exception was
received. Do not promote, merge or publish based on these local checks.

## Refreshed bounded review and cache proof (historical: fc4a999d)

Independent Claude/Opus review 74d87e9f-87c2-4ef5-8773-8e0ce38e76f3 approves
43 logical branch files with no errors; two generated CLI bundles are excluded
normally. bun.lock remains the sole non-generated coverage gap, not a reviewed
file. The new ticket timestamp is corrected. Parent source closure remains
gated on final-head CI on PR5924. Ordinary offset cleanup and the deferred
mutation are already disclosed limits; no new production state-root setting
was added for the fixture.

Fresh deterministic activation checks pass 5/5. The isolated authenticated
packaged-cache smoke passes 1/1 with explicit Luna and a thin launcher that adds
only low reasoning to the real pinned Codex binary. No command or output is
faked; the generated cache runtime and hook commands are unchanged. All five
hook events are proved after package sources are removed; Desktop activation
correctly remains pending. The separate opt-in migration case remains unrequested
and is skipped by its existing guard. Logs: release-current-activation.log and
release-current-live.log. User profile, supported cache selection and installed
version remain unchanged. New release-head hosted CI is still required.

## Authorized exception and merge refresh

Both prior-head full CI runs completed successfully: source 807c87b23 at
39086671410 and release fc4a999d at 39087457919. Node 22 and 24 package and
release checks pass; the configured Node 24 acceptance lane passes 596
scenarios and 11,118 steps plus 50 proof checks. These are historical once
the branch head changes; the PR must link refreshed current-head results.

On 2026-10-18 the user authorized the pending one-time version-only lockfile
coverage exception and admin merges of PRs 5924 and 5925, followed by a durable
review fix. The implementation ledger records a deliberate skip, not a claimed
independent approval of bun.lock. Its exact 343,758 bytes have SHA-256
9ab7cb7fb7c09bcf7d5facb84a600be57ca0abe4bdbd322331ee5b838dbecb9d; replacing
only workspace version 1.2.0 with 1.1.0 makes it byte-identical to the source
branch lockfile. Review 74d87e9f covers the other logical targets. No dependency
resolution or standing review policy is waived. Main has since advanced to
1da75093f, so generated merge resolution, fresh checks, retargeting and final
head review remain necessary before merging. Publication and profile upgrade
are separate from the requested admin merges.

## Current local verification: source 22307b60d, main 1da75093f

The combined source passes 383 targeted tests, root lint/types, all five
generated-surface checks and independent review 23f564f2. A fresh real Stop to
source CLI to installed Codex probe passes with default Luna: silent success,
zero findings, offset 1079/toolUses 8/fires 1 committed exactly once, no-growth
skip, and no draft or filing. Review warnings about timeout cleanup and broader
installed/finding-bearing paths remain explicitly bounded in the source PR.

The release regenerated all five surfaces successfully. Current release
contracts pass 81/81; deterministic activation passes 5/5; version sync and
parity pass. The current isolated packaged-cache smoke passes 1/1 in 93 seconds
using the real pinned Codex with Luna low. Its separate migration test is
unrequested and skipped. Package sources are removed before cached-hook proof;
all five hook events pass, with Desktop activation correctly left pending.
No supported user profile or installed-cache selection was changed.

Whole-lock normalization against source 22307b60d still proves that only the
workspace version changes. Independent review bf02b32c approves the bounded
43-logical-file packet with no errors; its contradictory historical-state
wording was corrected or explicitly labeled historical. The pending source
and release admin merges have direct human authorization. The ledger records
the lockfile exception honestly, with no standing policy or generated-file
annotation change. This ticket tracks completed local release preparation;
current-head hosted CI, source-first ordering and release retargeting remain
mandatory external merge gates in the PR body. No publication is claimed.

Current raw logs are retained under .project/tmp in this release checkout:
source-refresh-focused.log (383 tests), source-refresh-lint.log,
source-refresh-real-stop.json, release-refresh-generate.log,
release-refresh-contracts.log (81), release-refresh-activation.log (5),
release-refresh-live.log (1 pass, 1 unrequested migration skip) and
release-refresh-parity.log. Final hosted CI links belong in PR5925 at its exact
head, so documentation-only evidence does not trigger a new verification loop.
Fresh install checked 1,088 installs with no changes; its log is
.project/tmp/release-refresh-install.log. Version sync was rerun successfully
and retained .project/tmp/release-refresh-version-sync.log (no diagnostic output
on success). The refreshed .project/tmp/release-refresh-lock-proof.json records
source 22307b60d77bbc4349790ceead331d4976043463, size 343,758 bytes and SHA-256
9ab7cb7fb7c09bcf7d5facb84a600be57ca0abe4bdbd322331ee5b838dbecb9d. That is
identical to the file named in the authorized exception; normalization still
proves that no dependency resolution changes. Full current review IDs are
23f564f2-6f2a-4e3e-94cd-a10901b02728 (source) and
bf02b32c-4a67-4983-8043-991835d934b4 (bounded release packet).

Human authority is the direct user instruction in this Codex conversation on
2026-10-18, not an approving GitHub review; it is not represented as one.
