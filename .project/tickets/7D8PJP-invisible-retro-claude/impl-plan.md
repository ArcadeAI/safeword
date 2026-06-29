# Impl Plan: Invisible retro — synchronous headless `claude -p` extraction

**Status:** planned

## Approach

**Riskiest assumption:** a hook-spawned headless `claude -p` can authenticate and
extract in a Claude **cloud** container, out-of-band, without polluting the user's
conversation. This was already de-risked by a **live fire** this session (issues
550/553: `claude -p` without `--bare` authenticated, 41s/$0.10, filed a real
issue). The
residual build risk is the wiring: the hook must run that extraction synchronously
and emit nothing to the conversation, and the egress guard must still hold
end-to-end. The load-bearing wiring slice is
`NTB1.AC1.auto_extracted_findings_pass_the_egress_guard` (real `safeword retro
--auto-extract`, `claude -p` + GitHub transport mocked, assert no secret/path
reaches the body) — if the new --auto-extract path bypasses the guard, it fails
there while still cheap.

Per-behavior ownership and proof (highest practical scope from `testing/SKILL.md`):

| Behavior (AC) | Owning component | Primary proof | Why enough |
| --- | --- | --- | --- |
| Transcript digest (TB2.AC3) | `hooks/lib/retro-extract.ts` `buildDigest` | unit | pure reduction; assert marker survival + oversized-body omission ✅ done (`22a7e34`) |
| Headless argv (TB2.AC1) | `retro-extract.ts` `buildExtractArgv` | unit | pure builder; assert flags present/absent |
| Recursion guard (NTB1.AC2 read half) | `retro-extract.ts` `isRetroChild` | unit | pure predicate over env |
| Synchronous runner + spawn contract + fail-open (TB1.AC2, TB2.AC2, TB1.AC1 fail-open) | `retro-extract.ts` `runHeadlessExtraction` (subprocess injected) | unit | spawn args (digest in, neutral cwd, child env sentinel), awaited-not-detached, error→no output |
| Stop hook emits nothing + sentinel arms (TB1.AC1, NTB1.AC2, SM1.AC2) | `hooks/stop-retro.ts` rewrite | unit (hook) | assert no `additionalContext`; early-return on sentinel; fires-once-then-suppressed via existing substance gate + sentinel |
| Egress guard unchanged, end-to-end (NTB1.AC1) | `src/commands/retro.ts` `--auto-extract` | **integration** (wiring) | real pipeline; only `claude -p` subprocess + GitHub transport mocked |
| Transport selection (SM1.AC1) | `src/retro/` transport factory | integration | no token → agent transport; token → existing REST |

**Build order** (leaf-first; the live fire already proved the riskiest assumption,
so units sequence by dependency):

1. `buildDigest` (TB2.AC3) — no deps. ✅ done.
2. `buildExtractArgv` (TB2.AC1) — no deps.
3. `isRetroChild` (NTB1.AC2 read half) — no deps.
4. `runHeadlessExtraction` (TB1.AC2, TB2.AC2, TB1.AC1 fail-open) — composes 1–3, subprocess injected.
5. `stop-retro.ts` rewrite (TB1.AC1, NTB1.AC2, SM1.AC2) — composes 4 + the existing trigger core; the load-bearing invisibility wiring.
6. `safeword retro --auto-extract` (NTB1.AC1) — composes 4 + the existing egress pipeline; carries the end-to-end leak integration scenario.
7. Transport selection (SM1.AC1) — agent vs REST behind the existing `IssueTracker` port.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Trigger output | Run extraction in-hook; emit no `additionalContext` | Keep the nudge but spawn a fork subagent | The nudge + Task call still appear in the user's conversation — not invisible |
| Headless invocation | `claude -p` WITHOUT `--bare` | `claude -p --bare` | `--bare` breaks cloud managed-proxy auth (proven live: Authentication error) |
| Execution mode | Synchronous within the hook | Detached background process | Detached survival past session end / container reclaim is undocumented + buggy (#41577, #25147) |
| Recursion guard | `SAFEWORD_RETRO_CHILD=1` env sentinel checked by safeword hooks | `--bare` (skips hooks); `CLAUDE_CODE_CHILD_SESSION` | `--bare` breaks auth; `CLAUDE_CODE_CHILD_SESSION` is already `1` in the normal tool context |
| Extractor context size | Pre-filtered digest (`buildDigest`) | Feed raw transcript | Transcripts are tens of MB — far past any model context (20MB live this session) |
| GitHub write | Code owns sanitized artifact; agent owns transport (MCP/`gh`/token) | Require `GITHUB_TOKEN`; agent composes the body | Token absent in many cloud setups; agent-composed body bypasses the egress guard |
| Module home | New `hooks/lib/retro-extract.ts` (template + byte-mirror) | Put in `src/retro/` | The Stop hook (bun, templates) launches extraction and must import it |

## Arch alignment

- **Deny-by-default egress guard** (`src/retro/egress.ts`, RV9JT4) — reused
  unchanged; the invisibility change does not touch sanitize / fail-closed surface
  / code-assembled body.
- **Agent-neutral trigger core** (`retro-trigger.ts`, FTCQGD) — the substance
  gate, once-per-session sentinel, and occurrence ledger carry over; only the
  hook's output action changes.
- **Byte-parity template mirrors** — new `retro-extract.ts` follows the
  `templates/** → .safeword/**` mirror + `schema.ts` registration convention.

## Known deviations

- skip: no deviations planned. This composes with the existing retro architecture
  and changes only the trigger mechanism; the egress/dedup/ledger layers are
  untouched.

## Assessment triggers

- Stop latency from the synchronous extraction becomes user-visible pain → adopt
  `asyncRewake: true` (Claude v2.1.87+) once cloud container-reclaim timing is
  documented.
- A second agent (Codex #551 / Cursor #552) is wired → revisit whether the
  Claude-specific argv/runner should generalize behind an adapter interface.
- `claude -p` cloud auth or `--bare` behavior changes upstream → re-verify the
  no-`--bare` decision against current Claude Code docs.
