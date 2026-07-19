# Spec: Plain-first gate blocks for non-coders

## Intent

Make every safeword hard-block message understandable on its own, in plain
words, without knowing safeword's vocabulary or running any command. A block
leads with what happened and the one thing to do next; internal file, phase,
and verdict names come after (or get glossed), never first and never alone.

## Intake Brief

- **Requested by:** Alex — to make safeword exceptional at how it talks to people.
- **Cost of inaction:** the block is the moment safeword is most useful and most
  hostile. Today a non-coder hits a wall of internal terms (`intake phase`,
  `test-definitions.md`, `frontmatter`) plus a hint to run `/explain` — a command
  they have to already know exists. It's the surface most likely to make someone
  abandon the tool, firing exactly when they're already stuck.
- **Reversibility:** two-way door. This changes the _text_ users see at block
  time, not any gate's trigger or logic. What gets enforced is untouched — only
  how it's said. Trialable one gate at a time; easy to roll back.

## Approach (decided at intake)

**Plain-first for everyone, not a persona branch.** There is no runtime signal
telling safeword the user is a non-coder — the existing persona-aware plainness
(ticket `QQJK5S`) is instruction-only (`quality.ts:29`). Rather than add a
config flag, lead every block with the plain sentence and put the technical
detail after it (progressive disclosure). A fluent reader skips the plain lead
at no cost — the same bargain the "gloss jargon on first use" rule already
makes. NTB is the motivating persona; the fix serves TBU too.

## References

- Block delivery: `.safeword/hooks/pre-tool-quality.ts` `deny()` (systemMessage
  routes around Claude Code issue #17356); done gate `.safeword/hooks/stop-quality.ts`.
- Block copy today: LOC/phase/spec/JTBD gates in `pre-tool-quality.ts`; plan
  gate `.safeword/hooks/lib/plan-gate.ts`; done gate `getDoneHardBlockMessage()`
  in `stop-quality.ts`; shared `EXPLAIN_HINT` `.safeword/hooks/lib/quality-state.ts:24`.
- Complementary prior work (reactive path — keep, don't redo): `/explain`
  (`ZCYD5P`, `NTT094`, `19E2XQ`, `5XOUDJ`); de-jargon (`QQJK5S`, `B6J2TY`, `JZQ85C`).
- Follow-on that generalizes this: `interaction-message-contract` (`JVKMSM`).
- Talking-to-the-user contract: `.safeword/SAFEWORD.md` "Talking to the user".

## Personas

- Non-Technical Builder (NTB) — primary; can't read the diff, most to lose from
  an opaque block.
- Technical Builder (TBU) — secondary; benefits from less friction.

## Surfaces

Affected:

- Claude Code — hard blocks delivered via hook `deny()` / stop hook.
- Cursor — block variants under the Cursor hook adapter.
- OpenAI Codex — block variants rewritten by the Codex adapter (`$explain`).

Unaffected:

- Safeword CLI — `safeword check`/`ticket` output isn't a gate block; out of scope here.

## Vocabulary

- **Hard block:** a gate that denies the tool call outright (LOC, phase, plan,
  done, spec/JTBD/criteria, bash-ledger, process-kill), vs. the bypassable soft block.
- **Plain lead:** the first sentence of a block — what happened and why, in
  everyday words, before any file/phase/artifact name.
- **Next action:** exactly one concrete step named in the block that clears it.
- **Progressive disclosure:** plain lead first, technical detail after, so the
  block reads top-to-bottom for a non-coder and a coder alike.

## Jobs To Be Done

### plain-first-gate-blocks.NTB1 — Understand a block and know what to do, without jargon or a command

**Persona:** Non-Technical Builder (NTB)

> When I hit a gate block, I want the plain reason and the single next step
> right in front of me, so I can keep moving without knowing safeword's
> vocabulary or running any command.

#### plain-first-gate-blocks.NTB1.R1 — Every hard block leads with a plain sentence

Each hard-block message opens with one everyday-language sentence stating what
happened and why, before any file name, phase name, or verdict label.

#### plain-first-gate-blocks.NTB1.R2 — Every hard block names exactly one next action

Each hard-block message states one concrete step that clears the block, phrased
as an action the reader can take — not a description of the rule that fired.

#### plain-first-gate-blocks.NTB1.R3 — No bare internal term stands alone

Internal vocabulary (phase names, artifact filenames, `frontmatter`, verdict
labels) is replaced with plain words or glossed in-line on first use; no bare
internal token carries meaning the plain lead didn't already give.

#### plain-first-gate-blocks.NTB1.R4 — The block is self-sufficient; `/explain` is optional

The reader can understand the block and take the next step from the block text
alone. `/explain` is offered as an optional way to go deeper, not as the path to
understanding what happened or what to do.

## Rave Moment

### plain-first-gate-blocks — "It told me exactly what to do"

- **Moment:** a non-coder's agent gets stopped mid-task; instead of a wall of
  code-speak, the first line says what happened and the one thing to do next —
  they act on it without asking anyone or learning a term.
- **Beats:** the dread of an opaque error that means "you're stuck and you don't
  even know why" — the exact moment people quit an agent tool.
- **They'd say:** "It stopped, but it just told me what to do — so I did it."

## Outcomes

- A non-coder reads any gate block and knows, from the block alone, what
  happened and the one thing to do next.
- `/explain` at block time becomes a deepening, not a rescue.
- Enforcement is unchanged — same gates, same triggers, same conditions.
- Templates stay in sync and the Cursor/Codex block variants hold parity.

## Open Questions

- defer: whether to later add an explicit `audience` config signal for richer
  persona branching — belongs to the follow-on contract-and-judge ticket
  (`JVKMSM`), not here.
