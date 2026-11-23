# Verification for C51NPS

**PR Scope:** ✅ The diff covers the architecture overview, its linked records, affected tests, the repository size guard, and the citation-loader follow-up.

The split replaces copies of package manifests, module lists, and test command tables with links to their owners. The records retain the reasons behind design choices. For example, the build record explains why OpenCode needs a self-contained dispatcher. The ledger record retains lease ownership, append-only human decisions, and the requirement to preserve unknown events. The gate record distinguishes current reviewer eligibility from the earlier different-model restriction.

The overview retained all 71 original heading anchors. The acceptance scenario follows the planning decision and the older decision's replacement link. A deliberately incorrect replacement failed the scenario.

The BSHVDP packet captured the overview and both explicitly supplied approval records byte for byte. The checked-in regression uses the repository's 5F5ZZA implementation plan so it can run in a fresh clone. Four shell-script cases check the warning and failure on either side of the size thresholds. All five regression cases passed locally.

Automatic capture of links found in plans remains separate work in [YGH23C](../YGH23C-include-cited-architecture-records/ticket.md).
