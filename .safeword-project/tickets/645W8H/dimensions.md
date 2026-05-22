# Dimensions — session-reentry-brief (645W8H)

Behavioral dimensions derived from locked scope + done_when + the multi-session concern surfaced during clarify.

| Dimension              | Partitions                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Write trigger          | Next: present with imperative / Next: absent / Next: empty value                                                   |
| Field provenance       | All deterministic fields hook-injected / agent-authored Next: only / no-ticket sentinel rendered                   |
| Concurrency            | Single writer / two concurrent writers (stress emerges from POSIX append atomicity, not enumerated)                |
| Read filter            | Known session_id (`/resume <name>`) / most-recent session_id (`--continue`) / no specific session (fresh `claude`) |
| Log state on read      | Empty or missing → silent / current-session-only / multi-session                                                   |
| Render budget          | ≤3 entries (render all) / >3 entries (last 3 only) / each entry exactly one line                                   |
| Multi-session trailer  | _Removed post-elicit (Q2 → silent unless conflict). Replaced by Conflict detection._                               |
| Conflict detection     | No overlap / single dirty-file overlap / multiple dirty-file overlaps                                              |
| Surfacing channel      | Silent additionalContext (Claude recall) / Status-line ambient (user glance)                                       |
| Adversarial resilience | Missing session_id in hook stdin / agent Next: contains newlines or markdown                                       |

## Provenance

- **Cognitive research:** Parnin & Rugaber 2011 (intent > state); Altmann & Trafton 2002 (goal-activation decay); Czerwinski et al. 2004 (reconstructing location is the hardest part).
- **Anthropic documentation:** memory-tool multi-session pattern (progress log + feature checklist); Effective Context Engineering essay (smallest possible high-signal tokens, just-in-time loading).
- **User-surfaced concern:** multi-session collision in one worktree (filesystem-shared state).
- **Post-elicit research (2026-05-22):** Trafton & Altmann CogSci 2004 (subtle cues don't help, blatant cues do) + IDE convention (VS Code, Zed, JetBrains ambient persistence > "welcome back" modals) → Q1 = D (silent additionalContext + status-line ambient). Anthropic memory-tool docs ("always view memory directory") + Parnin task-aligned cues + Czerwinski residue → Q3 = A (fresh shows most-recent tagged from-another-session). Q2 = silent-unless-conflict; conflict = file edited by another session AND dirty in `git status`.
