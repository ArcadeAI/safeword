# Spec: Generate compliant replies without correction loops

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Give Claude the exact decision-brief contract before it writes a substantive
reply, then let an already-compliant reply pass the Stop check so the builder
sees one usable answer instead of a draft followed by a format rewrite.

## Intake Brief

- **Requested by:** Alex Salazar through GitHub issue #1753 and four consolidated duplicate reports.
- **Cost of inaction:** Builders keep paying a visible duplicate-response and latency penalty whenever the Stop hook reveals the exact format only after generation; five v0.70.0 occurrences show the existing compact reminder is insufficient.
- **Reversibility:** Two-way door — this changes instruction delivery only, with no data model, public API, or migration.

## References

- [GitHub issue #1753](https://github.com/ArcadeAI/safeword/issues/1753)
- Consolidated occurrences: [#1766](https://github.com/ArcadeAI/safeword/issues/1766), [#1782](https://github.com/ArcadeAI/safeword/issues/1782), [#1783](https://github.com/ArcadeAI/safeword/issues/1783), and [#1789](https://github.com/ArcadeAI/safeword/issues/1789).
- [PR #1540](https://github.com/ArcadeAI/safeword/pull/1540) — introduced the compact per-prompt reminder present in v0.70.0.
- [GitHub issue #1547](https://github.com/ArcadeAI/safeword/issues/1547) — owns pre-response reply-format parity for Cursor and Codex.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) — `UserPromptSubmit` context is injected alongside the submitted prompt; `SessionStart` context precedes the first prompt.
- [Claude Code memory guidance](https://code.claude.com/docs/en/memory) — persistent instructions should be specific and concise and survive compaction when reloaded.
- [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) — relevant information is less reliable when buried in long context.

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud — skip: this verification environment cannot launch an Anthropic-managed cloud session; local configured-hook proof does not count as managed-runtime evidence.
- Safeword CLI

Unaffected:

- Cursor — proactive reply-format parity is tracked by #1547; every #1753 occurrence is Claude-only.
- Cursor Cloud Agents — current compaction/context-delivery semantics are not proven for this ticket and remain with #1547.
- OpenAI Codex — its Stop adapter does not enforce the CONFIDENT/BLOCKED reply contract reported by #1753.
- OpenAI Codex Cloud — it has no equivalent Stop-format correction loop in scope.

## Vocabulary

- **Decision brief:** The canonical substantive-reply shape with exactly one terminal verdict. CONFIDENT requires Decided, Open, and Next paragraphs, with Rejected optional. BLOCKED requires Tried and Need paragraphs; Need is its terminal recovery action, so BLOCKED does not require a separate Next paragraph.
- **Proactive contract:** The exact decision-brief structure delivered before response generation.

## Jobs To Be Done

### generate-compliant-replies-without-rewrites.NTB1 — Receive one usable completion

**Persona:** Non-Technical Builder (NTB)

> When an agent finishes substantive work, I want its first visible completion
> to use the required decision brief, so I can act without reading a rejected
> draft or waiting through a correction loop.

#### generate-compliant-replies-without-rewrites.NTB1.R1 — A compliant first completion finishes without a format-correction turn

#### generate-compliant-replies-without-rewrites.NTB1.R2 — A non-compliant completion receives one actionable correction rather than an unbounded rewrite loop

### generate-compliant-replies-without-rewrites.TBU1 — Avoid corrective token and latency cost

**Persona:** Technical Builder (TBU)

> When an agent reports engineering work, I want the exact output contract
> available during generation, so the Stop hook remains a rare safety net rather
> than a routine second pass.

#### generate-compliant-replies-without-rewrites.TBU1.R1 — The exact phase-neutral contract is available before the first response and restored after compaction

#### generate-compliant-replies-without-rewrites.TBU1.R2 — Quiet TDD turns retain the lead-only cue instead of the full decision-brief demand

#### generate-compliant-replies-without-rewrites.TBU1.R3 — Format compliance never bypasses dependency, test, architecture, or done gates

### generate-compliant-replies-without-rewrites.SWM1 — Keep proactive and enforced formats aligned

**Persona:** Safeword Maintainer (SWM)

> When the decision-brief contract evolves, I want proactive generation context
> and Claude Stop enforcement to share one phase-neutral definition, so the
> generation cue and the enforced format cannot drift apart.

#### generate-compliant-replies-without-rewrites.SWM1.R1 — One phase-neutral definition supplies both proactive context and terminal-format validation

#### generate-compliant-replies-without-rewrites.SWM1.R2 — CONFIDENT and BLOCKED compliance is deterministic and matches the canonical paragraph grammar

## Rave Moment

skip: table-stakes — avoiding a visible format-rewrite loop restores expected
behavior but is not a persona-facing moment worth manufacturing as delight.

## Outcomes

- The exact phase-neutral decision-brief structure is in Claude's model context after startup, resume, clear, compact, and fork boundaries.
- The same canonical source supplies proactive context and Claude Stop enforcement without injecting default implement-phase evidence at startup.
- The compact per-prompt reminder remains short and the Stop hook remains the final enforcement layer.
- An already-compliant reply passes the format check without a correction turn.
- A non-compliant reply receives exactly one Stop correction, while hard quality and done gates remain unchanged.
- A live Claude walkthrough records whether the builder saw one completion or a correction turn; if the runtime is unavailable, verification records that limitation instead of treating hook output as user-visible proof.

## Open Questions

None.
