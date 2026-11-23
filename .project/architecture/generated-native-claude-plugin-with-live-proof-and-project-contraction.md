# Generated Native Claude Plugin with Live Proof and Project Contraction

[Current cleanup authority](proof-gated-automatic-claude-legacy-contraction.md).

**Status:** Superseded by [Project-Default Claude Plugin Declarations and Project-Bound Proof](project-default-claude-plugin-declarations-and-project-bound-proof.md)
**Date:** 2026-08-02
**Supersedes:** none

**Context.** Claude Code can install a marketplace plugin into a user profile and apply plugin changes in the current task with `/reload-plugins`, but installation and listing do not prove the selected cache bundle executed. Existing projects already contain working Safeword-owned Claude hooks and workflows, while fresh projects should avoid creating a local copy of that tree. Cleanup must not overwrite custom project content or mutate Claude's marketplace, trust, reload, or enablement state.

**Decision.** Generate the complete root `plugin/` tree from canonical CLI templates and distribute it through the official release-tagged marketplace. Install uses supported Claude commands to update the user profile. SessionStart or the first UserPromptSubmit after reload records proof under `${CLAUDE_PLUGIN_DATA}`, bound to exact version, hook-manifest digest, and canonical `${CLAUDE_PLUGIN_ROOT}`. In existing projects, working legacy hooks continue to handle each event until the plugin supplies current proof and the user explicitly confirms project-only cleanup. Cleanup uses a host-neutral contained, fingerprinted, durable transaction shared with Codex behind host-specific inventory and marker adapters. Reconciliation computes one of `fresh-native`, `legacy`, or `plugin-mode` before planning files, so setup preserves existing protection and never recreates retired Claude-only assets.

**Consequences.** Native skills use Claude's `safeword:` namespace and the installed cache is the framework runtime boundary. Status evaluates profile health, execution proof, legacy inventory, and recovery state in a defined order. `/reload-plugins` can activate a new bundle without restarting the task; the next prompt confirms which bundle ran. Public Claude profile commands may leave reported partial effects on failure because supported add/remove operations do not restore byte-identical private files; Safeword never rewrites those files directly. Project cleanup preserves unknown content and refuses stale plans, concurrent edits, symlinks, and path escape.

**Alternatives.** Keep project-local delivery: rejected because every upgrade churns framework-owned repository files. Treat enabled/listed as proof: rejected because configuration is not execution. Delete legacy assets during setup or install: rejected because it creates a protection gap and crosses profile/project scopes. Copy Codex migration wholesale: rejected because Claude has different cache, reload, trust, namespace, and settings semantics. Restore private Claude profile files after failure: rejected because those formats are undocumented and a restore could overwrite concurrent user changes.

**Reassess when.** Claude exposes a supported non-interactive reload/trust API, changes SessionStart/UserPromptSubmit ordering or plugin environment variables, makes marketplace operations transactional, changes tagged-source or cache semantics, or Cursor gains a native boundary that removes the shared materialized runtime constraint.

**Implementation.** Ticket `0S31PG` / issue #1785; planned modules under `packages/cli/src/claude-plugin/`, shared migration transaction extraction, schema delivery modes, generated root plugin catalogue, typed `safeword claude` commands, release-tag cache smoke, and migration/status/setup integration coverage.
