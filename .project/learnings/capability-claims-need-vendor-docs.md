# Capability Claims Need Vendor Docs (Our Code Is Not Authority on Their Capability)

Covers: claim provenance, external-system capabilities, stale-snapshot trust, load-bearing-premise decay, capability negatives.

**Finding:** In a long cross-agent design session, the same class of error fired **twice**: an external system's capability ("Cursor/Codex hooks can only allow/deny, no advisory context injection") was asserted as fact, scoped the whole design, and was wrong — because it was sourced from **safeword's own adapter code and code comments**, not from the vendors' current hook docs. Both times the user caught it ("Cursor has a stop hook — read their docs"; "re-verify Codex"). Reading the live docs reversed the conclusion: Cursor (`additional_context` on `postToolUse`/`sessionStart`) and Codex (Hooks GA 2026-05-14, `hookSpecificOutput.additionalContext` "without blocking") both inject advisory context. The "Claude-strong, others best-effort" parity posture that drove ~8 turns of design was built on a false negative.

## The two misses

1. A sub-agent reviewing our hooks reported "additionalContext is Claude-only" — a true statement about **our adapters** (`cursor/pre-tool-quality.ts` is deny-only; `codex/pre-tool-quality.ts` is a self-labeled "spike") that got promoted to a false statement about **the platforms**.
2. The claim then rode forward as settled background. `/quality-review` ran twice and did not catch it — its provenance gate checks the *new* claims each proposal surfaces, not the *inherited premise* already baked into the context.

## Key insight

Internal artifacts (adapter code, code comments, prior research) are evidence of **what we implemented**, never of **what an external system can do** — and they are **stale point-in-time snapshots** (the Cursor adapter predated `additional_context`; the Codex "spike" predated Hooks GA). The Iron Law "training data is stale; verify" was applied rigorously to external facts with no internal source (skill names, install commands, dir layouts) and **suspended exactly where an internal source gave false comfort.**

Three compounding traps:

- **Negatives don't invite verification.** "X supports Y" prompts a check; "X can't do Y" feels closed — yet a false negative silently *shrinks the design space* and never surfaces on use.
- **Load-bearing premises decay into facts.** The more decisions rested on the claim, the less it was re-examined (inverted scrutiny).
- **Disconfirming evidence was already in our own code** — `cursor/post-tool-quality.ts` forwards `additional_context` — missed because the codebase was read selectively to confirm the negative.

## Design rule

- **Capability claims about an external system must be sourced to that system's current primary docs.** Our code answers "what do we do," never "what can they do."
- **Tag load-bearing claims by source + freshness:** `vendor-doc@date` | `our-code` | `memory` | `subagent-synthesis`. The tag travels with the claim.
- **Any external-capability *negative* that scopes the design is unverified until vendor-doc-confirmed this session** — including premises inherited from earlier turns. Negatives get the strictest check.
- **Don't grandfather premises.** When a claim becomes load-bearing, re-check its tag; `our-code`/`memory`/stale → verify before building on it.

## The general fix (not another doc — but not a true gate either)

A learning file is the ~20% "cross-file delegation" tier (see `instruction-attention-hierarchy.md`) — "skipped it every time." Fixing a verification gap with a passive doc is the same mistake recursively. But beware the symmetric trap: a *step inside a skill* is only the ~50% "mid-file" tier — **not** a gate. A genuine blocking gate is likely infeasible here (you can't mechanically detect an unsourced premise in free-form reasoning). So the realistic fix is layered, honest about each tier:

1. **Legibility first** — surface the load-bearing premises tagged by source + freshness, so they're challengeable (by the model on re-read and by the user). Costs nothing; doesn't claim enforcement.
2. **Prompt-hook nudge** — the most reliable *available* placement (~95% tier; the channel safeword already uses), a compressed "tag premises; verify external negatives against vendor docs."
3. **Skill-step backup** in `/figure-it-out` + `/quality-review` — detailed but ~50–80%; the "compressed-in-hook + detailed-in-skill" pattern from `instruction-attention-hierarchy.md`.

Prompting + legibility, not "physics." The tier percentages above are **directional** (internal n=2 tickets), not rigorous.

## Applied in

- Issues #482 (parity posture corrected mid-design), #495 (Codex adapter upgrade — the real stale internal), #479.
- Source-tagging + premise-audit proposed for `/quality-review` and `/figure-it-out`.

**Source:** This session (June 2026), cross-agent Go-skills design. Verified against `code.claude.com/docs/en/skills`, `cursor.com/docs/agent/hooks`, `developers.openai.com/codex/hooks` + `/changelog`.
