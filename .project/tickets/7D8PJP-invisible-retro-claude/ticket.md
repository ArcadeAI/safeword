---
id: 7D8PJP
slug: invisible-retro-claude
type: feature
phase: scenario-gate
status: in_progress
parent: RV9JT4-retro-transcript-mining
github: https://github.com/ArcadeAI/safeword/issues/550
scope: |
  Make the retro self-report INVISIBLE to the user's running agent: the Stop hook
  runs extraction in a separate, isolated headless agent session instead of
  injecting `additionalContext` into the user's conversation. Claude/cloud path
  only (Codex #551 and Cursor #552 are separate tickets).
    1. `safeword retro --auto-extract` (no `--findings`): the CLI runs extraction
       itself by shelling out to a headless host-agent invocation, then runs the
       existing normalize → resolveSurface → sanitizeTextDeep → assemble pipeline.
    2. Claude headless adapter: `claude -p --model haiku --allowed-tools Read
       --output-format json --append-system-prompt <rules>` — NO `--bare` (it
       breaks the cloud managed-proxy auth; proven live). Run from a neutral cwd
       and/or with the recursion sentinel so it does not re-enter project hooks.
    3. Transcript DIGEST step: transcripts are multi-MB (this session: 20 MB /
       7,716 lines). The extractor runs over a pre-filtered digest (user/assistant
       text + tool-use names + short/error-ish tool results, capped), not raw JSONL.
    4. Recursion guard: spawn with `SAFEWORD_RETRO_CHILD=1`; every safeword hook
       early-returns when set (NOT `--bare`, NOT `CLAUDE_CODE_CHILD_SESSION` which
       is already 1 in the normal tool context).
    5. Rewrite `stop-retro.ts`: instead of returning `additionalContext`, run the
       extraction synchronously (best-effort, fail-open, never blocks/pollutes).
       Keep the substance gate, once-per-session sentinel, and occurrence ledger.
    6. GitHub write via the agent's own access (MCP / gh / token) — code owns the
       sanitized artifact, agent owns the transport; drop the hard `GITHUB_TOKEN`
       requirement (see #550 refinement). The token-REST transport stays as one
       option.
out_of_scope: |
  - Codex adapter (#551) and Cursor adapter (#552) — separate tickets.
  - Robust dedup (1FGE1C) — the live fire confirmed it's needed (a finding
    duplicated #344/#345); this ticket files via the existing dedup, 1FGE1C hardens it.
  - `asyncRewake: true` non-blocking optimization — deferred until cloud
    container-reclaim timing is documented; v1 is synchronous-in-hook.
  - The `type:"agent"` hook as a Claude-native alternative — a later spike
    (experimental, Claude-only) once it's out of experimental and can do GitHub writes.
done_when: |
  - At a substantial Claude session's Stop, retro extraction + filing happens with
    ZERO entries in the user's conversation/transcript (no additionalContext, no
    visible tool calls) — asserted by a test on the new stop-retro output.
  - `safeword retro --auto-extract` runs the headless extractor, builds a digest,
    and feeds findings into the existing egress pipeline; covered by tests with the
    headless invocation injected (mock the subprocess boundary).
  - The headless Claude invocation uses NO `--bare` and carries `SAFEWORD_RETRO_CHILD=1`;
    a test asserts a safeword hook early-returns under that sentinel (recursion guard).
  - The digest builder caps a multi-MB transcript to an ingestible size while
    retaining friction signal; unit-tested on a large synthetic transcript.
  - Filing works via the agent transport with no `GITHUB_TOKEN` present (token path
    still works when present).
  - Scenarios green; /verify passes. (Validated live in a cloud session — see #550.)
created: 2026-06-29T03:52:54.107Z
last_modified: 2026-06-29T03:52:54.107Z
---

# Invisible retro: synchronous headless claude -p extraction (no conversation hijack)

**Goal:** Run the retro session-retrospective entirely out-of-band — in a separate
headless agent session launched by the Stop hook — so the user's running
conversation is never hijacked, while still working in a Claude cloud session.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.
**GitHub:** [#550](https://github.com/ArcadeAI/safeword/issues/550) (design + live-fire proof).

## Live-fire proof (this session, cloud container)

The mechanism was validated end-to-end before this ticket was opened (full detail
on #550):

- `claude -p` (no `--bare`) authenticated in the cloud container, used the Read
  tool, returned schema-valid findings — **~41 s, $0.10 (haiku)**.
- `prepareEncounters` sanitized (a committer email → `[email]`), fail-closed
  surface resolution passed, body assembled.
- Filed the one genuinely-new finding via the **agent transport** (GitHub MCP, no
  `GITHUB_TOKEN` used by the CLI): #553. The second finding was a duplicate of
  #344/#345 and was correctly withheld by manual dedup.
- `claude -p --bare` → **Authentication error** (the trap that shaped the design).

## Work Log

- 2026-06-29T03:52:54.107Z Started: Created ticket 7D8PJP
- 2026-06-29T03:5Z Intake from /figure-it-out (#550). Parent RV9JT4. Claude/cloud
  path; Codex #551 + Cursor #552 split out. Design + cloud constraints + live-fire
  proof captured on #550. Next: spec.md (personas/JTBD), then scenario gate.
