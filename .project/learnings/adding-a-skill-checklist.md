# Adding a Skill — Parity Checklist

Covers: new safeword skill, template+dogfood parity, SAFEWORD_SCHEMA, cursor pair, action-skill decision.

Adding a safeword skill touches five surfaces. Miss one and the gap is usually
invisible to a targeted test run but caught by the full suite — `/explain`
(NTT094) shipped with two latent parity failures only `bun run test` surfaced.
Run the whole list before you call a new skill done. For writing the description
itself, see [skill-description-design](./skill-description-design.md).

## The five steps

1. **Template + byte-identical dogfood.** Author the skill at
   `packages/cli/templates/skills/<name>/SKILL.md`, then copy it verbatim to the
   repo's own `.claude/skills/<name>/SKILL.md`. The two must be byte-identical —
   a pre-commit guard blocks the commit otherwise, so stage both together. Copy
   after any prettier/markdownlint formatting so lint-staged doesn't reformat
   only the template side and drift the pair (`.claude/` and `.safeword/` are
   prettier-ignored; the template is not).

2. **`SAFEWORD_SCHEMA` entry** in `packages/cli/src/schema.ts` — add
   `'.claude/skills/<name>/SKILL.md': { template: 'skills/<name>/SKILL.md' }` so
   `reconcile` actually installs the skill into customer projects. Without it the
   skill exists in the repo but never ships; `bun run check:schema` (and the full
   suite) flags the template-vs-schema mismatch.

3. **`SKILL_CURSOR_PAIRS` fixture entry** in
   `packages/cli/tests/fixtures/skill-cursor-pairs.ts` — the canonical
   skill→cursor mapping the parity tests in `tests/schema.test.ts` and
   `tests/integration/skills-commands-validation.test.ts` derive from. A skill
   absent from this fixture fails parity.

4. **Action-skill decision** (drives steps 2-3). Two kinds of skill:
   - **Model-invocable** (auto-triggers by description): `cursorRules:
['safeword-<name>']` in the fixture, and register the
     `.cursor/rules/safeword-<name>.mdc` rule in the schema.
   - **Action skill** (manual-only — has `disable-model-invocation: true` in its
     frontmatter, e.g. `verify`, `audit`, `explain`): `cursorRules: undefined` in
     the fixture, and register a `.cursor/commands/<name>.md` command instead of a
     rule. `tests/schema.test.ts`'s `ACTION_SKILLS` set must list it.

5. **Run the FULL `bun run test`** from `packages/cli/` — not a targeted file.
   Schema/skills parity (steps 2-4) only fails in the cross-cutting suites; a
   `vitest run tests/<one-file>` pass means nothing for parity.

## Why a learning, not a shipped guide

Authoring a safeword skill is a maintainer (SM) activity in this repo — customers
never do it — so this lives in `.safeword-project/learnings/`, not in the
customer-facing `.safeword/guides/`.
