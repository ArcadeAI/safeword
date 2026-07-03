---
id: RTSK9C
slug: retro-slash-command-skill
parent: RV9JT4-retro-transcript-mining
type: task
phase: verify
status: in_progress
created: 2026-07-02T23:06:00.000Z
last_modified: 2026-07-02T23:06:00.000Z
scope: |
  Add a user-invocable `/retro` command/skill so a user can run a safeword
  retrospective on the current session ON DEMAND (the retro already auto-fires at
  Stop; this is the manual path). Cross-harness: Claude Code, Cursor, Codex.

  Design (from /figure-it-out, 2026-07-02, checked each harness's latest docs):
  ONE authored source `packages/cli/templates/skills/retro/SKILL.md` wired through
  safeword's existing skill-parity machinery (same as /audit, /refactor):
    - Claude → `.claude/skills/retro/SKILL.md` (byte-mirror).
    - Codex → `.agents/skills/retro/SKILL.md` (Codex's current recommended mechanism;
      custom prompts are deprecated). Registered via CODEX_SKILL_TEMPLATE_FILES.
    - Cursor → `.cursor/commands/retro.md` + `templates/commands/retro.md`, generated
      by `generate-cursor-wrappers` from a CURSOR_COMMAND_WRAPPERS entry.
    - schema.ts ownedFiles (action-command group) + the schema.test ACTION_SKILLS set.
  Classified as an ACTION skill (a command, like /audit /verify) — Cursor COMMAND
  wrapper, NOT a rule wrapper.

  Skill body is THIN: it resolves the session transcript path (a user-invoked command,
  unlike the Stop hook, gets no payload; per-harness — Claude ~/.claude/projects,
  Codex $CODEX_HOME/sessions, Cursor transcript_path/ask-user), then defers to
  `.safeword/guides/retro.md` (extract) + `self-report-filing.md` (file) and the
  `safeword retro --transcript <path> --auto-extract` CLI. The CLI + egress guard own
  extraction, sanitization, and filing — the skill never reimplements them.
out_of_scope: |
  - The retro engine / egress guard / CLI (shipped in #601) — unchanged.
  - The Stop-hook auto-trigger — unchanged; this is the complementary manual path.
done_when: |
  - `/retro` is invocable on all three harnesses, registered from one source, parity
    clean, schema-drift + schema.test green. [DONE]
  - Live end-to-end verification per harness (esp. that the transcript-path resolution
    actually works on Cursor + Codex, which are unspiked) — tracked as a follow-up
    (GitHub issue), since it needs real Cursor/Codex sessions. [PENDING — the risk the
    /figure-it-out premortem flagged]
---

# `/retro` slash-command skill (manual on-demand retrospective)

**Goal:** Let a user trigger a safeword retro on the current session on demand, on
Claude / Cursor / Codex, via the same single-source skill-parity mechanism as the
other safeword commands.

**Why:** The retro auto-fires at Stop, but there was no user-invocable way to run it
mid-session — every other safeword workflow (/audit, /verify, /refactor) has one.

## Work Log

- 2026-07-02T23:06Z Built. Authored `templates/skills/retro/SKILL.md`; registered in
  schema.ts (CODEX_SKILL_TEMPLATE_FILES + action-command ownedFiles) + CURSOR_COMMAND_WRAPPERS;
  ran generate-cursor-wrappers; mirrored to `.claude/skills/retro/` + `.agents/skills/retro/`;
  added `retro` to schema.test ACTION_SKILLS. Verified: parity 202 pairs + 3 contracts in
  sync, schema.test + reconcile 82/82, tsc clean. Live per-harness end-to-end verification
  (transcript-path resolution on Cursor/Codex) tracked as follow-up GitHub issue #624.
