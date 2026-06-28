# Impl Plan: retro auto-trigger — Codex

**Status:** planned

## Approach

**Riskiest assumption (build-time):** that the Codex rollout's tool-event signal
is `function_call` / `exec_command_begin` / `mcp_tool_call_begin` in a
`{type,payload}` JSONL, and that making the shared counter injectable leaves the
Claude path byte-identical. **Cheapest proof:** `countToolUsesCodex` against
synthetic rollout fixtures (the SM1.AC1 outline) + the TB1.AC2 scenario asserting
the Claude counter still returns 3 — both fail on slice 1 if the seam or the Codex
shape is wrong, while cheap. (The separate *empirical* unknown — does
`transcript_path` point at a non-empty raw rollout at Stop time — is deferred to a
live-Codex dump-payload spike per spec.md Open Questions; not provable here.)

The adapter surfaces a continuation only; no egress (RV9JT4 owns it). Proofs are
pure-logic + fs/process-boundary wiring.

**Proof plan + build order** (outside-in; each builds on prior green):

1. **`countToolUsesCodex(rolloutText)`** in `lib/retro-trigger.ts`. Primary proof:
   **unit** — the SM1.AC1 event-type outline (function_call/exec_command_begin/
   mcp_tool_call_begin → counts; agent_reasoning/token_count → 0; malformed skipped)
   + the Codex substance boundary (one-below/at/above). Load-bearing → first.
2. **Counter seam refactor** — add an optional `counter` param to `isSubstantial`
   (default the existing Claude `countToolUses`) and an injectable
   `countToolUses` + `resolveSessionId` to `decideRetroNudge` deps (Claude
   defaults). Proof: existing FTCQGD suite stays green (regression) + the TB1.AC2
   scenario. Behavior-preserving for Claude by construction (all defaults).
3. **Codex session-id resolver** — a thin `(input, env) => resolveRunIdentity(input,
   {env, runtime:'codex'}).sessionKey`, reusing `lib/run-identity.ts`. Proof:
   **unit** — the SM1.AC3 id-resolution outline (turn_id / CODEX_THREAD_ID /
   session_id).
4. **`codex/stop.ts` adapter.** Reads the Codex Stop payload, calls
   `decideRetroNudge(input, {countToolUses: countToolUsesCodex, resolveSessionId:
   codexResolver})`, and maps the result: a nudge string → `{decision:"block",
   reason}`; undefined → `{}` (valid JSON, no decision); always exit 0. Proof:
   **integration** spawning the real `.safeword/hooks/codex/stop.ts` — substantial
   rollout ⇒ block + path + guide; below-threshold ⇒ `{}`; Claude-shaped lines ⇒
   `{}`; second Stop ⇒ `{}`; bad input ⇒ valid JSON, exit 0.
5. **Registration + parity** — `config.toml` `[[hooks.Stop]]` entry; `schema.ts`
   for `codex/stop.ts`; `.safeword/` byte mirror. Proof: schema-drift + parity tests.

## Decisions

| Decision                | Choice                                                                                  | Alternatives considered                                  | Rejected because                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Transcript sourcing     | Use `transcript_path` from the Codex Stop payload                                        | Resolve newest rollout in `~/.codex/sessions` by id      | Payload already gives the canonical path; date-partitioned dir → fragile stale-rollout picking (figure-it-out option b) |
| Counter seam            | Inject `countToolUses` into `isSubstantial`/`decideRetroNudge`, default Claude           | Branch on agent inside the core; duplicate the gate       | Injection keeps the core agent-neutral + Claude untouched; branching couples the core to every agent |
| Codex tool-event set    | Count `function_call` / `exec_command_begin` / `mcp_tool_call_begin`                     | Count only `function_call`                                | exec + MCP calls are real work; counting only function_call undercounts shell/MCP-heavy sessions |
| Output mapping          | nudge → `{decision:"block", reason}`; none → `{}`                                        | Emit nothing on the silent path                          | Codex Stop requires valid JSON output (plain text invalid); `{}` is the safe silent response |
| Session-id resolver     | Reuse `run-identity.ts` `resolveRunIdentity(..., runtime:'codex')`                       | Re-implement the Codex id ladder in the adapter           | run-identity already encodes turn_id/CODEX_THREAD_ID/session_id precedence + is tested |

## Arch alignment

Records exist (`ARCHITECTURE.md` → "Key Decisions"). Honors: the **modular
per-agent hook adapter** pattern (like `codex/pre-tool-quality.ts` translating
Codex payloads to the shared core); **shared-core reuse** (sentinel / resolver /
orchestration from FTCQGD); **byte-parity template mirrors**; and **run-identity**
as the single source of Codex session resolution. No new cross-cutting pattern —
the counter seam is an extension point on an existing module.

## Known deviations

skip: no deviation — extends the FTCQGD core via an injection seam and reuses the
established Codex-adapter + run-identity patterns.

## Assessment triggers

- The live-Codex dump-payload spike: if `transcript_path` is empty/normalized at
  Stop time, revisit sourcing (fall back to resolving the newest rollout by id).
- Adding the Cursor adapter (KHYXY4) — confirm the counter+resolver injection seam
  generalizes (Cursor has no transcript path; the seam may need a transcript
  *loader* injection too).
- If Codex changes its rollout event names, `countToolUsesCodex`'s event set needs
  updating (pin to the documented set; tolerate unknown types as non-counting).
