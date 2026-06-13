---
id: FM5EDA
slug: ticket-slug-rename
type: feature
phase: intake
status: open
created: 2026-05-26T05:35:46.561Z
last_modified: 2026-05-26T05:35:46.561Z
parent_pr: 160
scope:
  - New `safeword ticket rename <id> <new-slug>` CLI subcommand that renames the directory and updates `slug:` in frontmatter atomically
  - Lint rule that warns (does not error) when a ticket's directory suffix does not match the frontmatter `slug:` field — surfaces drift without forcing action
  - Slug validation reuses the existing `normalizeSlug` / `SlugError` machinery so rename and create share rules
  - CLI must refuse to rename if any tracked file outside the ticket folder references the old directory name verbatim (catches breakage before it ships)
out_of_scope:
  - Auto-renaming on frontmatter edit — explicit user action only (matches the ARK two-phase identity pattern: stable ID, mutable label, rename is an event)
  - Cascading renames across forks / mirrors — local working copy only
  - Retroactive rename of closed/done tickets (see [closed-tickets-stay-opaque](../../learnings/closed-tickets-stay-opaque.md))
  - Slug history / aliases / redirect tables — out of scope; if you need history, use `git log --follow` on the directory
done_when:
  - `safeword ticket rename FM5EDA new-name` succeeds, renames the directory, updates frontmatter, and shows the new path
  - Linter emits a warning (not error) when frontmatter `slug:` ≠ dir suffix
  - End-to-end test: create ticket, edit frontmatter slug to introduce drift, lint catches it, run rename CLI, lint clean
  - External-reference check refuses to rename when grep finds the old dir name in non-test source
---

# ticket-slug-rename

**Goal:** Make ticket slug changes explicit and safe — explicit because the rename is a deliberate event the user invokes, safe because drift between dir name and frontmatter is detected before it can mislead.

**Why:** PR #160 added `{ID}-{slug}/` folder names for legibility but left open what happens when a slug changes post-creation. Auto-rename on frontmatter edit was rejected after research: every reference platform (Linear/Jira/GitHub, Astro/Hugo/Obsidian, ARK/DOI) uses **stable opaque ID, mutable label, explicit rename**. The opposite — surprise filesystem moves under the user — is the GitHub-branch-rename failure mode, where transparent redirects silently break CI and raw refs.

**Why a CLI not a hook.** The slug field is a label; editing it should not move files under the user. A `rename` command is a named operation that produces a known event, audit-loggable in the work log.

## Research note

Research summary in PR #160 conversation (see also [ARK two-phase identity spec](https://www.ietf.org/archive/id/draft-kunze-ark-34.html)). Steelman for auto-rename: `ls` is the primary discovery surface for a filesystem ticket store. Counter: no external code/docs currently reference ticket dir paths (verified via grep in PR #160), so the auto-rename "cost is hypothetical" argument cuts both ways — equally cheap to add later if drift becomes common.

## Work Log

- 2026-05-26T05:35:46.561Z Started: Created ticket FM5EDA — follow-up to PR #160 [ticket-folder-legibility](../CXXB3P-ticket-folder-legibility/ticket.md).
