# One Safeword CLI lookup for every hook

**Status:** Accepted
**Date:** 2026-10-13

**Context.** Hooks previously resolved the CLI independently. Trust checks (the GREEN receipt guard, the retrospective gate) accepted only a plugin path, so they failed wherever hooks run from project files (Cursor, project-local delivery; #5807, #5026). Action hooks fell back to `bunx safeword@latest` or an unpinned `bunx safeword`, which can run a different version than the installed hooks and downloads from npm on demand. The Claude plugin generator rewrote those `@latest` strings at build time.

**Decision.** `hooks/lib/safeword-cli.ts` is the only place hooks resolve the CLI. `trustedSafewordClis` serves trust checks and never returns a CLI the project can edit. The resolver identifies a running plugin from `SAFEWORD_PLUGIN_CLI` or `CLAUDE_PLUGIN_ROOT`. When a skill runs a bundled helper from Bash, the resolver can also identify the plugin from the module’s own `<plugin>/runtime/hooks/lib/` path. Only that plugin’s bundled CLI qualifies. If the copy is missing or the project can write to it, the resolver returns no CLI. Another build with the same version string can produce a different fingerprint and reject approved receipts as stale (#7501). Hosts without a plugin get the Codex plugin cache for the pinned version, then `bunx safeword@<.safeword/version>` run from the home directory so project files cannot shadow it. `safewordClis` serves plain actions: this repo's source (only when the checkout is the `safeword` package, so Safeword's own development runs its edits), the plugin's bundled copy, the installed `node_modules/.bin/safeword` (only when it is the pinned version), then the same pinned `bunx`.

**Consequences.** Plugin hosts (Claude Code, Codex) keep running their own bundled copy. Hosts without a plugin run exactly the installed version, and the first `bunx` run may need the network. No hook runs `@latest`; a hook with no resolvable CLI skips its action, and trust checks fail closed. Auto-upgrade still deliberately runs the newest version.

**Alternatives.** Drop the plugin bundles and always use `bunx`: rejected because plugins then depend on npm at hook time and could drift from their own version. Add `bunx` only to the GREEN guard: rejected because the other copies would keep drifting.

**Reassess when.** Cursor ships a plugin with a bundled runtime, or a host exposes the plugin's own runtime path to project-delivered hooks.

**Implementation.** Ticket `8VG20K`; `hooks/lib/safeword-cli.ts`, its unit and contract tests, and the GREEN guard, retrospective gate, review runner, architecture, learnings, retro, lint, and test-runner call sites.
