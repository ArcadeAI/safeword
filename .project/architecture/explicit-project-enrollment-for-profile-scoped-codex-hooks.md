# Explicit Project Enrollment for Profile-Scoped Codex Hooks

**Status:** Accepted
**Date:** 2026-07-27
**Supersedes:** implicit hook-time namespace creation

**Context.** The Codex plugin is profile-scoped, so its lifecycle hooks can run in repositories that never installed Safeword. The quality-state observer previously treated any committed repository as enrolled and created a partial `.project/` namespace after ordinary tool use.

**Decision.** Running `safeword install` explicitly creates the enrollment marker `.safeword/enrolled`. Safeword also recognizes older installs by their `.safeword/SAFEWORD.md` handbook copy until a plugin-only upgrade retires it. Before enrollment, Codex project gates fail open and project-scoped PreToolUse, PostToolUse, and Stop handlers do not run or write state; SessionStart may still supply package-owned plugin instructions.

**Consequences.** Installing the profile plugin never implicitly enrolls a repository. After enrollment, a workflow may create missing framework-owned transient state and its exact ignore rule at first use without running install or inventing authored knowledge. The workflow must create the ignore rule successfully before writing state. Default, legacy, and configured custom namespace roots retain identical behavior.

**Alternatives.** Lazy full bootstrap was rejected because a global plugin should not mutate unrelated repositories. User-cache state before enrollment was rejected because project gates lack the project artifacts they govern and repository fingerprinting would add lifecycle complexity without useful enforcement.

**Reassess when.** Codex introduces project-scoped plugin activation, or Safeword adds a standalone profile workflow whose pre-enrollment state has value independent of project setup.

**Implementation.** Ticket F7BH4J: `hasSafewordProjectMarker` in CLI and standalone hook path helpers; packaged Codex dispatcher guards; Codex proof-cache guard; integration coverage for unconfigured, default, legacy, and custom-root repositories.
