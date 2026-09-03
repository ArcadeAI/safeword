# Spec: Let users rank local reviewers and models

<!-- safeword:inspiration-contract:v1 -->

## Intent

Let users decide which local reviewer/model combinations Safeword tries, while reporting honestly what inspection can and cannot prove.

## Intake Brief

- **Requested by:** Alex
- **Cost of inaction:** Users cannot predict or control the complete review fallback chain.
- **Reversibility:** Two-way door; the config is optional and legacy behavior remains available.

## References

- FZTWG0 — introduced OpenCode as the independent fallback.
- [OpenCode CLI](https://dev.opencode.ai/docs/cli/)
- [OpenCode models](https://opencode.ai/v2/docs/models)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [OpenAI models](https://developers.openai.com/api/docs/models)

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected: Safeword CLI.

Observed process boundaries: Claude Code, OpenAI Codex, and OpenCode — skip direct surface tags because Safeword invokes their local CLIs; the behavior does not execute through their interactive agent surfaces.

Unaffected: Cursor — it is not a supported review author/runtime.

## Vocabulary

- **Review route:** one reviewer runtime plus an optional explicit model.
- **Runtime default:** a route with no explicit model; its position is fixed but its effective model is selected by the runtime.

## Product Inspiration

| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| OpenCode model configuration | 2026-09-01 | current v2 docs | Provider-qualified identifiers and per-run selection make model choice inspectable | Keep explicit selections concrete and runtime default intentional | Catalogue membership does not prove credentials or inference | Model is optional and status separates catalogue evidence from proof |

## Jobs To Be Done

### ranked-local-reviews.TBU1 — Predetermine the review fallback chain

**Persona:** Technical Builder (TBU)

> When several reviewer runtimes and models are available locally, I want to rank concrete routes, so I can control cost, capability, and fallback order before a review starts.

#### ranked-local-reviews.TBU1.R1 — Routes execute in declared order without cache-driven reordering

#### ranked-local-reviews.TBU1.R2 — Invalid or unfunded routes fail visibly without changing model intent

#### ranked-local-reviews.TBU1.R3 — Same-author routes are always degraded regardless of position

#### ranked-local-reviews.TBU1.R4 — A runtime-wide failure skips its remaining models without hiding attempted-route evidence

### ranked-local-reviews.NTB1 — Understand what review readiness means

**Persona:** Non-Technical Builder (NTB)

> When Safeword reports local review options, I want inspection distinguished from proof, so I can trust the explanation without understanding provider internals.

#### ranked-local-reviews.NTB1.R1 — Status distinguishes installed compatible catalogued and proven evidence

#### ranked-local-reviews.NTB1.R2 — Existing projects keep today's behavior until they opt in

## Rave Moment

skip: table-stakes

## Outcomes

- One list determines route order.
- Status never calls a catalogued model usable without a successful review.
- Existing configs behave exactly as before until the new list is present.

## Open Questions

None.
