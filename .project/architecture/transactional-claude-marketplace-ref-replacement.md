# Transactional Claude Marketplace Ref Replacement

**Status:** Accepted
**Date:** 2026-09-10
**Supersedes in part:** the command-only profile mutation and no-private-file-restore clauses of [Generated Native Claude Plugin with Live Proof and Project Contraction](generated-native-claude-plugin-with-live-proof-and-project-contraction.md) and [Project-Default Claude Plugin Declarations and Project-Bound Proof](project-default-claude-plugin-declarations-and-project-bound-proof.md)

**Context.** When a stored release ref changes, Claude Code can report a successful marketplace update even though the checkout and installed plugin still use the prior release. This prevents an existing stable installation from selecting a prerelease. Removing and re-adding the marketplace selects the requested ref. The commands temporarily remove marketplace and plugin registrations.

**Decision.** When the existing marketplace is the trusted `ArcadeAI/safeword` source but its ref is stale, snapshot the contained marketplace checkout plus the selected scope's settings, marketplace registry, and plugin registration. Replace the marketplace through Claude's supported remove/add commands, then write the canonical source declaration and auto-update policy durably. Keep the snapshot until plugin convergence and verification finish; any intervening failure restores the exact prior profile. Refuse conflicting sources, unexpected checkout locations, and unsafe metadata before mutation.

**Consequences.** Stable-to-prerelease and pinned-release upgrades select the requested tag instead of trusting a false-positive host update. Failed upgrades recover customer configuration and the prior working plugin, at the cost of bounded temporary disk usage and direct writes to already-validated Claude profile metadata during commit/rollback. Release candidates must still pass acceptance on a real host. Claude does not guarantee the marketplace persistence behavior observed in testing.

**Alternatives.** Keep using `marketplace update`: rejected because live Claude evidence showed success without checkout movement. Remove/re-add without rollback: rejected because a later failure strands a previously working profile. Edit only the stored ref: rejected because Claude can continue using the old checkout.

**Reassess when.** Claude makes ref changes transactional, exposes an atomic replace command, or documents a profile API that removes the need to snapshot private marketplace metadata.

**Implementation.** Ticket `P0WEJD`; `packages/cli/src/claude-plugin/profile.ts`, profile integration tests, and public `0.83.1` to release-candidate acceptance.
