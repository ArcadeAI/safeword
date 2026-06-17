# Editing Existing Templates — All Install Locations

Covers: template edit parity, dogfood-parity test, .agents/ install location, installed copies checklist.

When editing an existing skill or guide template, there are more installed copies
than the obvious two. Missing any one fails the `dogfood-parity.release.test.ts`
suite even when the targeted files look correct.

## Full set of install locations

For a skill at `packages/cli/templates/skills/<name>/SKILL.md`:

| Location                                                            | Purpose                           |
| ------------------------------------------------------------------- | --------------------------------- |
| `packages/cli/templates/skills/<name>/SKILL.md`                     | Source of truth — edit here first |
| `.claude/skills/<name>/SKILL.md`                                    | Claude Code install               |
| `.agents/skills/<name>/SKILL.md`                                    | Agents install (easy to miss)     |
| `.cursor/rules/safeword-<name>.mdc` or `.cursor/commands/<name>.md` | Cursor install                    |

For a guide at `packages/cli/templates/guides/<name>.md`:

| Location                                  | Purpose         |
| ----------------------------------------- | --------------- |
| `packages/cli/templates/guides/<name>.md` | Source of truth |
| `.safeword/guides/<name>.md`              | Installed copy  |

For `packages/cli/templates/SAFEWORD.md`:

| Location                             | Purpose         |
| ------------------------------------ | --------------- |
| `packages/cli/templates/SAFEWORD.md` | Source of truth |
| `.safeword/SAFEWORD.md`              | Installed copy  |

## How this bit us

FJKM4X (2026-06-16) updated `.claude/skills/debug/SKILL.md` and `.safeword/` but
missed `.agents/skills/debug/SKILL.md`. `dogfood-parity.release.test.ts` caught it:

```
[PAIR] Drift: .agents/skills/debug/SKILL.md ≠ skills/debug/SKILL.md
```

CI failed; fix was a one-line cherry-pick. The `.agents/` directory is not
referenced in `.claude/skills/` or `.safeword/` paths so it's visually absent from
the obvious places to check.

## Verification shortcut

After editing a template skill, run:

```bash
grep -n "<distinctive phrase>" \
  packages/cli/templates/skills/ \
  .claude/skills/ \
  .agents/skills/ < name > /SKILL.md < name > /SKILL.md < name > /SKILL.md
```

All three should return the same line number and content. Then check `.cursor/`
for the skill's Cursor counterpart (rules vs commands depends on whether it's
model-invocable or action-only — see `adding-a-skill-checklist.md`).
