# Impl Plan: Retro filer subagent gate — reliable, invisible cloud filing

**Status:** implemented

## Approach

Riskiest assumption: a Stop-time continuation carrying an imperative dispatch is
acted on by the agent rather than treated as injected noise — proven cheapest by
the Claude Stop hook scenario (`decision:"block"` with the dispatch text), which
is the same channel/precedent as the production stop-quality gate, and observed
live: the dogfooded gate fired in the implementing session and was acted on.

Per-scenario proof plan (unit + integration, per testing/SKILL.md highest
practical scope):

- Gate decision (fire/silent/cap/reset/per-session): unit,
  `tests/hooks/retro-filing-gate.test.ts` — pure decision logic over a temp
  spool; integration would add subprocess cost without new coverage.
- Claude Stop adapter (block/stop_hook_active/config-off/no-session/cap):
  integration, `tests/integration/stop-retro-filing.test.ts` — spawns the real
  dogfood hook under bun; the JSON contract at the process boundary is the
  behavior.
- Codex Stop adapter (dispatch, config-off, cap; architecture-nudge precedence
  by code order): integration, `tests/integration/codex-stop-retro.test.ts`
  (extended) — same subprocess harness as CDX602's suite.
- Cursor Stop adapter (filing outranks retro-available nudge; quality-review
  wins edit stops; config-off): integration,
  `tests/integration/cursor-stop-retro.test.ts` (extended).
- Install surface (schema entries, shared/owned dirs): existing
  setup/reset/check command suites re-run green; the file map is declarative.

Build order executed: gate lib first (load-bearing slice — if the decision
model was wrong, everything downstream changes), then Claude hook + settings
wiring, then Codex/Cursor adapters, then agent definitions + guide/nudge text.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Delivery channel | Per-harness sanctioned Stop continuation (block/followup) | Re-firing the muted additionalContext nudge; code-owned transport (git dead-letter, ingest endpoint) | Muted channel forbids imperatives and was observed ignored (#628); git creds are host-repo-scoped and an ingest endpoint means operating infra a domain-restricted proxy may still block |
| Filing executor | Shipped `safeword-retro-filer` subagent, foreground | Inline filing by the main agent; background subagent | Inline drags spool/search/issue bodies into the main context (pollution) and a five-step procedure is less compliable than one dispatch; background completion notifications re-open visible turns and race teardown |
| Retry semantics | At-least-once, spool-drain as ack, 2-attempt cap per batch key | Fire-once (status quo); unlimited retry | Fire-once is at-most-once delivery into a lossy receiver (#628's core failure); unlimited retry could hijack every stop when filing is impossible |
| Attempt state | Sibling `.filing-attempts` JSON marker keyed by batch hash | Reusing the `.nudged` marker | The nudge's fire-once semantics must stay independent so the backstop still works when the gate is capped out |
| Agent definition formats | One markdown template for Claude+Cursor, TOML for Codex | Relying on Cursor reading `.claude/agents/` | Cross-reading is a documented convenience but a drift risk; the installer already handles per-harness duplication |

## Arch alignment

- Follows the BNGK9W two-lane retro transport design (code-owned REST when
  authenticated; agent-mediated otherwise) — this hardens lane 2 rather than
  adding a third lane.
- Preserves ZFGWS1 (Claude extraction stays async/invisible) and CDX602's
  invisible Codex extraction; narrows CDX602's "Stop never blocks" to
  extraction only, recorded in spec.md Fixed Design per the #628 maintainer
  decision.
- Reuses the shared self-contained hook-lib pattern (node:* only modules under
  `templates/hooks/lib/` consumed by CLI and customer-repo hooks alike).

## Known deviations

- CDX602's spec line "Stop never returns `{decision:"block"}`" is deliberately
  relaxed for the filing dispatch (rare, attempt-capped, dispatch-only), per the
  maintainer-approved #628 design. Recorded in spec.md and the codex/stop.ts
  header.

## Assessment triggers

- Cursor or Codex changes subagent definition locations/formats or MCP
  inheritance (re-verify `.cursor/agents`/`.codex/agents` docs).
- Claude ships a way to force a tool call (not just a continuation) at Stop —
  the dispatch could become code-owned.
- Evidence that 2 attempts is the wrong cap (findings still stranded, or users
  report turn-end hijacks) — revisit cap or add per-install config.
- The final-turn async extraction gap on Claude becomes a measured loss source
  — revisit synchronous extraction trade-off (ZFGWS1).
