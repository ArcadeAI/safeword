# ESLint Disable Directives Are Fragile in This Codebase

Covers: eslint-disable comment stripping, reportUnusedDisableDirectives, lint-staged interaction, durable regex patterns.

**Finding:** `// eslint-disable-next-line <rule>` and `// eslint-disable-line <rule>` comments get silently stripped by `eslint --fix` during the `lint-staged` pre-commit pipeline whenever the targeted rule doesn't appear to fire at fix-time. The end state passes the pre-commit hook (the directive is gone, so its "unused" status is no longer reported) but FAILS a subsequent lint run (the rule re-fires on the now-undefended code). Net result: a commit can land that visibly bypasses the local lint check yet still has lint errors.

**Root cause:** Safeword's own TypeScript preset sets `linterOptions.reportUnusedDisableDirectives: 'error'` (see `packages/cli/src/presets/typescript/eslint-configs/base.ts:283-284`). Combined with `eslint --fix`, this is a documented ESLint feature: `--fix-type directive` (one of four fix categories) auto-removes any disable directive eslint judges "unused" — i.e., that doesn't suppress a violation on the line it targets. The feature shipped in ESLint v8.52.0 (October 2023) per [RFC #78 "Fixable Disable Directives"](https://github.com/eslint/rfcs/pull/78) and the [v8.52.0 release notes](https://eslint.org/blog/2023/10/eslint-v8.52.0-released/). The intent is excellent: dead disable comments don't accumulate.

The fragility comes from how "unused" is judged in a `lint-staged` pipeline that interleaves multiple fixers. Specific mechanism in the cases observed here is not fully isolated — two plausible paths (either may apply per file):

- _Prettier reformats the line._ When `prettier --write` runs after `eslint --fix`, it can wrap or restructure a long `expect(...).toMatch(/regex/)` such that the regex moves to a different line than the same-line `eslint-disable-line` directive. The directive now targets a line with no violation, so the next eslint pass strips it.
- _A different autofixer's rewrite silences the rule transiently._ Inside a single eslint run, fixers from rules other than the disabled one can rewrite code such that the disabled rule's violation moves or temporarily disappears; the directive is then judged unused and removed in the same fix pass.

Both paths produce the same end state: directive gone, rule still firing, next lint run fails. Empirically observed three times during ticket ZM32AK (lint debt cleanup), across `eslint-disable-next-line` placement above the regex, same-line `eslint-disable-line`, and block-scoped `/* eslint-disable rule */ ... /* eslint-enable */` forms. All three got stripped.

**What actually works:** Rewrite the regex to a form that doesn't trigger the rule at all.

- Replace unbounded `\d+` with bounded `\d{1,N}`. Bounded quantifiers don't trigger `sonarjs/slow-regex` or `security/detect-unsafe-regex`.
- Collapse adjacent optional groups `(?:-a)?(?:\+b)?` into a single character-class run `[-+ab]{0,N}` when the surrounding context allows. Two adjacent `?` groups are what `security/detect-unsafe-regex` flags as polynomial-backtracking-prone, even when the literal anchors make overlap impossible.
- Replace nested-quantifier shapes `(\w+(\([^)]+\))?(,\s*…)*)` with a function that splits the input first and applies a flat regex per token. (See `tests/integration/skills-commands-validation.test.ts:matchesAllowedTools`.)
- Expand abbreviated optional alternation chars: `ya?ml|c?js` → `yaml|yml|js|cjs`. The optional-character form is what `regexp/no-trivially-nested-quantifier` flags.

**The general principle:** in this codebase, prefer "satisfy the rule" over "disable the rule." Disable comments are a contract between you and the linter — and `reportUnusedDisableDirectives + eslint --fix + lint-staged` is a chain that can unilaterally break that contract during a commit, with no signal until the next lint run.

**If you genuinely need to disable a rule** (e.g., truly intentional pattern that can't be rewritten), put it in the eslint config itself — either narrowing the rule's `files` glob, or adding a `rules` override for a specific path. Per-line directives are not durable.

**References:**

- [ESLint RFC #78 "Fixable Disable Directives"](https://github.com/eslint/rfcs/pull/78) — the design that introduced `--fix-type directive` auto-removal of unused disable directives.
- [ESLint v8.52.0 release notes](https://eslint.org/blog/2023/10/eslint-v8.52.0-released/) — where the feature shipped (October 2023).
- [ESLint configuration docs: linterOptions.reportUnusedDisableDirectives](https://eslint.org/docs/latest/use/configure/configuration-files) — defines the option and its severity levels.
- `packages/cli/src/presets/typescript/eslint-configs/base.ts:283-284` — where `reportUnusedDisableDirectives: 'error'` is set in safeword's own preset.
- `packages/cli/tests/commands/cli.test.ts`, `setup-core.test.ts`, `check.test.ts` — bounded-quantifier rewrites that survive the pipeline.
- `packages/cli/tests/integration/skills-commands-validation.test.ts` — `ALLOWED_TOOLS_PATTERN` → `matchesAllowedTools()` function refactor.
- Ticket ZM32AK commits `1a323bb` through `2699689` — the cleanup sequence that surfaced this.
- Verified empirically via three failed disable-comment attempts and one durable regex-rewrite pass, May 2026; the documented ESLint behavior (`--fix-type directive`) was cross-checked against ESLint's own RFC and release notes via `/quality-review` after the fact.
