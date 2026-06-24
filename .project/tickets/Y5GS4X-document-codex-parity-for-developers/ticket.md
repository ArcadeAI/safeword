---
id: Y5GS4X
slug: document-codex-parity-for-developers
type: task
status: done
phase: done
created: 2026-06-14T11:51:36.329Z
last_modified: 2026-06-24T15:42:13Z
scope:
  - Update the README parity and getting-help sections so Codex is named beside Claude Code and Cursor, not implied as a hidden/secondary surface.
  - Update website docs that explain supported agents, setup output, hooks, skills, commands, and configuration so they mention Codex's installed assets: `.codex/config.toml`, `.agents/skills/`, and `.safeword/hooks/codex/pre-tool-quality.ts`.
  - Call out Codex's trust step clearly: setup can write the config, but the user still needs to review/trust project hooks before relying on Codex gates.
  - Preserve platform-specific truth: Claude Code skills expose slash-command behavior, Cursor has explicit command files, and Codex consumes safeword's repo-scoped skills and hook config.
out_of_scope:
  - Changing Codex hook behavior, minimum-version logic, or the setup schema. This is documentation drift only.
  - Implementing live Codex smoke coverage; that belongs to `codex-live-parity-smoke`.
  - Reworking the agent-surface refactor epic; this ticket just makes current shipped behavior visible.
done_when:
  - README and website docs describe safeword as supporting Claude Code, Cursor, and Codex wherever the current docs describe supported agent surfaces.
  - The documented Codex file paths match the schema/template paths.
  - The docs do not imply Codex gets `.claude/commands/` or `.cursor/commands/` equivalents.
  - Relevant docs format/lint checks pass.
---

# Document Codex parity for developers

**Goal:** Make safeword's public developer docs reflect Codex as a first-class installed surface alongside Claude Code and Cursor.

**Why:** Audit found the implementation already ships Codex config, skills, and hook wiring, while the docs still describe parity primarily as Claude Code / Cursor. That misleads maintainers and users about what setup actually installs.

## Work Log

- 2026-06-14T11:51:36.329Z Started: Created ticket Y5GS4X
- 2026-06-14T12:00:00.000Z Intake: Force-ranked as P1 because docs drift hides a shipped platform surface. Scoped to docs only; implementation parity is already covered by Codex tickets and schema tests.
- 2026-06-14T11:56:35Z Revalidated: Schema already ships Codex skills under `.agents/skills/`, Codex project config under `.codex/config.toml`, and a Codex PreToolUse adapter at `.safeword/hooks/codex/pre-tool-quality.ts`. Setup/upgrade tests already cover creation, preservation, trust prompt, and minimum-version warning, so this remains docs-only.
- 2026-06-14T11:56:35Z Figure-it-out: Best plan is targeted docs parity, not implementation. Update README plus website landing, quick start, FAQ, CLI reference, configuration, and hooks/skills reference. Name Codex where support is equivalent; explicitly avoid saying Codex has slash-command files.
- 2026-06-14T12:08:24Z Implemented: Updated README plus website landing, quick start, FAQ, CLI reference, configuration, and hooks/skills reference. Added Codex installed paths, hook trust guidance, and command-surface caveats without changing implementation.
- 2026-06-14T12:08:24Z Verified: Prettier unchanged, markdownlint clean, website build clean, website typecheck clean, and wording scan has no remaining Claude/Cursor-only support claims in touched docs.
- 2026-06-24T15:42:13Z Resolved in local tracker: frontmatter moved to `status: done`, `phase: done` after completion evidence and to align local status with shipped work evidence.
