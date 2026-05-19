---
id: 156
type: feature
phase: done
status: done
created: 2026-05-18T01:50:00Z
last_modified: 2026-05-18T01:50:00Z
scope:
  - Add `safeword.configs.vendoredIgnores` to the TypeScript preset — an array containing one `globalIgnores(['.safeword/**', '.dependency-cruiser.cjs'])` config, spreadable to match sibling `configs.*` entries
  - Wire install-time guidance into `safeword setup` and `safeword upgrade`: when `ctx.projectType.existingEslintConfig` is truthy AND the project uses JavaScript, emit the literal snippet telling the user to add `...safeword.configs.vendoredIgnores` to their existing ESLint config
  - Hygiene pass on `.safeword/hooks/pre-tool-config-guard.ts` lines 27 and 39 — replace the nested-`?` regexes with readable alternations (`/\.eslintrc(\.(json|ya?ml|c?js|mjs))?$/` and the prettier analogue)
  - Hygiene pass on `.safeword/hooks/cursor/stop.ts:57` — replace the empty `() => {}` catch with a debug-logged catch so intent is explicit and `no-empty-function` no longer flags
  - Mirror the hygiene-pass edits in `packages/cli/templates/hooks/` so downstream installs and upgrades pick them up (pair-parity rule)
out_of_scope:
  - Auto-patching the consumer's existing ESLint config (high risk across flat/legacy/YAML/CJS/MJS variants)
  - Pinning ESLint version inside safeword (analysed previous turn — orthogonal to this bug class)
  - Migrating `.dependency-cruiser.cjs` to ESM (separate concern; ignoring the file via the export is sufficient here)
  - Rule-override variants of the export (e.g., disabling `security/detect-non-literal-fs-filename` scoped to `.safeword/**`) — no concrete demand; ignore-only keeps API minimal
  - Touching the 77 `security/detect-non-literal-fs-filename` sites individually — eliminated as a class once `.safeword/**` is globally ignored downstream
done_when:
  - `safeword.configs.vendoredIgnores` exports from `packages/cli/src/presets/typescript/index.ts`, internally `[globalIgnores(['.safeword/**', '.dependency-cruiser.cjs'])]`
  - A unit test asserts the export's shape and the exact ignore strings
  - `safeword setup` and `safeword upgrade` emit the import + spread snippet exactly when `existingEslintConfig` is truthy and JavaScript is detected; no output change on the fresh-project path
  - The two regexes in `pre-tool-config-guard.ts` are readable alternations, behave-equivalent on a unit-tested set of fixtures (`.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.mjs`, `.eslintrc`, and likewise for prettier)
  - `cursor/stop.ts:57` no longer contains an empty function; cleanup error path is debug-logged
  - `.safeword/hooks/**` and `packages/cli/templates/hooks/**` stay in sync (release-gate parity test passes)
  - `bun run lint` inside this repo stays green; full vitest run inside `packages/cli/` stays green
---

# Vendored-ignores export + install-time guidance + hygiene pass

**Goal:** Give downstream safeword users a one-line escape hatch from "my strict ESLint config flags 84 errors inside `.safeword/**`," and harden the three actual code smells in vendored hooks while we're in there.

**Why:** A downstream project (babelbot) reported 84 ESLint errors from its own `bun run lint` hitting vendored safeword files. Root cause: safeword's installer skips writing the project-level ESLint config when one already exists, which means the `.safeword/` ignore that fresh projects get via [`getIgnores()`](packages/cli/src/presets/typescript/detect.ts:210) never lands in existing-config projects. 77 of 84 errors are false positives (`security/detect-non-literal-fs-filename` on hook scripts that legitimately compute filesystem paths from `CLAUDE_PROJECT_DIR` / session IDs). The remaining 7 are real-but-tiny code smells worth fixing regardless.

**Design context (locked from /bdd discussion):**

