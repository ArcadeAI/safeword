# Surfaces

<!--
Project-wide feature surface inventory. A feature surface is a supported
product, agent, runtime, protocol, client, or deployment context where behavior
must keep working. Examples: Claude Code, OpenAI Codex, Cursor, Web app, Mobile
app, MCP, Cloud service, Self-hosted Azure.

BDD intake reads this file after personas.md and glossary.md so specs can name
which contexts a feature affects. Keep recurring, ambiguous, or high-risk
surfaces here. One-spec-only contexts can stay under that ticket's ## Surfaces
section.

FORMAT

Each surface is a `##` block with:

- A name in the header (e.g., `## Claude Code`)
- A `**Kind:**` line (required): Agent runtime, UI client, Protocol/API,
  Deployment mode, Cloud service, Self-hosted environment, CLI, or a
  project-specific kind.

Optional fields:

- `**Audience:**` — persona or team most affected.
- `**Examples:**` — concrete commands, routes, files, workflows, protocols, or
  deployment modes.
- `**Coverage notes:**` — how specs and scenarios prove this surface still
  works.
- `**Do not confuse with:**` — related surfaces with distinct behavior.

EXAMPLE (uncomment, customize, then delete this comment)

## Claude Code

**Kind:** Agent runtime
**Audience:** Technical Builder
**Examples:** `.claude/skills`, slash commands, Claude hooks

## OpenAI Codex

**Kind:** Agent runtime
**Audience:** Technical Builder
**Examples:** `.agents/skills`, Codex instructions, Codex hook adapter
-->
