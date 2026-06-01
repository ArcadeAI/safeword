---
id: 6WJ1RS
slug: codex-plugin-marketplace-packaging
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Package as Codex plugin/marketplace bundle

**Goal:** Ship safeword as a Codex plugin distributed via Codex's marketplace, parallel to the Cursor packaging ticket (DXYKJX).

**Grounded findings (researched 2026-05-31, /codex/plugins):**

- A plugin is a reusable bundle. The Plugins **overview** lists **skills + apps + MCP servers** as bundleable; it does **not** mention hooks in that section. BUT the hooks doc separately documents **plugin-bundled hooks** (`hooks/hooks.json` or manifest) and the changelog cites "default-enabled plugin hooks" (v0.133.0). **Open:** confirm on the "Build plugins" subpage that a plugin can bundle hooks (manifest format/layout) — the overview excerpt was silent on it.
- **Marketplace:** discover via the app Plugins directory (curated / shared / user-created) and the CLI `/plugins` command; install/uninstall marketplace entries.
- **Trust:** "your existing approval settings still apply" → plugin-bundled hooks are **still subject to the trust/approval gate** (JV6D1W); a plugin is not a trust bypass.

## Done when

- Decision: Codex distribution = plugin (default) vs raw `.codex/` + `.agents/skills` install, with a manifest sketch if plugin-based.
- Confirmed whether/how a plugin bundles hooks (Build-plugins subpage) and how default-enabled plugin hooks interact with trust.

## Source

developers.openai.com/codex/plugins (+ Build-plugins subpage), /hooks, changelog v0.133.0

## Work Log

- 2026-05-31 Created during hooks verification; parity with Cursor DXYKJX.
- 2026-05-31 Read Plugins overview. Bundles skills/apps/MCP; hooks-bundling to confirm on Build-plugins subpage; plugin hooks still trust-gated.
