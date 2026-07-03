# Test Definitions: Retro filer subagent gate — reliable, invisible cloud filing

Spec: `spec.md` (JTBD/ACs). Dimensions: `dimensions.md`.

test-definitions.md is the R/G/R ledger.

## Rule: The filing gate decides when to dispatch and what to say

### Scenario: Unfiled drafts produce one dispatch instruction naming the filer agent and spool path (SM1.AC1, TB1.AC1)

- [x] RED — `tests/hooks/retro-filing-gate.test.ts` fails: no gate module exists.
- [x] GREEN — `decideRetroFilingGate` returns text containing `safeword-retro-filer`,
  the session spool path, and the draft count when unfiled drafts exist.
- [x] REFACTOR — dispatch text is a single-action instruction (dispatch + silence
  contract), not an inline filing procedure; shares `batchKey` with the nudge.

### Scenario: A drained or absent spool keeps the gate silent (SM1.AC1)

- [x] RED — test fails against missing module.
- [x] GREEN — empty spool and post-`markDraftsFiled` spool both return undefined.
- [x] REFACTOR — fail-open reads shared with the nudge path.

### Scenario: The gate fires at most twice per unfiled batch, persisted across evaluations (SM1.AC2)

- [x] RED — test fails against missing attempt marker.
- [x] GREEN — evaluations 1 and 2 return the dispatch; evaluation 3 returns
  undefined; the counter survives process boundaries (fresh reads of the marker).
- [x] REFACTOR — marker is atomic-write, batch-keyed, schema-checked.

### Scenario: A batch that gains a draft resets the attempt counter (SM1.AC2)

- [x] RED — test fails: counter not keyed to batch.
- [x] GREEN — after exhausting the cap, spooling one more draft re-arms the gate.
- [x] REFACTOR — same order-independent batch key as the muted nudge.

## Rule: Each harness delivers the dispatch through its sanctioned continuation channel

### Scenario: The Claude Stop hook emits decision:block only when safe and warranted (SM1.AC1)

- [x] RED — no `stop-retro-filing.ts` hook exists; settings carry no entry.
- [x] GREEN — hook emits `{decision:"block", reason:<dispatch>}` for unfiled
  drafts; stays silent (no output) when `stop_hook_active`, when
  `selfReport.file` is off, when session id is missing, or when the gate declines.
- [x] REFACTOR — hook is a thin adapter over `decideRetroFilingGate`, matching
  `prompt-retro-nudge.ts` structure; wired in `SETTINGS_HOOKS.Stop`.

### Scenario: The Codex Stop hook gates filing after its synchronous extraction (SM1.AC1, SM1.AC2)

- [x] RED — `codex/stop.ts` returns silent even with unfiled drafts spooled.
- [x] GREEN — after extraction, unfiled drafts yield `{decision:"block"}` with the
  dispatch; the architecture nudge keeps precedence; `selfReport.file` off stays
  silent.
- [x] REFACTOR — same gate module; no second Codex-only decision logic.

### Scenario: The Cursor Stop hook prefers filing over the retro-available nudge (SM1.AC1)

- [x] RED — `cursor/stop.ts` no-edit branch never emits a filing followup.
- [x] GREEN — unfiled drafts yield `followup_message` with the dispatch before the
  retro-available nudge is considered; quality-review stops are untouched.
- [x] REFACTOR — one followup per stop preserved; gate module shared.

## Rule: The filer agent ships with the install and owns the procedure

### Scenario: Filer agent definitions are installed for all three harnesses (SM1.AC3, TB1.AC2)

- [x] RED — schema has no `.claude/agents/`, `.cursor/agents/`, `.codex/agents/`
  entries.
- [x] GREEN — install maps ship `safeword-retro-filer` markdown (Claude, Cursor)
  and TOML (Codex); dirs registered as shared/owned appropriately.
- [x] REFACTOR — agent prompt carries dedup/verbatim/cap/drain-as-ack/can't-file
  rules; guide and nudge text reference the agent; no duplicate procedure in the
  main-agent path.
