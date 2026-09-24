# Design: Decision-complete terminal handoffs

**Related:** [Spec](./spec.md) | [Scenarios](../../../features/make-agent-handoffs-decision-complete.feature) | [Test definitions](./test-definitions.md)

## Architecture

Safeword will define `terminal-handoff/v1` once in the canonical hook library.
The contract separates two terminal forms:

- a decision form for `Next` and `Need`, with five explicit inline roles:
  `Choice`, `Recommendation`, `Reason`, `Impact`, and `Reply`;
- an action form for `Next`, with one `Action` and an optional `Reason`.

The surrounding brief declares whether `Next` carries a human decision
(`Open: human: <choice>`) or an agent-owned action (`Open: none`). `BLOCKED`
always routes `Need` through the decision form. Legacy, absent, or malformed
`Open` values conservatively select the decision form and retain a route
migration diagnostic, so pre-contract failures cannot disappear as inapplicable.
The terminal paragraph therefore remains sufficient to act, while the route is
deterministic and does not ask a runtime classifier to infer ownership from
arbitrary prose.

A shared, dependency-free evaluator scans only the terminal top-level paragraph
and returns a typed result: applicability, form, missing or unexpected roles,
and bounded work count. It validates explicit evidence, not whether a stated
recommendation is wise. Necessary technical terms are treated as explained only
when explicitly marked `Term: <term> = <plain meaning>` inline. Concrete actions
carry one imperative `Action` plus a specific `Object`; an optional essential
reason must use one `Reason: Required because ...` clause. This deliberately
avoids an LLM-as-judge dependency at Stop.

An action `Object` must contain a normalized content token outside a closed
placeholder set (`it`, `this`, `that`, `thing`, `the work`, and equivalents).
This is a deterministic concreteness floor, not natural-language understanding.
Decision cardinality requires exactly one `Choice` and `Reply` clause and rejects
repeated clauses, list markers, or explicit enumeration separators; it does not
infer hidden unrelated ideas inside one unmarked sentence.

Applicability is supplied separately as closed evidence: a top-level verdict,
current-turn tool activity in the native transcript, Cursor's current-turn edit
marker, or none. A verdict/work signal makes a briefless reply noncompliant;
ordinary prose with no signal remains outside the contract. Transcript absence
or parse failure never manufactures applicability.

Each host adapter supplies the final assistant reply and its native loop signal
to the evaluator. An incomplete applicable handoff receives one correction in
the host's continuation shape; a compliant reply, short conversation, unreadable
payload, or evaluator failure exits successfully without correction. Existing
hard evidence gates and higher-priority continuation work retain precedence.

## Components

### Versioned terminal-handoff contract

**What:** Own the version, decision/action roles, renderer, validator, bounded
reply evaluator, and correction renderer.

**Where:** `packages/cli/templates/hooks/lib/quality.ts`

**Boundary:** Pure TypeScript with no filesystem, network, model, or repository
dependency. Generated and installed copies are derived from this template.

### Claude Code Stop adapter

**What:** Evaluate `last_assistant_message` after hard gates and before the
optional generic quality-review backstop. Use Claude's `stop_hook_active` field
to suppress correction re-entry.

**Where:** `packages/cli/templates/hooks/stop-quality.ts`

**Boundary:** Emit the existing `decision: "block"` continuation only for the
first incomplete applicable handoff. Payload and evaluator failures remain
fail-open.

### OpenAI Codex Stop adapter

**What:** Evaluate Codex's documented `last_assistant_message` in the packaged
Stop path without changing the stronger ticket/retro ordering. Reuse documented
`stop_hook_active` for the one-correction bound and treat `transcript_path` as
optional applicability evidence only.

**Where:** `packages/cli/templates/hooks/codex/stop.ts`

**Boundary:** Emit Codex continuation JSON (`decision: "block"`, `reason`) and
otherwise `{}`.

### Cursor Stop adapter

