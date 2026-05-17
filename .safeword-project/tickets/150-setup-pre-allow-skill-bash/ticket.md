---
id: 150
type: task
phase: understand
status: open
related: [101]
created: 2026-05-17T19:36:00Z
last_modified: 2026-05-17T19:36:00Z
---

# `safeword setup` offers to pre-allow the skill-invocation bash injection

**Goal:** Have `bunx safeword setup` (and `safeword upgrade` when appropriate) detect whether `.claude/settings.json` pre-approves the two Bash patterns the skill-invocation log injection needs, and — if not — offer to add them. Prevents the failure mode at install time rather than only documenting it.

**Why:** PR #101 ([safeword#101](https://github.com/ArcadeAI/safeword/pull/101)) made the failure visible (sentinel + diagnostic) and documented the required permissions in the README FAQ. But docs are an after-the-fact recovery surface: new users still hit the silent-bash-denial failure mode on their first `/verify` or `/audit`, then have to find the FAQ. Setup-time pre-approval addresses the root cause for the common case (interactive `safeword setup`).

Customer trace: Nate (2026-05-17) — first observed in #101's session. The user ran `/verify`, Claude Code denied the bash injection, agent improvised with "run manually," done-gate hard-blocked downstream. Documented but not yet prevented at install time.

## Scope (proposed — open for converge)

**In:**

- `safeword setup` reads `.claude/settings.json` (creating if absent), checks whether `permissions.allow` covers `Bash(mkdir -p:*)` and `Bash(echo:*)` (or whether `defaultMode` is permissive: `bypassPermissions`/`acceptEdits`/`dontAsk`/`auto`).
- If not covered, interactive setup prompts the user: _"Pre-allow `Bash(mkdir -p:_)`and`Bash(echo:_)`so`/verify`and`/audit` don't trigger permission prompts? [Y/n]"_.
- On accept, merge the two patterns into the existing `permissions.allow` array (idempotent, preserve all other entries, preserve key ordering).
- Behavior in non-interactive contexts (CI, scheduled, `--yes` flag) — see open questions.

**Out of Scope:**

- Modifying user-level `~/.claude/settings.json` (project-scope only).
- Adding deny patterns or modifying existing allow entries.
- Auto-enabling permission patterns for other skills/hooks beyond `/verify` and `/audit` — scope creep; revisit when another skill needs bash injection.
- Replacing bash injection with a no-bash mechanism (separate deferred discussion).

## Open Questions (must converge before define-behavior)

1. **Default for non-interactive `safeword setup`** — silently add, silently skip, or refuse and print a hint? The same install path is used in CI by some users; surprising file edits in CI are unfriendly, but skipping reintroduces the failure mode.
2. **`safeword upgrade` behavior** — should upgrade also offer this for projects installed before the prompt existed? Or only `setup`? Risk: spamming existing users with a one-time fix-up prompt.
3. **Merge semantics when `permissions.allow` is absent vs. present-but-different patterns** — if the user has `Bash(*)` (allow-all), do nothing? If they have a similar pattern (`Bash(mkdir:*)` without the `-p`), do we suggest the more surgical replacement or just add the new one and accept overlap?
4. **Reversibility / advertise opt-out** — should the prompt include "you can revert with `safeword setup --reset-permissions`" or similar, or is the user expected to edit settings.json directly?

## Done When (placeholder — finalize after converge)

- [ ] Detection logic for "are the required patterns covered" in setup
- [ ] Interactive prompt path with accept/reject
- [ ] Non-interactive policy decided and implemented
- [ ] Idempotency: re-running `safeword setup` doesn't duplicate entries or rewrite ordering
- [ ] Test coverage for: empty settings.json, settings.json with existing allow array, settings.json with permissive defaultMode, settings.json with conflicting deny
- [ ] README FAQ entry updated to reference the setup-time offer (replacing or supplementing the manual-edit guidance)

## References

- PR #101 ([safeword#101](https://github.com/ArcadeAI/safeword/pull/101)) — sentinel + diagnostic + FAQ; this ticket is the root-cause follow-up
- README FAQ "What Claude Code permissions does safeword need?" — the manual-edit guidance this ticket supersedes (or augments)
- `packages/cli/src/schema.ts` — `SAFEWORD_SCHEMA.ownedFiles` references `.claude/settings.json` as templated; need to confirm setup's existing merge semantics for that file before designing this layer
- Claude Code permissions docs — pattern syntax, precedence (managed → settings.local → settings → user), `defaultMode` values
