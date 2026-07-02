# Spec: Invisible retro — synchronous headless `claude -p` extraction

## Intent

Make the retro session-retrospective **invisible to the user's running agent**.
Today the Stop hook injects `hookSpecificOutput.additionalContext`, which makes
the user's *own* agent break off its work to mine the transcript and file — a
visible **hijack** of their conversation. Instead, the Stop hook runs extraction
in a **separate, isolated headless agent session** (`claude -p`), feeds the
findings through the existing egress pipeline, and files — with **nothing** in the
user's conversation or transcript. It must work in a **Claude cloud session** (the
dominant dogfood environment) and preserves the existing egress guard unchanged.
Claude/cloud path only; Codex (#551) and Cursor (#552) are separate.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer): "make the whole
  self-reporting experience invisible to the user in their agent — I don't want
  their running conversation hijacked by this feature."
- **Cost of inaction:** the current trigger hijacks the conversation — the agent
  abandons the user's task mid-flow to run retro, surfacing nudge text, extraction
  reasoning, and filing tool-calls. Intrusive enough that users disable the
  feature, killing the friction stream the epic (#344) depends on.
- **Reversibility:** two-way door. Changes the trigger's *mechanism* (run headless
  vs. emit `additionalContext`); the egress guard, schema, dedup, ledger, and
  filing pipeline are untouched. Revert = restore the `additionalContext` return.

## References

- Design + cloud constraints + live-fire proof: GitHub **#550** (and filed
  example **#553** from the live fire).
- Parent epic **#344** (self-observation); parent ticket **RV9JT4** (retro pipeline).
- Supersedes the conversation-injection trigger FTCQGD (Claude `additionalContext`).
- Reuses unchanged: `src/retro/` egress pipeline (`prepareEncounters`,
  `sanitizeTextDeep`, `resolveSurface`, `buildDraft`) and `retro-trigger.ts` core
  (substance gate, once-per-session sentinel, occurrence ledger).
- Sibling adapters: Codex **#551**, Cursor **#552**.

## Personas

- **Technical Builder (TB)** — runs safeword on a real project in their agent.
  Wants safeword's friction reported upstream *for* them, but **never at the cost
  of their in-flight conversation** — no tangent, no stolen turn, no clutter.
- **Non-Technical Builder (NTB)** — drives an agent, can't read the diff. Two
  needs compound: the no-leak guarantee (egress guard, unchanged) **and**
  invisibility — an agent visibly going off to "file safeword bugs" mid-task is
  confusing and erodes trust they can't audit.
- **Safeword Maintainer (SM)** — receives the reports. Wants the friction stream
  to keep flowing from real sessions **including cloud**, out-of-band, using
  whatever GitHub access the environment already has (no extra token to provision).

## Vocabulary

- **Invisible / out-of-band** — runs in a separate process/session; zero entries
  in the user's conversation or transcript (no `additionalContext`, no visible
  tool calls, no stolen turn).
- **Headless extraction** — `claude -p` (print mode) launched by the hook: a fresh
  isolated session that reads the transcript digest and emits findings JSON.
- **Transcript digest** — a pre-filtered, size-capped reduction of the (multi-MB)
  raw transcript — user/assistant text, tool-use names, short/error-ish tool
  results — small enough to feed the extractor.
- **Recursion sentinel** — `SAFEWORD_RETRO_CHILD=1`, set on the headless child;
  every safeword hook early-returns when it sees it, so the child can't re-trigger
  retro (needed because the auth-working invocation does *not* use `--bare`).
- **Agent-owned transport** — the GitHub write goes through whatever access the
  environment/agent has (MCP / `gh` / token); code owns the sanitized artifact,
  the agent owns the wire. No hard `GITHUB_TOKEN` requirement.

## Jobs To Be Done

### invisible-retro-claude.TB1 — Run retro without ever touching my conversation

**Persona:** Technical Builder (TB)

> When a session ends, I want any safeword friction reported automatically without
> my agent breaking off its work — no nudge text, no tangent, nothing in my chat.

#### invisible-retro-claude.TB1.AC1 — The Stop hook emits no conversation context