**What:** Read the final assistant reply from Cursor's native transcript path,
evaluate it after completion/status checks, and use the registered Stop hook's
`loop_count` together with `loop_limit: 1`.

**Where:** `packages/cli/templates/hooks/cursor/stop.ts` and the generated
`.cursor/hooks.json` registration owned by setup.

**Boundary:** Emit `followup_message` once; transcript, contract, and evaluation
failures return `{}`.

### Corpus and parity gate

**What:** Store long-form observed failures, compliant rewrites, no-decision
cases, and held-out paraphrases with contract-derived expected results. Extend
the release parity command to compare the version, unordered role sets, and
corpus behavior of every delivered copy.

**Where:** `packages/cli/tests/fixtures/terminal-handoff-corpus.ts`, focused hook
tests, BDD step bindings, and `scripts/parity-check.ts`.

**Boundary:** Corpus expectations are authored from the contract and never
snapshotted from the evaluator under test.

## User flow

1. The agent completes a substantive stretch of work.
2. It declares `CONFIDENT` or `BLOCKED` and writes the terminal `Next` or `Need`
   paragraph using the contract's decision or action form.
3. The native Stop adapter evaluates only that final reply.
4. A compliant handoff stops normally. An incomplete one receives one focused
   rewrite instruction naming the missing roles and contract version.
5. The correction attempt may stop even if still incomplete; a later independent
   compliant stop re-arms the host's normal correction lifecycle.

## Key decisions

### Make semantic roles explicit

**What:** Require named inline roles inside the terminal paragraph rather than
searching free prose for vaguely equivalent sentences.

**Why:** The observed defect passed the old label-only scanner. Explicit roles
make completeness deterministic, symmetric for `Next` and `Need`, and readable
without earlier prose.

**Trade-off:** Decision handoffs become slightly more structured. Routine action
handoffs remain a separate one-action form to avoid ceremony.

### Treat routing declarations as evidence, not inferred truth

**What:** Route `Open: human: <choice>` to the decision form and `Open: none` to
the action form; `BLOCKED` always uses the decision form.

**Why:** A bounded local hook cannot reliably infer decision ownership,
essentiality, or recommendation quality from arbitrary natural language.

**Trade-off:** A dishonest or mistaken declaration can still pass. Corpus and
held-out tests prove wording-independent mechanics, not omniscient judgment.

### Correct once at native terminal boundaries

**What:** Use host-provided re-entry state—`stop_hook_active` for Claude/Codex and
Cursor's Stop `loop_count`/`loop_limit`—instead of durable global suppression.

**Why:** Native state bounds the correction to the current cycle and naturally
re-arms later stops without leaking suppression across sessions.

**Trade-off:** A still-incomplete correction is allowed to stop rather than loop.

### Preserve stronger continuation precedence

**What:** Run handoff correction only after hard completion gates and before
lower-priority generic review/retro nudges where the host exposes one
continuation channel.

**Why:** Evidence and safety gates must not be hidden by a presentation repair.

**Trade-off:** The handoff correction may wait until a stronger gate is cleared.

## Error handling

- Malformed or unreadable native input exits zero with no correction.
- A missing, invalid, or throwing evaluator exits zero with no correction and
  remains observable through existing self-report diagnostics where available.
- Missing terminal roles return a stable ordered diagnostic for readability;
  equality and parity assertions compare role sets without depending on order.
- Oversized replies are scanned once with an explicit character-work bound.
- Host re-entry signals suppress only the current correction attempt.
- `terminalHandoffCorrection: false` disables this default-on presentation
  correction without weakening completion or safety gates.

## References

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Cursor hooks reference](https://cursor.com/docs/hooks)
- [OpenAI Codex hooks reference](https://learn.chatgpt.com/docs/hooks)
- [OpenAI latest-model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/)
- `ARCHITECTURE.md` — Continuous Quality Gates and Cross-agent Stop delivery
