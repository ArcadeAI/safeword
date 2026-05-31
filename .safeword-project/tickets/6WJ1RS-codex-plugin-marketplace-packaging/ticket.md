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

**Goal:** Ship safeword as a Codex plugin (bundling hooks + AGENTS.md + skills/commands + MCP) distributed via Codex's marketplace, parallel to the Cursor Team-Marketplace ticket (DXYKJX).

**Why:** The Codex changelog (v0.133.0) shows "marketplace CLI commands, version-aware sharing... and default-enabled plugin hooks." A plugin bundle is a cleaner install + upgrade path than scattering `.codex/` files, and "default-enabled plugin hooks" interacts with the trust model (JV6D1W).

## Investigation (docs not yet read end-to-end)

- Read developers.openai.com/codex/plugins + the Security → Plugin page: manifest format, what a plugin can bundle, install/enable modes, and how plugin-bundled hooks relate to the trust gate (are default-enabled plugin hooks auto-trusted, or still user-reviewed?).
- Compare with the Cursor plugin packaging (DXYKJX) to share a distribution strategy.

## Done when

- Decision on whether Codex distribution is plugin-based (default) vs raw `.codex/` install, with a manifest sketch if plugin-based.
- Trust/enable semantics of plugin-bundled hooks documented (ties to JV6D1W).

## Source

developers.openai.com/codex/plugins, /security/plugin; changelog v0.133.0 (marketplace, default-enabled plugin hooks)

## Work Log

- 2026-05-31 Created during hooks-doc verification pass; parity with Cursor DXYKJX.
