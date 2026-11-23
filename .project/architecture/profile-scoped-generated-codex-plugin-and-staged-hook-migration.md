# Profile-Scoped Generated Codex Plugin and Staged Hook Migration

[Current activation proof](restart-bound-codex-plugin-activation.md).

**Status:** Accepted
**Date:** 2026-07-16
**Supersedes:** none
**Superseded in part by:** [Next-Task Codex Plugin Activation and Migration Result v2](next-task-codex-plugin-activation-and-migration-result-v2.md) (lifecycle wording, pending-marker name, and schema-1 migration-state result)

**Context.** Codex needs the full Safeword workflow without copying workflow files into each repository. Working legacy hooks must stay in place until the plugin proves its hooks ran. Cleanup must also survive interruption and preserve teammates’ changes.

**Decision.** Generate and distribute the Codex plugin from canonical templates. Migrate with Expand → Prove → Contract: install profile-first; record profile-local SessionStart proof bound to package version and the exact hook-manifest digest; let each viable legacy event remain authoritative while the plugin covers gaps; and finalize only with current proof plus explicit confirmation. Finalization uses a contained, fingerprinted transaction backup and conflict-safe recovery. Historical ownership and viability identities live in `SAFEWORD_SCHEMA.codexMigration`.

**Consequences.** Generic setup and upgrade preserve recognized legacy assets. `safeword codex status` derives human and schema-1 JSON output from one typed state model. Finalization removes only schema-owned assets, preserves custom content, records plugin mode, and leaves a setup-only bootstrap. Interrupted work reports `recovery_required`; recovery refuses to overwrite intervening edits. Profile proof covers only the active profile. Each teammate may be at a different migration stage.

**Alternatives.** Manually maintain plugin skills: rejected because the existing thin catalogue drifted. Generate at customer runtime: rejected because it adds a customer-time failure mode and cannot prove the installed cache. Delete hooks on plugin enablement: rejected because enabled does not mean trusted.

**Reassess when.** Codex adds a public trust-status or approval API, changes plugin/cache or hook schemas, introduces project-scoped plugins, or the canonical workflow adopts metadata/reference syntax outside the generator allowlist.

**Implementation.** Tickets MZH9QH and AJVXWV (#1572): `packages/cli/src/codex-plugin/`, schema-owned migration inventory, generated `packages/cli/codex-plugin/skills/`, proof/restart markers, event-level dispatch authority, typed status, transactional finalization/recovery, tarball/cache proof, and documented interactive hook acceptance.
