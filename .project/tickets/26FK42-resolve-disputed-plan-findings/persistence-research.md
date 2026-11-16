# Pending dispute persistence research

Checked 2026-11-13 against current repository code and host documentation.

Safeword tickets are repository files. Tracker integration is optional, one-way,
and defaults to a minimal projection; the local ticket remains authoritative.
The built-in live tracker transport is GitHub-only; Linear has a portable
plan/apply-results path. See `packages/website/src/content/docs/reference/tracker-integration.mdx`
and `packages/cli/src/tracker-sync/payload.ts`.

The existing `ticket record-review-disposition` stores a user-confirmed decline
in ticket frontmatter, bound to the finding and accepted boundary. Its
non-interactive path returns pending without writing it. It requires an
authenticated approved review and handles warning/info findings, so it is not
yet the complete disputed-finding mechanism.

Claude cloud sessions start on a fresh clone, according to
https://code.claude.com/docs/en/settings. Cursor documents branch-based cloud
work and local handoff at https://cursor.com/changelog/cloud-in-agents-window.
Neither source establishes that an arbitrary uncommitted ticket edit is
recoverable in a new session after the original runner is reclaimed. Do not
claim that writing a local ticket alone satisfies the cloud recovery scenario.

Planning must specify and prove a durable handoff for each accepted cloud
boundary, including a visible failure when it cannot be confirmed. A tracker
could hold the record, but making it authoritative changes the existing
one-way/offline ownership contract; a mirror is not automatically a recovery
channel. A published branch or host artifact may preserve a repository ticket,
but its availability and authorization must be established per host. No
host-recovery scenario is marked verified by this research.
