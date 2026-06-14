---
id: BM8HG4
slug: arcade-gateway-wizard
title: "Interactive 'safeword gateway init' wizard — detect toolkits, deeplink to Arcade, write MCP config"
type: feature
phase: intake
status: in_progress
created: 2026-05-25T14:14:58.077Z
last_modified: 2026-05-25T14:15:30.000Z
---

# Interactive `safeword gateway init` wizard

**Goal:** Add a new `safeword gateway init` command that walks the developer through wiring up tool access for their dev agent — detects toolkits the project likely needs (GitHub, Linear, Slack, Gmail, etc.), opens a pre-filled Arcade gateway-creation URL in the browser, accepts the resulting gateway URL back from the user, and writes `.claude/mcp_servers.json` so Claude Code / Cursor / etc. instantly have the configured tools available.

**Why:** Today, a developer running `bunx safeword setup` gets a beautifully configured _dev workflow_ (linters, hooks, skills, commands) but their agent still has no tool access. Wiring up tools is left as an exercise — read Arcade docs, figure out which toolkits to use, create a gateway, configure auth, point Claude Code at it. That gap is significant adoption friction. The 2026 ecosystem norm is bundled distribution: [Claude Code plugins](https://code.claude.com/docs/en/mcp) ship MCP server configs alongside skills/hooks; [AWS Agent Toolkit](https://aws.amazon.com/products/developer-tools/agent-toolkit-for-aws/) and [Salesforce Agentforce Vibes](https://developer.salesforce.com/blogs/2026/04/new-developer-edition-agentforce-vibes-claude-mcp) both ship preconfigured tool bundles. Safeword can participate in this pattern cheaply because Arcade gateways are already lightweight, multi-user URLs ([Arcade MCP Gateway Pattern](https://www.arcade.dev/blog/mcp-gateway-pattern/)).

**Sourced from:** figure-it-out research session 2026-05-25 — confirmed Arcade gateways are URL-addressable multi-user objects with per-user OAuth per toolkit; user pushed past "template only" recommendation toward an interactive wizard.

## Scope

### New command: `safeword gateway init`

Not part of `safeword setup` (which stays fast and non-interactive). Separate command, invoked on demand. `safeword setup` mentions it in the closing summary: "Want tool access for your dev agent? Run `safeword gateway init` — takes 3 minutes."

### Detection phase

When invoked, safeword inspects the project for signals about which toolkits would be relevant. v1 detection (narrow):

- **GitHub** — `git remote` includes `github.com` → suggest GitHub toolkit.
- **Linear** — `.claude/`, CLAUDE.md, or any md file references `mcp__Linear_*` or `linear.app`, OR `@linear/sdk` in any package.json → suggest Linear toolkit.
- **Slack** — `@slack/web-api`, `@slack/bolt`, `slack-sdk` in any package.json, OR `SLACK_*` env vars in `.env*` files → suggest Slack toolkit.
- **Gmail / email** — `gmail`, `nodemailer`, `@sendgrid/mail` in any package.json, OR `SMTP_*` / `GMAIL_*` env vars → suggest Gmail toolkit.

Detection drives the _default suggestion_ only. The user always confirms / edits.

### Wizard flow

```text
$ safeword gateway init

Inspecting project for relevant toolkits...
✓ Detected GitHub remote
✓ Detected Linear references in CLAUDE.md
✓ Detected @slack/web-api in apps/worker/package.json
✓ Detected gmail mcp tool

Configure an Arcade gateway for your dev agent?

  [x] GitHub — PR / issue / review / comment / file
  [x] Linear — ticket create / update / search / comment
  [x] Slack — post / react / search
  [x] Gmail — send / search / draft
  [ ] Jira / Notion / Confluence / Salesforce / others available

[Y]es  [N]o  [E]dit selection  [W]rite-template-only

> y

Opening Arcade gateway-creation page in browser...
(URL: https://arcade.dev/gateway/new?source=safeword&tools=github,linear,slack,gmail)

Once you've created the gateway in the Arcade dashboard, paste your
gateway URL here:

> https://api.arcade.dev/mcp/gateway/abc-123-def

✓ Gateway URL captured
✓ Wrote .claude/mcp_servers.json

Next steps:
- Open Claude Code (or Cursor / VS Code) and reload MCP servers
- Each toolkit will prompt for OAuth on first use (per-user)
- See https://safeword.dev/docs/gateway for troubleshooting
```

### Provisioning via deeplink (not API integration)

safeword does NOT need an Arcade API key. Pattern: open pre-filled URL → user creates gateway in the Arcade dashboard (existing flow, OAuth handled there) → user pastes resulting URL back to terminal. This is the [`vercel link`](https://vercel.com/docs/cli/link) UX — CLI opens browser → user clicks → CLI completes. No API credential storage in safeword. No reinventing Arcade onboarding. No brittleness against Arcade API changes.

### MCP config written

`.claude/mcp_servers.json` (or whatever the project's Claude Code config path is):

```json
{
  "mcpServers": {
    "arcade-gateway": {
      "url": "https://api.arcade.dev/mcp/gateway/abc-123-def"
    }
  }
}
```

Idempotent — re-running the wizard updates the URL; preserves other MCP servers already configured.

### Persistence

Selected toolkits + gateway URL stored in `.safeword/config.json`:

```json
{
  "gateway": {
    "url": "https://api.arcade.dev/mcp/gateway/abc-123-def",
    "tools": ["github", "linear", "slack", "gmail"],
    "createdAt": "2026-05-25T14:30:00.000Z"
  }
}
```

Re-running `safeword gateway init` is silent if config exists — surfaces current state and offers `--reset` or `--edit`.

### Non-interactive / CI mode

- `safeword gateway init --gateway-url <url>` — skip wizard, write the config directly.
- `safeword gateway init --skip` — no-op, no detection.
- `safeword setup` never prompts; only mentions the wizard in summary output.

### Template-only fallback ([W] in wizard)

If user picks "[W]rite-template-only" or has no internet, safeword writes a `.claude/mcp_servers.example.json` with placeholder URL and a comment block explaining the manual steps. Matches the option-A recommendation from the figure-it-out session — preserved as a fallback path.

## Out of scope

- Programmatic gateway creation via Arcade API (no API-key handling in safeword v1).
- Per-toolkit OAuth flow (Arcade handles this when first tool is invoked).
- Toolkit-specific configuration UI (e.g., "select which GitHub repos" — Arcade dashboard owns this).
- Auto-detection of every toolkit Arcade supports — start with 4 signals (GitHub, Linear, Slack, Gmail); broader detection is incremental.
- Auto-publishing safeword as a Claude Code plugin in the marketplace — that's a separate, bigger architectural question (see Related).
- Multi-gateway support (one gateway per project for v1).
- Reading from other MCP-config locations (Cursor's, VS Code's, Continue's) — start with Claude Code's `.claude/mcp_servers.json`; expand later.

## Done when

- `safeword gateway init` command exists and is registered in the CLI help.
- Detection phase identifies the 4 v1 signals correctly across fixture projects.
- Wizard opens the pre-filled URL in the user's default browser.
- User-supplied gateway URL is validated (format check) and written to `.claude/mcp_servers.json` idempotently.
- `.safeword/config.json` persists toolkit selection + gateway URL.
- Re-running the wizard on a configured project surfaces current state without re-prompting.
- `--gateway-url` and `--skip` flags work for non-interactive use.
- Template-only fallback writes the example config when user opts out.
- `safeword setup` closing summary mentions `safeword gateway init`.
- README documents the wizard with a 3-step happy-path walkthrough.

## Open questions

1. **Arcade URL-param feature** — does `https://arcade.dev/gateway/new?source=safeword&tools=github,linear,slack,gmail` work today (preselect toolkits in the dashboard), or does safeword open a generic URL and the user selects manually in the dashboard? Driver leans: ship v1 assuming manual selection in the dashboard; file a paired ticket in arcade-monorepo requesting the URL-param feature as a UX upgrade.
2. **Toolkit selection persistence** — `.safeword/config.json` field shape under `gateway:` — verify it doesn't collide with other safeword config sections.
3. **Detection conflict** — what if a project has multiple GitHub remotes, or Linear refs in a sibling repo? Driver leans: detect from project root only; surface ambiguity as a wizard prompt.
4. **Promotion to `safeword setup`** — should `safeword setup` eventually prompt-by-default once the wizard is mature (rather than only mentioning it)? Driver leans no for v1 (preserves fast non-interactive setup); revisit after telemetry on how many users run the wizard.
5. **Reading existing MCP config** — if `.claude/mcp_servers.json` exists with an arcade-gateway entry, do we overwrite, merge, or refuse? Driver leans merge (preserve other entries; update arcade entry).

## Related

- **Future ticket (not filed):** Arcade-side `?tools=` URL-param feature in `arcade-monorepo` — small UX upgrade; file once v1 lands and the manual flow is in use.
- **Future ticket (not filed):** "Safeword as Claude Code plugin" — bigger architectural reshape; could subsume the `bunx setup` model entirely. Worth its own research ticket; not blocked on this one.
- **70G298** (repo-level extensibility) — orgs may want to override toolkit detection patterns; the extension contract from 70G298 should accommodate detection-pack extensions.
- **3N3Q7B** (principles rubric) — the wizard demonstrates principle 4 (Contribute, then converge) — propose detected toolkits, embed open question, narrow until acceptance.

## Work Log

- 2026-05-25T14:14:58.077Z Started: Created ticket BM8HG4
- 2026-05-25T14:15:30.000Z Drafted: Wizard scope (detection + deeplink + persistence + CI mode), 5 open questions; positioned as separate command (not in `safeword setup`); deeplink-not-API design avoids credential storage
