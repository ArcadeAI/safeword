# Verification: Prevent advisory workflow drift before release

## Verify Checklist

**Static workflow validation:** ✅ Pinned actionlint v1.7.12 accepts the three generated installed workflows and disposable fixture; the invalid permission control fails.
**Reconciliation:** ✅ Default, missing, malformed, false, and literal-true configuration install zero or three workflows; disable removes exact scaffolds and preserves customizations.
**Runtime smoke:** ✅ A public fork PR exercised read-only inspection, trusted publication, scheduled re-evaluation, JSON artifact handoff, and the shared per-PR concurrency group.
**Secret boundary:** ✅ The random environment sentinel was present in inspection and absent from every write-capable probe; inspection's issue-comment write attempt was denied.
**Merge neutrality:** ✅ One ordinary marker comment remained; reviews, commit statuses, and mergeability were identical immediately before and after publication. The fork-event workflow's own completed check jobs were baselined before publication.
**Cleanup:** ✅ The public base repository and personal fork were permanently deleted after the proof.
**Release gate:** ✅ npm publication now needs both the build and the `pr-review-smoke` environment job.
**Documentation:** ✅ README names the environment secret, owner variables, local command, permanent cleanup behavior, and compatibility refresh procedure.
**PR Scope:** ✅ The branch changes are limited to the advisory review feature, its release-compatibility gate, tests, documentation, and ticket evidence; the prerequisite HXT3GW implementation and this YC6JCC hardening are separately committed.

## Live Evidence

- Fork-event run: `31116176245` — success.
- Trusted publisher run: `31116192147` — success.
- Scheduled-call projection run: `31116229231` — success.
- GitHub concurrency group: `pr-review-1` showed the publisher active and the scheduled call pending.
- Receipt: exactly one `<!-- safeword:pr-review-receipt:v1 -->` issue comment for the current head.
- Disposable repositories: `ArcadeAI/safeword-pr-review-smoke-1786030221495-aa60e589` and `TheMostlyGreat/safeword-pr-review-smoke-1786030221495-aa60e589`, both deleted.

## Local Evidence

- Workflow and smoke contracts: 2 files, 6 tests passed.
- Schema contracts: 1 file, 36 tests passed.
- Release contracts: 1 file, 4 tests passed.
- ESLint, TypeScript, Prettier, `git diff --check`, and release-workflow actionlint passed.

## Evidence Boundary

The smoke substitutes bounded probes only at unpublished Safeword CLI command
sites. Contract tests restore those probes and require the remaining router,
worker, publisher, and scheduled-call projection to equal their canonical
templates. Production model behavior is covered separately by HXT3GW's live
OpenAI scenario.
