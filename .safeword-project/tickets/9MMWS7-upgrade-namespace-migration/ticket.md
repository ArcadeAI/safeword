---
id: 9MMWS7
slug: upgrade-namespace-migration
type: feature
phase: define-behavior
status: in_progress
epic: project-namespace-default
parent: AQJ95G
depends_on: TAGWZ8
created: 2026-06-12T17:35:11.138Z
last_modified: 2026-06-12T22:30:00.000Z
scope:
  - 'Migration step in safeword upgrade, running BEFORE reconcile: when the resolved root is legacy .safeword-project/ (no explicit config root), offer the move to .project/.'
  - 'Consent gate: --migrate-namespace (yes) / --no-migrate-namespace (no) flags; interactive TTY prompt defaulting to yes ([Y/n], labeled recommended) — first interactive prompt in the CLI (node:readline/promises, zero deps); non-TTY without a flag → one-line nudge, no move.'
  - 'Git-aware move: git mv when the repo/dir is tracked (preserves history), fs rename fallback; refuse (with advisory) when .project/ already exists.'
  - 'Config reconciliation after the move: per-file paths.* overrides pointing into .safeword-project/ are rewritten to the new root.'
  - 'safeword check advisory when both .project/ and .safeword-project/ exist (transient mid-migration state).'
  - 'The non-interactive auto-upgrade hook path only ever nudges.'
out_of_scope:
  - 'Migrating configured-custom-root installs (paths.projectRoot set) — they already opted out of defaults.'
  - 'Auto-committing the move — the user owns the commit.'
  - 'Forcing migration ever — declining (flag or prompt) keeps legacy working untouched.'
done_when:
  - 'Interactive upgrade on a legacy install prompts [Y/n] defaulting to yes; accepting moves the dir (git-aware) and the run continues with reconcile on .project/.'
  - 'Declining (prompt n, or --no-migrate-namespace) leaves .safeword-project/ untouched and resolution unchanged.'
  - '--migrate-namespace migrates without a prompt; non-TTY upgrade without flags prints a one-line nudge and never moves.'
  - 'After migration the resolver lands on .project/ and per-file paths.* overrides no longer reference the legacy root.'
  - 'safeword check flags both-dirs with a zero-exit advisory naming the finish-the-migration action.'
  - 'Full suite green on a fresh build.'
---

# Upgrade-vehicle migration to .project/ + both-dirs advisory

**Goal:** `safeword upgrade` offers a legacy install the move to `.project/` as the default-recommended action (git-aware, consent-gated, never silent), and `safeword check` flags the transient both-dirs state (implements epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) DEV4 + DEV3.AC2). TAGWZ8 (resolver) and N9S5XG (scaffold) are done — this completes the epic.

**See:** epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) for personas, JTBDs, and outcomes.

## Work Log

- 2026-06-12T17:35:11.138Z Started: Created ticket 9MMWS7
- 2026-06-12T22:30:00.000Z Intake: scoped as final epic child. Migration runs pre-reconcile in upgrade; consent via flags/TTY-prompt-default-yes/nudge; git-aware move; config rewrite; both-dirs check advisory. Phase → define-behavior.
