# Work Log: Give Codex users the full Safe Word workflow

**Anchored to:** `.project/tickets/MZH9QH-give-codex-users-full-workflow/ticket.md`

---

## Session: 2026-07-16

- [15:08] Started from the existing ticket artifacts and bound the remaining BDD scenarios to real generator, package, cache, setup, migration, and hook-policy collaborators.
- [15:15] Confirmed the highest-risk migration mismatch: initial migration previously removed legacy hooks instead of waiting for an explicit post-trust handoff.
- [15:40] Committed the plugin-only project boundary, shared Bunx hook-command policy, and staged migration documentation as `6e5492f3`.
- [15:41] Committed executable acceptance bindings as `47f89f44`; the safe BDD lane passed 83 scenarios and 986 steps.
- [15:44] Recorded TDD, characterization, and manual-live evidence separately in the R/G/R ledger. Manual trust acceptance remains explicitly outside ordinary CI because Codex exposes the warning only in its interactive TUI.
- [15:45] Corrected the ledger to its machine-readable contract: RED and GREEN cells contain distinct single commit SHAs, while explanation remains in this log and the manual-acceptance document.
- [16:22] Verification found and isolated an unrelated setup failure: generated Rust skill files under `.agents` and `.claude` contaminated shell-source detection after dependency selection. Added a detector regression; excluding agent configuration roots restored all 48 Rust golden-path tests.
- [17:01] Verification found two related Codex-catalogue gaps: generated references preserved bare command guidance, and the residue assertion treated slash-delimited prose as a command. Added a RED reference fixture, scoped every generated Markdown asset, regenerated the catalogue, and tightened the assertion to command-shaped invocations.
- [22:00] Audit maintenance updated dev-only Codex, Cucumber, and Knip tooling and removed stale Knip binary suppressions; the audit is clean apart from pre-existing persona-document aliases.
- [22:08] A fresh independent review found that explicit cleanup used prefix ownership and could delete a user command such as `safeword-tools`.
- [22:34] Replaced prefix and broad path detection with exact shipped package and historical-script forms; CLI integration regressions now preserve lookalike commands and adjacent user scripts. Re-ran the cache and branch-backed public migration smokes on `codex-cli 0.144.5` and refreshed interactive trust evidence.
- [23:31] A second independent review found two residual boundary errors: arbitrary pinned Bunx and bare CLI commands were still treated as cleanup-owned, and uppercase or underscore path suffixes could be rewritten as scoped skill invocations.
- [23:35] Narrowed cleanup to the exact historical `npx --yes safeword` project-hook form and made every slash suffix a protected path delimiter. The fresh re-review approved both changes; focused migration and release contracts passed.
- [23:56] Final evidence: full suite 5,202 passed / 5 skipped, Cucumber 484 scenarios passed / 3 skipped, lint and typecheck clean, audit clean apart from intentional generated/parity clones and pre-existing persona aliases. GitHub's REST tag endpoint returned HTTP 503 during the unrelated reconcile live smoke; the Codex cache and migration live smokes passed and `git ls-remote` confirmed the tag remains available.
- [01:15] Re-ran the canonical `/verify` plan in a persistent terminal: 352 Vitest files passed (5,202 tests, 5 skipped), then Cucumber passed 484 scenarios (3 skipped) and 15,000 steps (4 skipped); the plan's typecheck also passed. The full `/audit` sweep found no dependency-cruiser or Knip violations. Its 480 clone pairs are expected generated/parity copies; a `markdownlint-cli2` development-only patch and legacy `SM`/`TB` persona aliases remain outside this ticket's scope.
- [15:58] After the latest main catch-up, reran the canonical plan: 5,210 tests passed (5 skipped), Cucumber passed 484 scenarios (3 skipped) and 15,000 steps (4 skipped), and typecheck passed. The stale BDD test now asserts the shipped Codex plugin planning reference rather than a retired schema tuple. User approved closure after the full verification, audit, quality-review, and refactor passes.
