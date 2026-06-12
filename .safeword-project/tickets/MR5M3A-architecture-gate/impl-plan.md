# Impl Plan: Independent evidence-backed architecture gate

**Status:** planned

## Approach

The gate is a new branch inside `stop-quality.ts`'s existing `checkImplPlanArtifact`, which already fires at the implement→verify/done exit — no new hook, no new artifact. Build order, each step green before the next:

1. **Citation helper** (pure, `lib/impl-plan.ts` or a sibling) — `hasCitation(decisionsBody): boolean`, matching a URL or `[n]` marker. Unit tests first (the `decisions_with_citation_passes` / `_without_citation_blocks` pair). Highest-value, lowest-coupling, so it leads.
2. **Config flag** — extend the `reviewGate` config read to also surface `architectureReviewGate` + `crossModelReview`. Reuse `isReviewGateEnabled`'s fail-safe-off parsing (`review-ledger.ts:100`). Unit-covered by the default-off triad (disabled / absent / malformed).
3. **Model-tag primitive (ledger-level, reusable)** — `write-review-stamp.ts` gains `--model <id>` and records it on the stamp; a `modelsMatch(reviewerTag, authorTag)` helper (trimmed, case-insensitive; empty/absent → match → fail closed) lives in `review-ledger.ts`, NOT in the gate. **The `--model` value is supplied by the orchestrator that spawned the reviewer (the model it passed to the `Agent` tool), NOT self-reported by the reviewer** — Claude Code withholds model identity from subagents, so a subagent cannot reliably know its own model (see [sub-agents docs](https://code.claude.com/docs/en/sub-agents), [github/copilot-cli#2383](https://github.com/github/copilot-cli/issues/2383)). The author model comes from the main session's harness-provided identity. Built general so the existing scenario review can adopt the same knob later (ticket 7A0B2K). Reuse `reviewScope(ticket,'impl-plan',hash)` unchanged.
4. **Cross-model is an explicit different-model subagent, not a fork** — a `context: fork` review inherits the parent's model, so it is same-model by construction and can never satisfy cross-model. The user-facing guidance (bdd/TDD design-review step) must instruct spawning an explicit `Agent` with `model: <different>`. Doc step, landed with the gate.
5. **Gate branch** — wire evidence + stamp checks into `checkImplPlanArtifact`, _after_ its existing existence/parse blocks (precedence is load-bearing — see the layering scenarios), _consuming_ the ledger's `modelsMatch` for the cross-model decision rather than re-implementing it. Integration cells per scenario, mirroring #204's `impl-plan-gate.test.ts`.
6. **Author-model capture (SessionStart)** — the gate reads the author model from `SAFEWORD_AUTHOR_MODEL`. Per Claude Code docs, Stop hooks get no `model` field; only SessionStart does, and the forward-pass path is `CLAUDE_ENV_FILE`. `session-author-model.ts` captures the SessionStart `model` stdin field into that env file so the Stop gate can read it. Without this, cross-model fails closed (blocks everything) — surfaced by `/quality-review` against the hooks docs.

Test layers: pure helpers (citation, model-tag compare) → **unit**; the gate decision over a fixture ticket tree → **integration** (the dominant layer, as in #204). No E2E.

## Decisions

| Decision             | Choice                                                                                             | Alternatives considered           | Rejected because                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Where the gate lives | Extend `stop-quality.ts checkImplPlanArtifact`                                                     | New pre-tool gate                 | Splits one artifact's enforcement across two hooks                                                         |
| Review stamp         | Reuse `reviewScope(ticket,'impl-plan',hash)`                                                       | New artifact + scope kind         | Content+ticket binding already exists and is tested (`review-ledger.ts:35`)                                |
| Citation shape       | Minimal/structural — URL or `[n]` marker                                                           | Strict bibliographic parse        | Mirrors #204's non-prose-extraction ruling (YR6C49); brittle parsing has no payoff                         |
| Cross-model compare  | `modelsMatch` helper in `review-ledger.ts` (trimmed, case-insensitive; author-absent fails closed) | Bake compare into the gate branch | A gate-local compare can't be reused by the existing same-model scenario review — the more valuable target |
| Default posture      | Off behind a flag, same as `reviewGate`                                                            | Default-on                        | A self-applying blocking gate must ship inert (see review-ledger.ts:95 rationale)                          |

Evidence behind the shape of this feature (the generation→selection split and single-adversarial-reviewer choice): correlated-error limits of self-review (https://www.preprints.org/manuscript/202601.0892); ADRs as governance-not-documentation (https://reflectrally.com/architecture-decision-logs/); the "popularity trap" of voting ensembles underperforming a single reviewer.

## Arch alignment

Honors the decisions recorded in `ARCHITECTURE.md`:

- **"BDD as a Solo-Agent Adaptation"** — this feature is the direct mitigation for the correlated-single-agent-error problem that ADR names; it adds the independent challenge the ADR calls a partial mitigation.
- **The Tier 1 / Tier 2 review-ledger model** — reuses the existing stamp mechanism and its stated trust boundary (Tier 1 cheap/gameable floor; Tier 2 independence from a fresh reviewer) rather than inventing a parallel one.

## Known deviations

- The model tags are orchestrator-recorded from harness-provided identity, not subagent self-report (which Claude Code makes unreliable). They remain honor-system at the hook boundary — a hand-crafted stamp passes, same trust boundary as every Tier-1 gate; cryptographic attestation is out of scope.

## Assessment triggers

- A genuinely independent reviewer becomes available (different-model API, or a human checkpoint) → revisit whether `crossModelReview` should default on.
- `reviewGate` / this gate moves toward default-on (autonomous-run posture) → re-evaluate the skip-valve ergonomics.
- #204's `impl-plan.ts` section names or `parseImplPlan` shape change → the citation check's anchor on the Decisions section must follow.
