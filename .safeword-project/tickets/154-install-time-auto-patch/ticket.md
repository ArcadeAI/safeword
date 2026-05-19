---
id: 154
type: feature
phase: verify
status: in_progress
created: 2026-05-18T14:55:00Z
last_modified: 2026-05-18T14:55:00Z
depends_on: 153
scope:
  - Detect a downstream project's flat ESLint config (`eslint.config.{mjs,js,cjs,ts,mts,cts}` — the six filenames ESLint v9 discovers per [config-loader.js](node_modules/eslint/lib/config/config-loader.js)) during `safeword setup` and `safeword upgrade` and, when appropriate, auto-edit it to spread `...safeword.configs.vendoredIgnores`
  - Insertion strategy is textual: find the default-export array's closing `]` (including inside a `defineConfig(...)` wrapper — inline-supported, not deferred), insert `  ...safeword.configs.vendoredIgnores,` before it; ensure `import safeword from 'safeword/eslint';` exists in the import block
  - Idempotency — if the config text already contains the substring `vendoredIgnores`, skip the patch entirely (covers re-runs after either auto-patch or manual 153-nudge application)
  - Safety — write `<config-path>.safeword-bak` before any edit; if a post-edit `node --check` fails, restore from backup and fall back to 153's print-nudge. TypeScript variants (`.ts/.mts/.cts`) skip `node --check` (the textual insert is trusted; a TS-aware checker isn't worth the dep weight for a one-line insert)
  - Line endings — preserve the source file's line-ending style (CRLF stays CRLF, LF stays LF)
  - Env var convention — `SAFEWORD_NO_MODIFY` is truthy on any non-empty value, matching the existing `SAFEWORD_SKIP_INSTALL` / `SAFEWORD_NO_AUTO_UPGRADE` pattern in this codebase
  - Confirmation — after a successful patch, print "Added vendoredIgnores to <path>; backup at <path>.safeword-bak" using the existing output helpers
  - Opt-out — `--no-modify` flag on `setup` and `upgrade` AND `SAFEWORD_NO_MODIFY=1` env var both skip auto-patch entirely and fall through to 153's print-nudge
  - Bail-to-print on any uncertainty: `defineConfig(...)` wrapper present but no inner array literal found; default export is a function call we don't recognize; default export is a single imported config; file read/write fails
out_of_scope:
  - Legacy `.eslintrc.*` configs (json/yaml/js/cjs) — these projects fall straight through to 153's print-nudge; auto-patch for them is its own deferred problem
  - `package.json#eslintConfig` — same; print-nudge only
  - Monorepo nested eslint configs (e.g., `packages/*/eslint.config.mjs`) — patch the root only; nested configs are the user's call
  - Configs that wrap their export in a custom helper (anything other than `defineConfig`) — bail to print-nudge
  - Configs that use a function-returning-config pattern (`export default () => [...]`) — bail to print-nudge
  - AST/parser-based insertion — textual approach is sufficient for the common cases; if we hit a pattern textual can't handle, bail rather than escalate
  - Interactive prompts ("Patch? [Y/n]") — default is just-do-it, opt-out is the flag/env var
done_when:
  - Consumer with a flat `eslint.config.mjs` (with or without `defineConfig(...)` wrapper) runs `safeword setup` on an existing-config project → the config is modified to spread `vendoredIgnores`, `.safeword-bak` exists at the sibling path, the confirmation line is printed, and a re-run is silent
  - `--no-modify` flag and `SAFEWORD_NO_MODIFY=1` env var each independently short-circuit the auto-patch and fall through to 153's print-nudge with the consumer's config untouched
  - Every bail-to-print trigger (defineConfig-but-no-inner-array, function-returning-config, single-imported-config, syntax-check fail after edit, read/write fail) leaves the consumer's config exactly as it was AND prints 153's nudge
  - `bun run lint` is green at the repo root; full vitest is green from `packages/cli/`
  - Pair-parity holds across any hook files touched (none expected — this is CLI work, not hook work)
---

# Install-time auto-patch of consumer's ESLint config

**Goal:** Make the 153 print-nudge moot for the common case. Most users won't read printed instructions and many don't know what ESLint is — so safeword should just add the line itself, with a backup, and tell the user it did. Print-nudge becomes the fallback for legacy configs and unrecognized patterns rather than the primary experience.

**Why:** Ticket 153 shipped the export and a print-only nudge. The user explicitly flagged that print-only is weak for non-technical users; the 84 false-positive lint errors they're hitting will persist if they don't read or act on the message. Auto-patch closes that gap.

## Design context (locked from /bdd discussion)

- **Textual insertion, not AST.** Acorn/babel/recast all work, but they balloon the dep surface and complicate cross-format support (`.ts` configs with type annotations alone are a meaningful parser-config burden). Textual matching with a `defineConfig(...)` smart-detect handles the 90% case; anything else falls back to print.
- **No interactive prompt.** The default is "just do it." Standard tool convention (`pip install`, `cargo add`, etc.). Users who want explicit consent pass `--no-modify` or set the env var.
- **Backup is the safety story.** A `.safeword-bak` file makes any edit trivially reversible: `mv eslint.config.mjs.safeword-bak eslint.config.mjs`. This is what makes "just do it" defensible.
- **Idempotency by substring.** A config that contains `vendoredIgnores` anywhere is treated as already-patched. This avoids needing state outside the file itself, and handles both auto-patch and manual-153 application identically.

## References

- [Ticket 153](.safeword-project/tickets/153-vendored-ignores-export/ticket.md) — `vendoredIgnores` export + print-nudge (foundation)
- [vendored-ignores-nudge.ts](packages/cli/src/utils/vendored-ignores-nudge.ts) — 153's print-nudge helper; auto-patch's fallback target
- [eslint-peer-check.ts](packages/cli/src/utils/eslint-peer-check.ts) — adjacent install-time helper for the warning pattern
- [setup.ts](packages/cli/src/commands/setup.ts) and [upgrade.ts](packages/cli/src/commands/upgrade.ts) — wiring sites
