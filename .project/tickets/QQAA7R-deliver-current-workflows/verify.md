# Release preparation evidence

**PR Scope:** ✅ Compared against source b352845a8: version-only sources,
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
