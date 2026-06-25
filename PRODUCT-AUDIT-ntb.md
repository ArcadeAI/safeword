# Safeword Product Audit — Non-Technical Builder (NTB) Persona

**Date:** 2026-06-21
**Branch:** `claude/safeword-ntb-audit-jlpyyx`
**Persona under audit:** Non-Technical Builder (`.project/personas.md:16`) — _"ships
software by directing an AI coding agent but doesn't read or write the code… leans
entirely on safeword's guardrails… When a gate fires, needs a plain-language
explanation and a concrete next action — internal jargon ('RED phase', 'type
narrowing') is a dead end."_ The persona file also calls the NTB **"likely the
larger audience"** and the place where **"safeword's value is highest."**

**Scope:** Every surface that speaks _directly to the human_ — CLI terminal output,
session-start hooks, gate-block reasons, per-prompt reminders, the stop verdict, and
the framing rules that govern how the agent translates all of the above. Application
code the NTB can't read is out of scope by definition (they judge "does it work and
is it safe," not code quality).

**Method:** An NTB only stays oriented if jargon is mediated before it reaches them.
There are exactly two mediation layers. This audit grades where raw jargon bypasses
**both**, weighted by how early and how often an NTB hits it.

> **Deliverable:** findings only — no code changed. Severity reflects NTB impact
> (likelihood of a confused dead-end), not effort.

---

## The NTB safety model — and where it leaks

Two mechanisms stand between the NTB and a jargon dead-end:

- **(A) Agent translation.** SAFEWORD.md "Talking to the user" (`.safeword/SAFEWORD.md:184-213`)
  tells the agent to speak plainly and strip safeword's own vocabulary. The stop
  verdict prompt (`hooks/lib/quality.ts`) reinforces this every turn.
- **(B) The `/explain` escape hatch.** Every hard block appends
  `EXPLAIN_HINT = "Run /explain for a plain-English version of this block."`
  (`hooks/lib/quality-state.ts:21`), and the `/explain` skill translates any
  artifact, gate, or verdict into plain English.

Both mechanisms are **well-built where they apply** (see "What's right" below). The
exposure is the surfaces where **neither** applies — chiefly the terminal CLI and
first-run runtime checks, which the NTB reads raw with no agent and no `/explain` in
reach — plus one framing rule that quietly tells mechanism (A) to stand down for
exactly this persona.

---

## Findings

### HIGH

#### H1 — The "Talking to the user" contract is calibrated to the _Technical_ Builder

`.safeword/SAFEWORD.md:201` (shipped verbatim in `templates/SAFEWORD.md`):

> **Speak plainly.** … Don't make the user learn safeword's internal vocabulary
> (Propose-and-Converge, sizing, gates, phases) … **Assume the user knows their
> stack — don't explain TypeScript, async, or `git rebase` to a developer who's
> using them.**

The first half is exactly right for the NTB. The last sentence is the single
deepest NTB leak in the product: it licenses the agent to leave **stack-level**
jargon untranslated, and the NTB is explicitly _not_ "a developer who's using them"
and explicitly _cannot_ read the diff. The plainness rule covers safeword's _own_
words but carves out the user's stack — which is the half the NTB most needs
translated. This is mechanism (A) being told to stand down for the larger,
highest-value audience.

Everything downstream (every gate block the agent relays, every verdict) inherits
this default. Fixing the blocks one by one won't help while the governing contract
assumes stack fluency.

**Direction (for decision):** make the plainness contract persona-aware — read the
configured personas file and, when the active audience is the NTB, drop the
"assume they know their stack" carve-out so stack terms get a one-clause gloss too.
At minimum, soften the carve-out to "assume they know their _product_, not
necessarily the code."

#### H2 — First run can hard-wall the NTB in pure runtime jargon, before either mechanism engages

The NTB's _very first_ interaction can be a stderr wall they have no model for:

- `hooks/session-bun-check.sh:14-20` exits non-zero with: _"SAFEWORD: bun is
  required for quality hooks but was not found in PATH. All quality gates,
  auto-linting, and review hooks are inactive without it. Install:
  `curl -fsSL https://bun.sh/install | bash`. Then restart your terminal…"_
- `hooks/pre-tool-dependency-readiness.ts` denies with _"dependencies are not
  installed in this worktree. Run `bun ci` from the project root, then retry."_
  (This very audit session opened with that exact line.)

"PATH", "worktree", "bun ci", and a piped `curl | bash` are four unknowns in the
first message. These fire on **stdout/stderr or as a permission-deny _before_ the
agent has reliably translated anything**, and `/explain` is unreachable when the
runtime that powers `/explain` is the thing that's missing. This is the most likely
single point to lose an NTB entirely — and it lands at the moment of highest
abandonment risk.

**Direction:** give the runtime/dependency failures a one-line plain-English lead
("Safeword needs a small tool called **bun** installed once to run its safety
checks — here's the one command…") and frame the consequence as safety, not
infrastructure. Consider a setup-time preflight so the NTB hits this in `setup`
(where prose can carry it) rather than mid-session.

#### H3 — The CLI terminal surface is unmediated and demands jargon-only decisions

`setup`, `upgrade`, and `check` run in a terminal the NTB reads raw — no agent
between them and the output, no `/explain`. The content assumes a developer:

| Surface                          | Verbatim                                                                                   | Why it dead-ends an NTB                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `setup.ts` (eslint peer warning) | "eslint@X (major Y) … ESLint APIs / peerDependencies"                                      | Tool names + packaging jargon with no plain framing                                                                  |
| `setup.ts:381-382`               | "Architecture detected… Generated dependency-cruiser config for /audit command"            | "dependency-cruiser" is an opaque tool name                                                                          |
| `setup.ts:310-322` (Next steps)  | "Run `safeword check` to verify setup" → "Commit the new files to git"                     | Assumes git fluency; gives no orientation to _what safeword will now do_ or how to recover when the agent is blocked |
| `upgrade.ts:278-280`             | **"Move project namespace from `.safeword-project/` to `.project/` (recommended)? [y/N]"** | A blocking y/N decision expressed entirely in directory/namespace jargon — the NTB has zero basis to answer          |
| `reset.ts:30,53-57`              | "Uninstalling devDependencies…", "Preserved: eslint.config.mjs, .prettierrc…"              | Pure tool inventory                                                                                                  |

The `upgrade` y/N prompt (H3's sharpest point) is the worst case: it _halts_ on a
choice the NTB cannot make. Most of the rest is informational and could be
gloss-led without losing the developer.

**Direction:** lead each interactive/decision line with a plain sentence and a safe
default; treat the post-`setup` "Next steps" as the NTB's onboarding moment (see
M2). Defaults that don't need the NTB's judgment (the namespace move) should pick the
recommended path automatically unless `--interactive`.

### MEDIUM

#### M1 — `/explain`, the NTB's lifeline, is effectively undiscoverable

The mechanism is built well (every `hardBlockDone` and every pre-tool `deny`
appends the hint — confirmed across `pre-tool-quality.ts:109` and all
`stop-quality.ts` `hardBlockDone` calls). The _discovery path_ is broken three ways:

1. **Not in the README.** The command list (`README.md:250-258`) names `/audit`,
   `/bdd`, `/debug`, `/lint`, `/quality-review`, `/refactor`, `/testing`,
   `/verify` — but **not `/explain`** (verified absent). The NTB's primary document
   never tells them their one lifeline exists.
2. **The agent can't surface it for them.** `explain/SKILL.md` is
   `disable-model-invocation: true`, and nothing in SAFEWORD.md tells the agent to
   _proactively offer_ `/explain` when it detects the user is lost. So the NTB only
   benefits if they personally read the hint and type it.
3. **The hint can be swallowed.** It rides inside `permissionDecisionReason`, which
   the agent typically narrates _over_ as it reacts to the block — so the NTB may
   never see the "Run /explain" line at all.

This is the cheapest high-leverage fix in the report: add `/explain` to the README
command list with NTB-first framing, and add a SAFEWORD.md rule — _"when a gate
fires and the user seems unsure, offer `/explain` in plain words."_

#### M2 — No NTB onboarding / "what to expect" front door

The README is organized for the Technical Builder and Maintainer: heavy
"Development", "CLI Parity", and "Publishing" sections; the "How It Works" mermaid
diagram is labeled in safeword's own phase vocabulary. Nothing addresses the NTB
directly — no "if you can't read the code, here's how to drive this: the agent will
sometimes get stopped; that's safeword protecting you from shipping something
broken; type `/explain` if a message doesn't make sense." Given personas.md names
the NTB as the largest, highest-value audience, the absence of a front door for
them is a product-level gap, not a doc nit.

**Direction:** a short "Driving safeword without reading code" section (or a
post-`setup` printed orientation) that names the three things an NTB sees — blocks,
verdicts, and `/explain` — in plain language.

#### M3 — Per-prompt reminders and the stop verdict read as jargon in the transcript

`prompt-questions.ts` injects lines like _"Phase: scenario-gate. AODI validation +
adversarial pass…"_ every prompt; the stop verdict uses `CONFIDENT` / `BLOCKED`,
`RED/GREEN/REFACTOR`, `AODI`. **Important nuance:** these are `additionalContext`
and stop-prompt _instructions to the agent_ — the verdict prompt explicitly orders
"plain English; no jargon the reader hasn't seen this turn" and a `**Next:**` line
(`quality.ts:30-52`). So they are mechanism (A) _working_, not direct dead-ends.

The residual NTB risk: (a) an NTB who reads the raw transcript still sees the
untranslated reminders, and (b) the verdict's own scaffolding labels
(`**CONFIDENT**` / `**BLOCKED**`) surface verbatim in the agent's reply — invented
vocabulary the NTB meets with no definition. Lower severity because the design
intent is sound; the fix is to confirm the agent actually strips it and to gloss
`CONFIDENT`/`BLOCKED` on first use.

### LOW

- `post-tool-bypass-warn.ts` and `pre-tool-config-guard.ts` surface
  `eslint-disable` / `@ts-ignore` / "tsconfig" verbatim. These fire on agent
  behavior the NTB didn't author and rarely needs to act on — low exposure.
- `session-lint-check.ts` start-of-session warnings ("ESLint config not found…",
  "bun add -D prettier") are informational stdout; noise, not a dead-end.
- `session-compact-context.ts:79-86` restores context with "Phase: … | Gate: …"
  labels — agent-context, but leaks phase vocabulary if surfaced.

---

## What's right (don't "fix")

- **The stop verdict contract** (`hooks/lib/quality.ts:30-52`) is exemplary NTB
  design: it forces a one-line plain-English claim, a falsifiable
  `CONFIDENT`/`BLOCKED`, and ends with `**Next:**` — "the reader is choosing
  whether to continue, redirect, or intervene with this block as their only
  context." This is the model the rest of the product should match.
- **`/explain` itself** (`skills/explain/SKILL.md`) — _"Write for a teammate with
  zero safeword context,"_ strips the vocabulary, ends with `**Next:**`. The skill
  is right; only its discoverability (M1) is wrong.
- **`EXPLAIN_HINT` on every hard block** — comprehensively applied to all
  `hardBlockDone` paths and the pre-tool `deny`. The right instinct, fully wired.
- **personas.md** already names the NTB need precisely. The product _knows_ the
  target; the gaps above are execution diverging from stated intent.

---

## Prioritized fix list (if/when you act)

1. **Make the plainness contract persona-aware (H1).** Biggest lever — it governs
   every block the agent relays. Drop or soften the "assume they know their stack"
   carve-out for NTB audiences. Everything downstream depends on this call.
2. **Humanize first-run runtime failures (H2).** Plain-English lead + safety framing
   on `session-bun-check.sh` and the dependency-readiness deny; consider a
   setup-time preflight so the NTB meets this in prose, not mid-session stderr.
3. **Surface `/explain` (M1).** Add it to the README command list with NTB framing
   and add a SAFEWORD.md rule to proactively offer it when the user seems lost.
   Cheapest high-leverage win.
4. **De-jargon the interactive CLI (H3).** Auto-pick safe defaults (the `upgrade`
   namespace y/N), and gloss-lead the `setup` warnings and Next-steps.
5. **Add an NTB front door (M2).** A short "driving safeword without reading code"
   orientation, or printed after `setup`.
6. **Confirm verdict/reminder stripping (M3).** Verify the agent strips
   phase/AODI/`CONFIDENT`-`BLOCKED` vocabulary in replies; gloss the labels on first
   use.
