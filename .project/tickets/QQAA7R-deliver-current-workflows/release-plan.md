# Release plan: 1.2.0

Prepare a version-only release PR stacked on the Luna source PR #5924.
Do not publish until both exact reviewed heads are merged. Retain branches and
worktrees; no cleanup is authorized. Normal merge authority does not authorize
bypassing the repository's required approving review.

## Version choice and scope

npm latest and stable are 1.1.0. No v1.2.0 tag exists. Since that stable release,
main adds checked PR-Ready and planning/checklist commands and quality gates,
plus bug fixes. Existing features without new M1 markers are grandfathered;
tasks and patches bypass feature-only authorization (7CAMAD impl-plan.md).
The local versioning skill classifies additive commands/gates as minor, so use
1.2.0. This PR introduces no additional behavior or dependency upgrades.

Review 89006760-0ba2-402e-a946-59c535a1afdc rejected the initial unconditional
reasoning flag as potentially breaking. Correct the source dependency instead
of shipping a major release: only gpt-6-luna pins low reasoning; all other
configured model names keep their previous reasoning behavior. Three regression
assertions failed before that correction and all 143 targeted tests pass on
the corrected source checkout. This release checkout still needs the final
source commits before its implementation evidence is valid. Do not claim
universal model/account compatibility.

## Preparation and proof

1. Bump packages/cli/package.json, .claude-plugin/marketplace.json and the Codex
   plugin manifest, then regenerate all five surfaces. Never hand-edit bundles.
   Initial generation completed after the source test lock was released, but
   must be repeated after bringing in the final compatibility correction.
2. Refresh workspace lock metadata without changing dependency resolutions.
   Bun 1.3.14 install and --lockfile-only retained the old workspace version;
   correct that single workspace metadata value, then require a successful
   frozen install. Keep the resolution graph byte-identical.
3. Run release contracts, generated freshness and parity; prove deterministic
   Codex activation and the authenticated opt-in cache smoke with gpt-6-luna.
   One Vitest process at a time. The generator's lifecycle proof could not
   acquire the source checkout's test lock on its first attempt; it did not
   start a second Vitest. A queued retry completed all five surfaces.
4. Obtain independent review, publish a Draft release PR and collect current-head
   CI, then promote only with complete readiness evidence. Rebase onto the final
   source head before this evidence is gathered. Any later rebase/head change
   invalidates it and requires refreshed review and exact-head CI. After source
   merge, retarget to main and recheck the base; do not reuse evidence if the
   effective diff changes.

## Publish and recovery

After both merges, create annotated v1.2.0 on the exact release merge commit
and push it. Observe the Release workflow's OIDC npm publication, registry
version and stable-channel promotion. No local bun publish. Do not move an
existing release tag or retry a merge blindly.

Only after publication and stable promotion, run the supported Codex marketplace
upgrade and plugin add commands for safeword@safeword. Verify installed version,
bundled runtime and headless activation. A headless process does not establish
that this already-running Desktop session restarted; report any pending host
activation honestly. Preserve the existing cache until the supported installer
replaces the active selection. Release failure, stale stable or failed upgrade
means keep the prior installed version and report the exact recovery action.

Official model guidance and Luna access were checked on 2026-10-17 in the
source task; the release live smoke will explicitly record gpt-6-luna. Headless
activation remains distinct from a fresh Desktop host activation receipt.

## Intake review disposition

Independent Claude/Opus review c58756b4-5542-4141-8029-0328ea62624c approved
intake after the compatibility correction was planned. Its warnings are answered:

- The default change is a bug fix: gpt-5.5 returned HTTP 400 with the observed
  ChatGPT login; Luna restores extraction. It adds no user step or config key.
  Other configured models now keep their previous reasoning behavior, so the
  identified override compatibility risk is removed rather than shipped.
- The exact lock proof is a whole-file equality check: replace the single CLI
  workspace version 1.2.0 with 1.1.0 and compare every byte against git show
  ae5111146:bun.lock. It passed, as did frozen installation. git diff bun.lock
  shows exactly that one changed line; no dependency resolution moved.
- packages/cli/src/retro/local-retro-readiness-manifest.json is enabled:false.
  The protected production-readiness job is expected to skip, not fail, for
  this release. Recheck this exact file on the final release head.
- If the source is squash-merged, rebase the release onto main and refresh
  review and CI. A normal merge commit preserves ancestry, but the release
  base and effective diff must still be checked after retargeting.
- Run check:claude-plugin and the version-sync guard explicitly. Codex hooks are
  version-independent bundled-runtime commands; the obsolete bunx-pin grep
  from the local skill does not validate that current contract.

The release branch has now fast-forwarded to source b352845a8 and regenerated
all five surfaces. A generated identity conflict from restoring the version-only
stash was resolved by regeneration, not by hand-editing the identity. The
source CI and remaining release checks are still required before completion.

## Rejected review workaround

Do not mark bun.lock linguist-generated to get a phase stamp. Independent review
568204e4-806b-446c-b435-9aea4d120385 showed that this would hide future lockfile
resolution changes. The proposed line was reverted. Preserve the bounded diff
and normalized-byte proof, collect hosted CI and the live cache checks, and
resolve the specific review-coverage limitation without a standing policy waiver.
