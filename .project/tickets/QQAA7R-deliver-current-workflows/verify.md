# Release preparation evidence

**PR Scope:** ✅ Compared against current source 807c87b23: version-only sources,
generated native-plugin carriers, required dogfood version metadata and this
release ticket. No dependency resolution or model behavior changes in this PR.

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
hosted CI must pass all release checks before this ticket is complete.

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

Remaining work: obtain current-head hosted CI, activation/cache evidence,
independent implementation/verification review, verified ticket closure and the
seven readiness gates. Only then promote. Publishing, stable promotion and the
supported installed-plugin upgrade remain post-merge work.

## Review coverage limitation

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

## Refresh on the reviewed source

Merged source 807c87b23 (including main 25b548622) without rewriting the published
release branch. The only conflict was generated plugin identity; canonical
regeneration resolved it and verified all five surfaces. All version sources
and native identities remain 1.2.0. Current proof: frozen install checked 1,088
installs with no changes,81/81 release contracts pass, version-sync and explicit
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

## Refreshed bounded review and cache proof

Independent Claude/Opus review74d87e9f-87c2-4ef5-8773-8e0ce38e76f3 approves
43 logical branch files with no errors; two generated CLI bundles are excluded
normally. bun.lock remains the sole non-generated coverage gap, not a reviewed
file. The new ticket timestamp is corrected. Parent source closure remains
gated on final-head CI on PR5924. Ordinary offset cleanup and the deferred
mutation are already disclosed limits; no new production state-root setting
was added for the fixture.

Fresh deterministic activation checks pass5/5. The isolated authenticated
packaged-cache smoke passes1/1 with explicit Luna and a thin launcher that adds
only low reasoning to the real pinned Codex binary. No command or output is
faked; the generated cache runtime and hook commands are unchanged. All five
hook events are proved after package sources are removed; Desktop activation
correctly remains pending. The separate opt-in migration case remains unrequested
and is skipped by its existing guard. Logs: release-current-activation.log and
release-current-live.log. User profile, supported cache selection and installed
version remain unchanged. New release-head hosted CI is still required.
