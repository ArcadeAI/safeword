# ESLint Disable Directives Are Fragile in This Codebase

Covers: eslint-disable comment stripping, reportUnusedDisableDirectives, lint-staged interaction, durable regex patterns.

**Finding:** `// eslint-disable-next-line <rule>` and `// eslint-disable-line <rule>` comments get silently stripped by `eslint --fix` during the `lint-staged` pre-commit pipeline whenever the targeted rule doesn't appear to fire at fix-time. The end state passes the pre-commit hook (the directive is gone, so its "unused" status is no longer reported) but FAILS a subsequent lint run (the rule re-fires on the now-undefended code). Net result: a commit can land that visibly bypasses the local lint check yet still has lint errors.

**Root cause:** Safeword's own TypeScript preset sets `linterOptions.reportUnusedDisableDirectives: 'error'` (see `packages/cli/src/presets/typescript/eslint-configs/base.ts:283-284`). This is good hygiene — it stops dead disable comments from accumulating — but interacts badly with autofix passes that rewrite code in ways that _temporarily_ silence the disabled rule. The sequence is:

1. eslint runs against the file. The target rule (e.g. `security/detect-unsafe-regex`) reports a violation on line N.
2. Some _other_ autofixer rewrites code earlier in the file in a way that, on its own, would have made the disabled rule report a different violation.
3. eslint re-evaluates. The disable directive on line N is now "unused" relative to the post-fix code path, so eslint --fix removes it.
4. Next lint pass: rule fires again on line N. No directive to silence it. Lint fails.

Empirically observed three times during ticket ZM32AK (lint debt cleanup), across `eslint-disable-next-line` placement above the regex, same-line `eslint-disable-line`, and block-scoped `/* eslint-disable rule */ ... /* eslint-enable */` forms. All three got stripped.

**What actually works:** Rewrite the regex to a form that doesn't trigger the rule at all.

- Replace unbounded `\d+` with bounded `\d{1,N}`. Bounded quantifiers don't trigger `sonarjs/slow-regex` or `security/detect-unsafe-regex`.
- Collapse adjacent optional groups `(?:-a)?(?:\+b)?` into a single character-class run `[-+ab]{0,N}` when the surrounding context allows. Two adjacent `?` groups are what `security/detect-unsafe-regex` flags as polynomial-backtracking-prone, even when the literal anchors make overlap impossible.
- Replace nested-quantifier shapes `(\w+(\([^)]+\))?(,\s*…)*)` with a function that splits the input first and applies a flat regex per token. (See `tests/integration/skills-commands-validation.test.ts:matchesAllowedTools`.)
- Expand abbreviated optional alternation chars: `ya?ml|c?js` → `yaml|yml|js|cjs`. The optional-character form is what `regexp/no-trivially-nested-quantifier` flags.

**The general principle:** in this codebase, prefer "satisfy the rule" over "disable the rule." Disable comments are a contract between you and the linter — and `reportUnusedDisableDirectives + eslint --fix + lint-staged` is a chain that can unilaterally break that contract during a commit, with no signal until the next lint run.

**If you genuinely need to disable a rule** (e.g., truly intentional pattern that can't be rewritten), put it in the eslint config itself — either narrowing the rule's `files` glob, or adding a `rules` override for a specific path. Per-line directives are not durable.

**References:**

- `packages/cli/src/presets/typescript/eslint-configs/base.ts:283-284` — where `reportUnusedDisableDirectives: 'error'` is set
- `packages/cli/tests/commands/cli.test.ts`, `setup-core.test.ts`, `check.test.ts` — bounded-quantifier rewrites that survive the pipeline
- `packages/cli/tests/integration/skills-commands-validation.test.ts` — `ALLOWED_TOOLS_PATTERN` → `matchesAllowedTools()` function refactor
- Ticket ZM32AK commits `1a323bb` through `2699689` — the cleanup sequence that surfaced this
- Verified empirically via three failed disable-comment attempts and one durable regex-rewrite pass, May 2026.