- ESLint flat config does _not_ discover nested `eslint.config.*` files, so shipping a config inside `.safeword/` cannot solve this from safeword's side alone. The consumer's config must opt out somehow.
- We cannot reliably auto-patch existing configs (flat .mjs/.ts/.cjs/.js + legacy .eslintrc.\* + YAML — too many parser variants, too much risk of corruption).
- ESLint's [March 2025 guidance](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) names `globalIgnores()` as the explicit primitive for directory-pattern ignores. Only global ignores can match directories (per [Ignore Files doc](https://eslint.org/docs/latest/use/configure/ignore)).
- Naming chose `vendoredIgnores` over `vendored` for unambiguous intent, and lives under `configs.*` for namespace consistency with sibling entries (`configs.vitest`, `configs.playwright`, etc.).

## References

- Bug report: babelbot project hit 84 errors in `.safeword/hooks/**` after adopting safeword on top of strict ESLint config
- [Evolving flat config with extends / defineConfig / globalIgnores — ESLint blog, March 2025](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/)
- [ESLint — Ignore Files (`globalIgnores` semantics)](https://eslint.org/docs/latest/use/configure/ignore)
- [ESLint — Shareable Configs](https://eslint.org/docs/latest/extend/shareable-configs)
- Existing pattern: [eslint.config.ts:26](eslint.config.ts:26) — safeword's own monorepo ignores `**/.safeword/`
- Existing pattern: [getIgnores()](packages/cli/src/presets/typescript/detect.ts:210) — fresh-project ignore list (already includes `.safeword/`)

## Follow-up ticket 157 (intentionally split)

The print-only nudge shipped in this ticket is an interim experience. Non-technical users won't read it, won't know what ESLint is, and the 84 errors will persist for them. A follow-up ticket **157 — install-time auto-patch** will land the proper UX: detect the consumer's eslint config format (flat `.mjs/.js/.ts/.cjs`, legacy `.eslintrc.*`, `package.json#eslintConfig`), insert the `safeword.configs.vendoredIgnores` spread + import, write a `.safeword-bak` backup, run a post-edit syntax check, and fall back to the print nudge on any uncertainty. Default UX: just-do-it + clear message; opt-out via `--no-modify`. Depends on this ticket (the export must exist for auto-patch to target it).

## Decomposition

1. **Export** (Rules 1+2). New file `packages/cli/src/presets/typescript/eslint-configs/vendored-ignores.ts` returning `[globalIgnores(['.safeword/**', '.dependency-cruiser.cjs'])]`. Wire into `SafewordEslint` interface, `configs.vendoredIgnores` slot, and the re-exports list in [index.ts](packages/cli/src/presets/typescript/index.ts). Unit test under `__tests__/` asserting array shape, exact ignore strings, and globalIgnores-shape.
2. **Install-time nudge** (Rules 3+4). New helper in [setup.ts](packages/cli/src/commands/setup.ts) (and reused by [upgrade.ts](packages/cli/src/commands/upgrade.ts)) that emits the snippet iff `existingEslintConfig && languages.javascript && !configFileText.includes('.safeword/')`. Unit/integration test with fixture project layouts.
3. **Regex hygiene** (Rule 5). Edit [pre-tool-config-guard.ts](.safeword/hooks/pre-tool-config-guard.ts) lines 27 + 39. Add a small test file under `packages/cli/tests/` exercising the rewritten regexes against the fixture sets in scenarios 5.1–5.3.
4. **Empty-catch hygiene** (Rule 6). Edit [cursor/stop.ts:~57](.safeword/hooks/cursor/stop.ts) — debug-logged catch matching the `post-tool-lint.ts:20` pattern.
5. **Pair-parity sync** (Rule 7.1). Mirror the two hook edits in `packages/cli/templates/hooks/`. Existing release-gate parity test catches drift.
6. **Verify** (Rule 7.2+7.3). Run `/verify` + `/audit`; produce `verify.md`.
