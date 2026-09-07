# Work Log: Route local retros through the durable server

## 2026-08-29

- Created clean worktree `retro-server-cutover` from `origin/main` at `2da3fe29c` on branch `codex/route-local-retros-through-server`.
- Confirmed #3477 already delivered ordered local batch collection and #3476 separately owns Claude Cloud transport.
- Created GitHub issue #3514 and local feature ticket 4F5744.
- Current main keeps the relay readiness manifest disabled and falls back to direct GitHub filing. The relay route still requires five customer-side environment values, including a credential and external outbox.
- Intake direction: serve NTB zero-setup use, TBU durable/retry-safe behavior, and SWM evidence-gated cutover without expanding into cloud carriers or retention work.
- JTBD set confirmed by the user. Product comparison found Sentry's transferable split: public write-only ingestion identity, privileged management kept server-side, and local caching across transport loss. SafeWord retains its stronger request-identity and dedupe guarantees and rejects per-customer key setup.
- Product principle confirmed. Drafted seven Rules: zero-setup and invisible delivery; immutable request identity and ownership-safe recovery; raw-body-only duplicate authority; and evidence-gated, observable local cutover across Claude, Codex, and Cursor.
