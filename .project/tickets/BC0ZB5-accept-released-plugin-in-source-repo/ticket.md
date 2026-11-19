---
id: BC0ZB5
slug: accept-released-plugin-in-source-repo
type: task
phase: implement
status: in_progress
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/6258
scope:
  - In the Safeword source repo (isDogfoodRepo), accept the plugin version Claude's local marketplace checkout offers when it is older than the CLI version, verifying the payload against that version's identity.
  - Skip the plugin update once the offered version is installed; still update a stale or prerelease install, install a missing plugin, and re-enable a disabled one.
  - Report the accepted older plugin as an info finding, and apply the same rule to the status observation.
out_of_scope:
  - Any change for projects other than the Safeword source repo (they still require plugin version = CLI version).
  - Accepting a plugin newer than the CLI (the existing downgrade refusal stays).
  - The marketplace ref policy and the main-branch dependency audit failure.
done_when:
  - bun run safeword install in the source repo on an unreleased CLI exits 0 with Claude ready and the info finding.
  - Outside the source repo the same state still fails with CLAUDE_PLUGIN_UNVERIFIED after an attempted update.
  - A newer plugin is still refused and a payload whose identity names another version still fails verification.
  - Claude plugin suites and the full package suite pass; generated surfaces are current.
created: 2026-11-19T17:13:23.180Z
last_modified: 2026-11-19T17:13:23.180Z
---

# Let maintainers install Safeword from the source repo while the CLI is ahead of the released Claude plugin

**Goal:** bun run safeword install in the safeword repo reports Claude: ready and exits 0 when the local CLI version is newer than every promoted plugin.

**Why:** verifyPlugin required the installed plugin to equal the CLI VERSION, which no release can satisfy between releases, so every dogfood install exited 1 and retried an update that cannot advance.

**Type:** Bug

**Tests:**

- [x] Source repo accepts the older released plugin without attempting an update, with an info finding.
- [x] A fresh source checkout installs the released plugin and accepts it (verifyPlugin path).
- [x] The newest real released payload (from its git tag) installs and reports current.
- [x] A stale older plugin updates to the marketplace-offered version.
- [x] An older prerelease the marketplace no longer offers is wrong-version.
- [x] An older prerelease is not accepted even when the marketplace offers it.
- [x] A marketplace offering a plugin newer than the CLI keeps the CLI requirement.
- [x] Source repo still re-enables a disabled released plugin (no update).
- [x] Outside the source repo the version is still required (CLAUDE_PLUGIN_UNVERIFIED, update attempted).
- [x] A plugin newer than the CLI is not covered by the exception (status wrong-version; install refuses downgrade).
- [x] A released plugin whose payload identity names another version fails CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED.
- [x] Status reports the released plugin as current only inside the source repo.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-19T17:13:23.180Z Started: Created ticket BC0ZB5 retroactively for work already on PR #6258.
- 2026-10-29 RED: two source-repo tests failed (install returned failed). GREEN 031e2a7a8 (acceptedPluginVersion in packages/cli/src/claude-plugin/profile.ts; extracted releasedPluginFindings for lint complexity).
- 2026-10-29 Boundary tests fda8efa40; each killed by its targeted mutation (drop older-than check, skip identity version check, apply exception everywhere, status ignores exception).
- 2026-11-19 Merged origin/main (71b32c49b); conflicts only in generated plugin surfaces, regenerated. Claude plugin suites 245 passed; dogfood install exits 0 with Claude ready.
- 2026-11-19 tdd-review: implementation minimal and correct; gap found — no test for a fresh source checkout with no plugin installed. Added it (fixture now models the marketplace's delivered version via marketplaceVersion); killed by making verifyPlugin require VERSION.
- 2026-11-19 quality-review (cross-agent, Codex, review 889fb164): request_changes, 2 errors. (1) Accepted any older installed version incl. prereleases; root cause broader — a stale 1.0.0 would never update to promoted 1.1.0. Fixed: accept exactly the version Claude's marketplace checkout offers (plugins/marketplaces/safeword/.claude-plugin/marketplace.json), only when older than the CLI; stale/prerelease installs still update. (2) Finding message claimed the repo's .claude hooks stay authoritative — unverified (dispatch only skips legacy migration in the dogfood repo); message reworded. Representative-payload part answered: an incompatible released payload fails closed with CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED; the real 1.1.0 payload on this machine passes. New tests: stale older plugin updates; older prerelease is wrong-version; marketplace offering a newer plugin keeps the CLI requirement. Six code mutations each killed.
- 2026-11-19 quality-review pass 2 (Codex, review 0a5a7858): request_changes, 1 error — an older prerelease the marketplace itself offers was still accepted and called "released". Fixed: only a release-qualified offered version (no prerelease or build tag) qualifies; RED then GREEN, and removing the check fails the new test.
- 2026-11-19 quality-review pass 3 (Codex, review 7d3f58fe): request_changes, 1 error (same proof class as pass 1, point 2) — released-plugin tests only relabel the current payload. Fixed the class: a test rebuilds the newest real release below the CLI (git archive v1.1.0 plugin) and runs install and status against it; skips only outside CI when tags are absent (CI test job uses fetch-depth 0). Passes on the real v1.1.0 payload; removing the exception fails it.
- 2026-11-19 quality-review pass 4 (Codex, review 085596ce): approve, no findings.
- 2026-11-19 audit (diff scope vs origin/main 8974a7ad6): depcruise clean (71 modules); no agent-config, learning, domain-doc, or docs impact; no impl-plan principle trace. Test quality: three near-identical status tests consolidated into one it.each table (each row still killed by its mutation). Errors 0, warnings 0.
