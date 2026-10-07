# Resolve generated conflicts before Ready promotion

## Review questions

- Authority/currency: does updating this PR branch from main differ from merging
  the PR, and does the current main commit still contain only the observed #5484
  change? Verify GitHub documentation and the actual Git range.
- Correctness/security: can an additive update preserve both the exclusion fix
  and the authorized Sharp patch without changing guards or historical proofs?
  Inspect the merge result and fail closed on any authored conflict.
- Generated integrity: do the supported five-surface generators produce the
  combined payload without manually editing identities, inventories or fixtures?
  Preserve lifecycle result hashes; investigate any changed result before proceeding.
- Evidence/readiness: can fresh exact-head CI and independent review establish
  the combined result before normal host closure observation and Ready promotion?
  Inspect the actual configured review JSON and published findings afterward.

## Proposal

Synchronize origin/main 5fdb789be into codex/approval-exclusions with an additive
local merge, preserving branch history and the Sharp patch. This updates only the
PR branch: it does not merge PR #5443 into main or authorize any release.
Current conflict inspection names only generated lifecycle fixtures and Claude
plugin identity. Main's authored change centralizes the terminal handoff wording
and its tests; do not revise that accepted behavior while resolving this delivery.

Use the supported generated-surface repair helper, in its defined safe order,
to recreate the combined generated files. Do not select conflicting identity or
fixture values manually. The helper parses existing lifecycle fixtures before
regenerating them, so restore only conflicted lifecycle inputs from the existing
branch's HEAD as the comparison baseline, then regenerate all final values.
This is not a conflict resolution by chosen digest: the final output must come
from the generator, and its result-hash comparison must still pass.
Run relevant terminal-handoff/quality and existing
receipt/readiness regressions with pinned tools and one local Vitest process.
Inspect the complete combined diff, record the resulting evidence, obtain fresh
independent review, commit normally and push. Await exact-head CI; do not carry
the prior green run across the merge.

Reconfirm the closed ticket's verification through normal supported helpers and
actual native host hooks. Never write a readiness receipt, approval ledger or
runtime identity manually. The earlier Ready authority remains specific to #5443;
the human now directs proceeding with this proposal as appropriate. Promote only
through the guarded gh pr ready path, retaining truthful pending configured-review
evidence for the explicitly authorized Ready-then-inspect sequence. Inspect the
Actions JSON artifact and any published model findings; apply or answer each.
Do not merge the PR, release, bypass guards or alter historical #2121 proofs.

## Sources and alternatives

GitHub's current branch-update documentation distinguishes updating the head
branch from merging the PR:
https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch

Repository AGENTS.md and packages/cli/scripts/check-generated-surfaces.ts define
the authoritative generator ordering. Existing pr-readiness and post-tool hooks
define the supported exact-head closure boundary.

Rebase was rejected because it rewrites already-reviewed branch history and needs
a force push. Hand-selecting generated digests was rejected because it can hide
stale combined output. Leaving Draft was the safe previous fallback, but the
human's instruction to review the proposal and proceed permits this bounded sync.
