# Spec: Auto-upgrade under Cursor

## Intent

Cursor users should receive safeword patch and minor updates automatically at
session start, matching the seamless upgrade path Claude Code users already
have. The Cursor path must not break session startup or pretend Cursor supports
Claude Code's `asyncRewake` notification contract.

## References

- Parent epic: `BJX7WR` — cross-agent auto-upgrade.
- Related Cursor epic: `VAX3Z2` — Cursor changelog alignment.
- Implementation PRs:
  - #447 — Run silent Cursor auto-upgrade at session start.
  - #463 — Guard silent Cursor auto-upgrade.
- Current Cursor command-hook docs: `sessionStart` is fire-and-forget and does
  not enforce blocking responses as a startup notification channel.

## Personas

- Safeword Maintainer (SM): ships framework updates once and expects every
  supported agent surface to pick them up.
- Technical Builder (TB): wants safeword-managed project guidance to stay
  current in Cursor without running manual upgrade commands.

## Vocabulary

- Silent apply path: Cursor runs the auto-upgrade check, applies eligible
  patch/minor updates, and leaves the git commit as the durable record instead
  of showing a startup message.
- Auto-upgrade lock: a short-lived git-directory lock that blocks Cursor write
  and shell gates while the silent upgrade is mutating safeword-managed files.

## Jobs To Be Done

### auto-upgrade-cursor.SM1 — Keep Cursor projects current without manual upgrades

**Persona:** Safeword Maintainer (SM)

> When I ship a safe safeword patch or minor update, I want Cursor installs to
> pick it up automatically, so users do not drift behind Claude Code users.

#### auto-upgrade-cursor.SM1.AC1 — Cursor setup includes the auto-upgrade session hook

#### auto-upgrade-cursor.SM1.AC2 — Cursor reuses the shared auto-upgrade core

#### auto-upgrade-cursor.SM1.AC3 — Claude Code behavior stays unchanged

### auto-upgrade-cursor.CM1 — Start Cursor safely while upgrades happen

**Persona:** Technical Builder (TB)

> When I open a Cursor session in a safeword-managed project, I want upgrade
> checks to run without blocking startup or sweeping my own edits into an
> auto-upgrade commit.

#### auto-upgrade-cursor.CM1.AC1 — Cursor session start stays fail-open and silent

#### auto-upgrade-cursor.CM1.AC2 — User-authored Cursor hooks are preserved

#### auto-upgrade-cursor.CM1.AC3 — Cursor write and shell gates wait during a running silent upgrade

## Outcomes

- Fresh Cursor setup writes both `session-safeword-context.ts --agent=cursor`
  and `session-cursor-auto-upgrade.ts` in `sessionStart`.
- The Cursor wrapper exits successfully with no output when no upgrade should
  apply.
- Setup/reset preserve non-safeword Cursor hooks that share an event with
  safeword hooks.
- Cursor write and shell gates deny operations while the auto-upgrade lock is
  active.
- PR #447 and PR #463 CI passed, and focused closeout checks pass locally.

## Open Questions

defer: Richer user-visible notices for Cursor major-version availability and
repeated failure caps need a separate notification strategy because Cursor
`sessionStart` is not a reliable startup message channel.
