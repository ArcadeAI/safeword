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
   `packages/cli/templates/skills/<name>/SKILL.md`, then run
   `scripts/dev bun scripts/parity-check.ts --fix` from the repository root to
   sync byte-identical dogfood mirrors. Stage source and generated mirrors together.

2. **Schema entries** in `packages/cli/src/schema.ts` — add
   `'.claude/skills/<name>/SKILL.md': { template: 'skills/<name>/SKILL.md' }` to
   `ownedFiles` and `'<name>/SKILL.md'` to `CURSOR_SHARED_SKILL_FILES`. Without
   them the skill exists in the repo but never ships.

3. **Cursor wrappers** in `packages/cli/src/cursor-wrappers.ts` — the
   `SKILL_CURSOR_PAIRS` mapping is derived from rule mechanics and action-skill
   declarations; parity tests verify it, and authors do not maintain another list. Then run `bun run generate:cursor-wrappers` from
   `packages/cli`; never hand-write `.cursor/rules/*.mdc` or wrapper commands.

4. **Action-skill decision** (drives step 3). Two kinds of skill:
   - **Model-invocable** (auto-triggers by description): add a
     `CURSOR_RULE_WRAPPERS` entry containing native discovery mechanics and a
     reference to the canonical skill. Its description comes from canonical
     frontmatter; `SKILL_CURSOR_PAIRS` is derived, not another list to maintain.
   - **Action entrypoint:** declare the Cursor action in `CURSOR_ACTION_SKILLS`
     and its canonical command identity in `templates/commands/<name>.md`;
     register the command name in schema's `CURSOR_COMMAND_WRAPPER_OWNED_FILES`
     name list. The same-named skill owns its purpose/procedure and invocation
     constraints. See the command authoring guide; no host description table exists.

5. **Regenerate the plugins.** Run `bun run fix:generated-surfaces` from
   `packages/cli` so the Claude plugin, Codex plugin, historical catalogue, and
   Cursor wrappers all pick up the skill; `bun run check:generated-surfaces`
   confirms they are current.

6. **Verify the shared surfaces.** During development, run targeted schema,
   skills/commands and metadata/ownership tests through `scripts/dev`. Run the
   full suite for final verification. A workflow-only test cannot prove that
   every required generated surface is registered and current.

## Why a learning, not a shipped guide

Authoring a safeword skill is a maintainer (SM) activity in this repo — customers
never do it — so this lives in `.project/learnings/`, not in the customer-facing
`.safeword/guides/`.