At Stop, the retro hook produces **no** `additionalContext` and no other
conversation-visible output; extraction + filing run in a separate process.

#### invisible-retro-claude.TB1.AC2 — Extraction runs in an isolated session

The hook invokes `claude -p` as a fresh session that does not share or append to
the user's transcript; its reasoning and tool calls never enter the user's chat.

### invisible-retro-claude.TB2 — It works in a Claude cloud session

**Persona:** Technical Builder (TB)

> Most of my real sessions are cloud sessions, so the invisible retro has to work
> there, not just on a local install.

#### invisible-retro-claude.TB2.AC1 — Headless invocation authenticates in cloud (no `--bare`)

The Claude headless invocation omits `--bare` (which breaks the cloud
managed-proxy auth) so it authenticates via the container's managed provider.

#### invisible-retro-claude.TB2.AC2 — Synchronous, completes before container reclaim

Extraction runs synchronously within the Stop hook's lifetime — not a detached
background process whose survival past session end is unguaranteed — so the work
finishes before a cloud container is reclaimed.

#### invisible-retro-claude.TB2.AC3 — A multi-MB transcript is digested, not fed raw

The extractor runs over a size-capped digest of the transcript (transcripts can
be tens of MB); the raw JSONL is never fed wholesale to the model.

### invisible-retro-claude.NTB1 — No leak, and nothing confusing surfaces

**Persona:** Non-Technical Builder (NTB)

> I can't read the diff, so I need the no-leak guarantee intact AND I don't want
> my agent visibly doing something I didn't ask for.

#### invisible-retro-claude.NTB1.AC1 — The egress guard is unchanged and still fails closed

Findings still pass the constrained schema → fail-closed `resolveSurface` →
deny-by-default `sanitizeTextDeep` → code-assembled body before anything is filed.
The invisibility change does not weaken or bypass any egress layer.

#### invisible-retro-claude.NTB1.AC2 — The headless child can't re-trigger retro

The headless child runs with `SAFEWORD_RETRO_CHILD=1`; the retro hook early-returns
under that sentinel, so the child never spawns another retro (no recursion).

### invisible-retro-claude.SM1 — The stream keeps flowing, using available GitHub access

**Persona:** Safeword Maintainer (SM)

> I want the friction stream to keep arriving from real (incl. cloud) sessions,
> without making every user provision a GitHub token.

#### invisible-retro-claude.SM1.AC1 — Filing uses the environment's GitHub access

The CLI assembles and sanitizes the artifact; the GitHub write uses the
agent/environment's existing access (MCP / `gh` / token). A missing `GITHUB_TOKEN`
is not a hard failure when another transport is available (the REST transport
still works when a token is present).

#### invisible-retro-claude.SM1.AC2 — Gated to once per substantial session

Extraction fires at most once per substantial session (the existing substance gate

+ once-per-session sentinel carry over), so the out-of-band work is bounded.

## Rave Moment

### invisible-retro-claude — the feature with no felt presence

- **Moment:** the builder finishes a rough safeword session and closes their
  laptop — never noticing a thing — while the friction they hit is already a clean,
  deduplicated, leak-free issue in the maintainer's tracker.
- **Beats:** the current hijack, where the agent visibly abandons your task to go
  "file safeword bugs," cluttering the chat and stealing a turn.
- **They'd say:** "I didn't even know it was doing that — and the bug was already
  filed."

## Outcomes

- A substantial Claude session (local or cloud) produces retro findings filed
  upstream with **zero** entries in the user's conversation/transcript.
- The extraction authenticates and completes in a cloud container, synchronously,
  over a digested transcript — proven live (#550, #553).
- The egress guard's leak-free + fail-closed guarantees are demonstrably unchanged.
- Filing succeeds with no `GITHUB_TOKEN` when the agent has another GitHub path.

## Open Questions

- defer (#552): exact Cursor `stop`/`sessionEnd` payload (`transcript_path`
  availability) — out of scope for the Claude path.
- defer: whether to neutralize *non-safeword* hooks in the headless child, or only
  safeword's own via the sentinel — revisit if the child proves noisy in practice.
