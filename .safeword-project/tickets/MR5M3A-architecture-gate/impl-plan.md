# Impl Plan: Independent evidence-backed architecture gate

**Status:** planned

## Approach

The gate is a new branch inside `stop-quality.ts`'s existing `checkImplPlanArtifact`, which already fires at the implement→verify/done exit — no new hook, no new artifact. Build order, each step green before the next:

1. **Citation helper** (pure, `lib/impl-plan.ts` or a sibling) — `hasCitation(decisionsBody): boolean`, matching a URL or `[n]` marker. Unit tests first (the `decisions_with_citation_passes` / `_without_citation_blocks` pair). Highest-value, lowest-coupling, so it leads.
2. **Config flag** — extend the `reviewGate` config read to also surface `architectureReviewGate` + `crossModelReview`. Reuse `isReviewGateEnabled`'s fail-safe-off parsing (`review-ledger.ts:100`). Unit-covered by the default-off triad (disabled / absent / malformed).
3. **Stamp model tag** — `write-review-stamp.ts` gains `--model <id>`; the stamp line records it; author-model read from session env. Reuse `reviewScope(ticket,'impl-plan',hash)` unchanged for the content+ticket binding.
4. **Gate branch** — wire evidence + stamp + cross-model checks into `checkImplPlanArtifact`, *after* its existing existence/parse blocks (precedence is load-bearing — see the layering scenarios). Integration cells per scenario, mirroring #204's `impl-plan-gate.test.ts`.

Test layers: pure helpers (citation, model-tag compare) → **unit**; the gate decision over a fixture ticket tree → **integration** (the dominant layer, as in #204). No E2E.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Where the gate lives | Extend `stop-quality.ts checkImplPlanArtifact` | New pre-tool gate | Splits one artifact's enforcement across two hooks |
| Review stamp | Reuse `reviewScope(ticket,'impl-plan',hash)` | New artifact + scope kind | Content+ticket binding already exists and is tested (`review-ledger.ts:35`) |
| Citation shape | Minimal/structural — URL or `[n]` marker | Strict bibliographic parse | Mirrors #204's non-prose-extraction ruling (YR6C49); brittle parsing has no payoff |
| Cross-model compare | Trimmed, case-insensitive tag equality; author-absent fails closed | Exact string; fail-open | Exact string is a trivial-case bypass; fail-open silently no-ops the protection |
| Default posture | Off behind a flag, same as `reviewGate` | Default-on | A self-applying blocking gate must ship inert (see review-ledger.ts:95 rationale) |

Evidence behind the shape of this feature (the generation→selection split and single-adversarial-reviewer choice): correlated-error limits of self-review (https://www.preprints.org/manuscript/202601.0892); ADRs as governance-not-documentation (https://reflectrally.com/architecture-decision-logs/); the "popularity trap" of voting ensembles underperforming a single reviewer.

## Arch alignment

Honors the decisions recorded in `ARCHITECTURE.md`:

- **"BDD as a Solo-Agent Adaptation"** — this feature is the direct mitigation for the correlated-single-agent-error problem that ADR names; it adds the independent challenge the ADR calls a partial mitigation.
- **The Tier 1 / Tier 2 review-ledger model** — reuses the existing stamp mechanism and its stated trust boundary (Tier 1 cheap/gameable floor; Tier 2 independence from a fresh reviewer) rather than inventing a parallel one.

## Known deviations

- `paths.architecture` is unset, so it resolves to the absent default `.safeword-project/architecture.md` rather than the real root `ARCHITECTURE.md`; `safeword check` will therefore emit a structural Arch-alignment advisory for this ticket. Accepted — pointing the config at the root record is a separate change, out of this ticket's scope.
- The reviewing-model tag is self-reported (honor-system), consistent with the existing stamp's trust boundary; cryptographic attestation is explicitly out of scope.

## Assessment triggers

- A genuinely independent reviewer becomes available (different-model API, or a human checkpoint) → revisit whether `crossModelReview` should default on.
- `reviewGate` / this gate moves toward default-on (autonomous-run posture) → re-evaluate the skip-valve ergonomics.
- #204's `impl-plan.ts` section names or `parseImplPlan` shape change → the citation check's anchor on the Decisions section must follow.
