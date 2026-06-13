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

## Revalidated findings (2026-06-13)

- **Hooks confirmed:** current hooks docs state plugin-bundled hooks load from `hooks/hooks.json` by default, or from a `.codex-plugin/plugin.json` `hooks` entry. The manifest can point to `./`-prefixed hook files, arrays of hook files, inline hook objects, or arrays of inline hook objects.
- **Manifest basics confirmed:** current build-plugin docs show a plugin manifest at `.codex-plugin/plugin.json` with fields such as `name`, `version`, `description`, and `skills`.
- **Marketplace shape confirmed:** repo marketplaces use `$REPO_ROOT/.agents/plugins/marketplace.json`; plugin entries point at repo-local or Git-backed plugin paths and include `policy.installation`, `policy.authentication`, and `category`.
- **Trust unchanged:** installing or enabling a plugin does not automatically trust plugin hooks; Codex skips them until the user reviews and trusts the current definition.

## Done when

- Decision: Codex distribution = plugin (default) vs raw `.codex/` + `.agents/skills` install, with a manifest sketch if plugin-based.
- Confirmed whether/how a plugin bundles hooks (Build-plugins subpage) and how default-enabled plugin hooks interact with trust.

## Source

developers.openai.com/codex/plugins (+ Build-plugins subpage), /hooks, changelog v0.133.0

## Feature File Coverage

No source `.feature` file is required for this ticket in its current state. It is a packaging strategy and manifest-shape decision ticket. Executable plugin build/install behavior should get a source feature when the ticket moves from decision notes to implementation after `5DEJ8V` proves the raw Codex assets.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide whether plugin packaging should be the default Codex distribution path or a second-stage package after raw setup works.

**Research domains checked:** Codex plugin manifest format, plugin hook bundling, marketplace files, installation policy, hook trust, and safeword's existing local setup flow.

**Options:**

1. Plugin-first distribution: build plugin assets before raw generator support.
2. Raw setup first, plugin packaging second.
3. Skip plugin packaging and rely only on `.codex/` + `.agents/skills`.

**Recommend:** Use option 2. A plugin is the right distribution surface, but it should package known-good generated assets after `5DEJ8V` proves local setup. Plugin packaging does not bypass trust, so it cannot replace `JV6D1W`.

**Next:** After `5DEJ8V`, sketch `.codex-plugin/plugin.json` with `skills` and `hooks`, plus `.agents/plugins/marketplace.json` for repo-local testing.

## Work Log

- 2026-05-31 Created during hooks verification; parity with Cursor DXYKJX.
- 2026-05-31 Read Plugins overview. Bundles skills/apps/MCP; hooks-bundling to confirm on Build-plugins subpage; plugin hooks still trust-gated.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Plugin hook bundling is confirmed via hooks docs and manifest support; plugin remains second-stage distribution after raw Codex setup works, not the trust bypass.
