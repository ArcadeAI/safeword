# Work Log: Give Codex users the full Safe Word workflow

**Anchored to:** `.project/tickets/MZH9QH-give-codex-users-full-workflow/ticket.md`

---

## Session: 2026-07-15

- [14:26] Created feature ticket MZH9QH.
- [14:28] Mapped the canonical catalogue: 18 skill directories and 25 files, compared with three thin Codex plugin skills.
- [14:29] Decided that a generated full-catalogue plugin mirror is the only durable parity boundary; manual BDD copies and a BDD-only dependency closure would drift.
- [14:30] Recorded the intake brief and two JTBDs for Technical Builders and Safeword Maintainers.
- [14:31] Quality-review plan: (1) verify Codex's current plugin and skill packaging constraints from primary documentation, (2) inspect the source-to-package boundary for a drift-proof parity contract, and (3) independently review scope, negative cases, and test wiring before scenario authoring.
- [14:36] Verified current Codex documentation: reusable multi-skill workflows belong in plugins; skills may contain references; installs run from a profile cache. Added an explicit semantic-parity transformation contract and an isolated cached-install proof requirement.
- [14:38] Fresh-reviewer subagent did not return after two waits and an explicit conclude request. Recorded the timeout; no independent verdict was used.
- [14:42] Fresh review completed after the timeout. It confirmed the parity contract and installed-plugin proof gaps, and found a migration safety defect: enabled is not equivalent to trusted for plugin hooks.
- [14:41] Verified with Codex 0.141.0: `codex plugin` has no trust command and `plugin list --json` has no trust-status field. The documented trust flow is manual, so the ticket now carries a two-step migration handoff as an open decision.
- [14:42] User approved the two-step migration handoff. Added six numbered Rules covering complete workflow delivery, repository cleanliness, safe migration, deterministic generation, package completeness, and isolated Codex installation.
- [14:59] Drafted the engineering contract: full generated catalogue, narrow adapter allowlist, profile-only workflow delivery, two-step migration, release/install proof, and no Claude/Cursor, Codex Cloud, npx, or trust-bypass work.
- [18:00] Quality-review plan: verify current Codex plugin, cache, skill-reference, and hook-trust requirements; confirm Bun and Codex runtime currency/security; compare the scoped proof chain with the actual release, migration, persona, and live-smoke tests.
- [18:05] Tightened the discovery contract: Codex may use a dynamic skill-list budget and omit skills, so the ticket now tests the documented 8,000-character fallback and explicit scoped invocation instead of promising universal implicit discovery.
- [18:07] Completed intake quality review against current Codex and Bun documentation. Bun 1.3.14 is current; the reviewed Bun advisory is withdrawn. Existing package, migration, and persona tests are green but intentionally do not yet prove full-catalogue packaging or post-trust cleanup. A new fresh reviewer did not return before its stop deadline, so no invented second verdict was used.
- [23:34] Scope approved. Added trust behavior: Codex must visibly skip and warn about untrusted or changed Safe Word hooks; Safe Word keeps legacy hooks until the builder completes the Codex `/hooks` review flow and never reads, mutates, or bypasses Codex trust state.
- [23:39] Derived eight behavior dimensions and drafted 18 scenarios across complete workflow delivery, project cleanliness, staged migration, hook trust, deterministic generation, package completeness, cached installation, and Bunx-only hook safety.
- [23:41] Recorded the define-behavior phase anchor and corrected the Safeword CLI surface tag after the health check identified both ticket-local wiring details.
- [23:49] Quality-review plan: (1) check every BDD rule has a behavior-level happy path and rejection path, (2) verify current Codex plugin-hook trust, cache, and session requirements from primary docs, and (3) assess whether the planned source, package, isolated-profile, and live tests reach the real user path without depending on project files or private trust state.
- [23:53] Quality review strengthened new-session, exact project-boundary, and visible `/hooks` recovery behavior. It also separated an untrusted no-bypass live proof from any bypassed package-dispatch smoke, which cannot demonstrate trust.
- [23:56] Quality review verification passed: Gherkin lint, current package/migration contracts, and dependency audit are green. No MZH9QH health-check advisory remains. A fresh reviewer was requested but did not return before its stop deadline, so no independent verdict was asserted.
- [00:08] User accepted the 18 behavior scenarios. Phase advanced from define-behavior to scenario-gate for adversarial scenario review and independent validation.
- [00:14] Independent scenario review found three must-fix gaps: setup could pass without executing; trust behavior was not observable through real Codex; unsafe hook variants were combined. Applied the fixes, added explicit-cleanup and discovery-budget rejection coverage, and retained migration guidance rather than automatic plugin installation because setup auto-install is out of scope.
- [09:55] Scenario gate passed after an independent fresh review. Entered implementation planning. Current Codex documentation and local CLI help confirm the plugin/skill/reference model and `/hooks` trust behavior; no supported CLI trust-status or approval command exists. The plan uses a generated checked-in plugin catalogue, explicit `--remove-legacy-hooks` cleanup, exhaustive release contracts, an automated no-bypass live smoke, and a manual changed-hook acceptance check.
- [10:01] BDD dry-run found the new feature's 22 undefined scenarios. Updated the plan to add a thin Cucumber step file for deterministic scenarios and to mark the real-session trust proof `@live` plus the changed-hook acceptance check `@live @manual`.
