---
id: XSDQZ0
slug: personal-level-extensibility
title: 'Make safeword extensible at the personal level — individual customizations on top of safeword and repo extensions, gitignored by default'
type: feature
phase: intake
status: in_progress
depends_on: 70G298
created: 2026-05-24T22:06:51.375Z
last_modified: 2026-05-24T22:07:00.000Z
---

# Make safeword extensible at the personal level

**Goal:** Extend the repo-level extension contract (70G298) with a third precedence layer — personal extensions that an individual contributor can layer on top of both safeword core AND repo-level extensions. Personal extensions live in a gitignored location by default so personal customizations don't leak into the team's repo.

**Why:** Engineers have personal habits — extra status-line info, custom prompts, individual quality-review preferences, personal aliases. Today, the only way to add these is to either pollute the team's `.claude/` (visible to everyone) or maintain a side script outside the project. A sanctioned personal-extension layer lets individuals customize their own experience without affecting teammates, while still composing cleanly with the team's repo extensions and safeword core.

**Depends on:** 70G298 (repo-level extensibility — personal extensions reuse the same contract with a different location and a higher precedence).

## Scope

### Personal extension location

Two candidate locations — pick one in this ticket's design phase:

- **Per-project, in-tree:** `.safeword-project/personal/` (gitignored by safeword setup automatically; added to `.gitignore` by `safeword setup`).
- **Per-project, user-scoped:** `~/.safeword/projects/<repo-fingerprint>/extensions/` (lives in user home; uniquely keyed per-repo via a fingerprint like remote URL hash or initial-commit SHA).

Driver leans **per-project, in-tree, gitignored**. Reasons:

- Easier discovery (lives where you'd expect; same shape as repo extensions).
- Single tree to navigate.
- Gitignore-by-default solves the leak risk without requiring a separate home directory.
- Matches existing safeword pattern of `.safeword-project/` as the per-project data root.

User-scoped path is cleaner if multiple worktrees / clones of the same repo should share personal customizations — but that's a marginal use case.

### Composition with repo and core

Three-tier precedence (lowest to highest):

1. **Safeword core** — ships with safeword, included by every project.
2. **Repo extensions** — `.safeword-project/extensions/` (per 70G298), committed to the repo, applies to everyone working on it.
3. **Personal extensions** — `.safeword-project/personal/` (gitignored), applies only to the individual contributor.

For each extension type, personal extensions follow the same composition rules as repo extensions but at a higher precedence tier:

- **Rules:** additive, personal rules apply on top of both core and repo rules.
- **Hooks:** registered after repo hooks; runs last.
- **Skills:** can shadow both core AND repo skills with explicit `overrides:` in manifest.
- **Templates:** personal template wins over repo and core.

### Gitignore handling

`safeword setup` (or a separate `safeword personal init`) adds the entry:

```text
# Personal safeword extensions (per-user, not committed)
.safeword-project/personal/
```

To `.gitignore` if not already present. Idempotent — re-running doesn't duplicate.

### Sharing personal customizations across machines

Personal extensions are by definition gitignored from the project repo. For users who want them across machines:

- Document a recommended pattern: maintain personal extensions in a separate git repo (e.g., `~/dotfiles/safeword-personal/`) and symlink into projects.
- Out of scope: building this sharing mechanism into safeword itself.

### Opt-out: visible-to-team personal extensions

Some users may want their personal extensions visible (for transparency, for backup, for sharing with a paired engineer). Provide an opt-out:

- `.safeword-project/personal/.committed` marker file — when present, safeword's setup doesn't auto-gitignore `.safeword-project/personal/`.
- Document the trade-off: visible-to-team means teammates can read your customizations; some users want this, some don't.

### Discovery and listing

- `safeword extensions list` (added by 70G298) gains a "Source: personal/repo/core" column.
- `safeword extensions list --personal` filters to just personal.

### Validation

- `safeword check` validates personal extensions the same way as repo extensions.
- Personal extension that conflicts with a repo extension surfaces a warning at session start (not an error — the user knowingly chose the override).

## Out of scope

- Sharing personal customizations across teammates as a built-in feature — recommend external dotfiles-style repo instead.
- Per-machine personal customizations (laptop vs desktop with different overrides) — defer; can be approximated with conditional checks in the personal extension.
- Personal extensions for non-safeword tooling (vim, shell, etc.) — out of scope; safeword's only.
- Per-project user preferences UI — out of scope; file-based config only.

## Done when

- Personal extension location is recognized at `.safeword-project/personal/` (or chosen alternative).
- `safeword setup` adds the gitignore entry idempotently.
- Three-tier composition (core → repo → personal) is documented and works.
- `safeword extensions list` shows personal extensions with their source tier.
- `safeword check` validates personal extensions.
- Worked example shows a user adding a personal status-line tweak that doesn't affect teammates.
- Opt-out (`.committed` marker) is documented and respected.

## Open questions

- **Location: in-tree gitignored vs user-home-scoped?** Driver leans in-tree (per scope rationale above). User may prefer user-home; revisit if cross-worktree sharing matters.
- **Auto-gitignore behavior** — silent additive or prompt before modifying `.gitignore`? Driver leans silent + clearly logged at setup.
- **Override precedence display** — when listing extensions, show only the winning override or all-with-shadowed-marked? Driver leans all-with-shadowed-marked (transparency).
- **Conflict warning level** — personal-overrides-repo as warning or info-only? Driver leans info-only (user knowingly opted in).

## Related

- **70G298** (repo-level extensibility) — parent dependency; this ticket reuses its contract.
- **MBGQ89** (ticket-deps schema) — personal extensions might want personal ticket-frontmatter fields; check that the schema design supports tier-private fields.

## Work Log

- 2026-05-24T22:06:51.375Z Started: Created ticket XSDQZ0
- 2026-05-24T22:07:00.000Z Drafted: Scope (3-tier precedence, gitignore handling, sharing pattern, opt-out, validation), 4 open questions; depends on 70G298
