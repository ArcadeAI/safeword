# Adding a Skill — Parity Checklist

Covers: new safeword skill, template+dogfood parity, SAFEWORD_SCHEMA, cursor wrappers, action-skill decision, generated surfaces.

Adding a safeword skill touches several surfaces. Miss one and the gap is usually
invisible to a targeted test run but caught by the full suite — `/explain`
(NTT094) shipped with two latent parity failures only `bun run test` surfaced.
Run the whole list before you call a new skill done. For writing the description
itself, see [skill-description-design](./skill-description-design.md); for the
exact schema entries, see `.project/guides/schema-registration-guide.md`.

## The steps

1. **Template + byte-identical dogfood.** Author the skill at
   `packages/cli/templates/skills/<name>/SKILL.md`, then copy it verbatim to the
   repo's own `.claude/skills/<name>/SKILL.md` and `.safeword/skills/<name>/SKILL.md`.
   The copies must be byte-identical — a pre-commit guard blocks the commit
   otherwise, so stage them together. Copy after any prettier/markdownlint
   formatting so lint-staged doesn't reformat only the template side
   (`.claude/` and `.safeword/` are prettier-ignored; the template is not).

2. **Schema entries** in `packages/cli/src/schema.ts` — add
   `'.claude/skills/<name>/SKILL.md': { template: 'skills/<name>/SKILL.md' }` to
   `ownedFiles` and `'<name>/SKILL.md'` to `CURSOR_SHARED_SKILL_FILES`. Without
   them the skill exists in the repo but never ships.

3. **Cursor wrappers** in `packages/cli/src/cursor-wrappers.ts` — the
   `SKILL_CURSOR_PAIRS` list there is the canonical skill→Cursor mapping the
   parity tests derive from. Then run `bun run generate:cursor-wrappers` from
   `packages/cli`; never hand-write `.cursor/rules/*.mdc` or wrapper commands.

4. **Action-skill decision** (drives step 3). Two kinds of skill:
   - **Model-invocable** (auto-triggers by description): add a
     `CURSOR_RULE_WRAPPERS` entry so a rule is generated.
   - **Action skill** (manual-only — `disable-model-invocation: true` in its
     frontmatter, e.g. `verify`, `audit`, `explain`): add it to
     `CURSOR_ACTION_SKILLS` (no rule) and add a `CURSOR_COMMAND_WRAPPERS` entry
     so `.cursor/commands/<name>.md` is generated.

5. **Regenerate the plugins.** Run `bun run fix:generated-surfaces` from
   `packages/cli` so the Claude plugin, Codex plugin, historical catalogue, and
   Cursor wrappers all pick up the skill; `bun run check:generated-surfaces`
   confirms they are current.

6. **Run the FULL `bun run test`** from `packages/cli/` — not a targeted file.
   Schema/skills parity (steps 2-4) only fails in the cross-cutting suites; a
   single-file pass means nothing for parity.

## Why a learning, not a shipped guide

Authoring a safeword skill is a maintainer (SM) activity in this repo — customers
never do it — so this lives in `.project/learnings/`, not in the customer-facing
`.safeword/guides/`.
