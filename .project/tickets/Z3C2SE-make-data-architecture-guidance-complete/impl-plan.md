# Impl Plan: Complete conditional data architecture guidance

**Status:** implemented
**Planned on:** 2026-09-16

## Approach

The riskiest assumption is that a small, context-free corpus can prove the guide itself changes
planning behavior without letting ambient repository context or a generated artifact validate the
claim. The cheapest direct proof is **A discriminating guide-ablation pair validates independent
proof**: the full-guide record must pass, the named ablation must fail, both prompts and
configurations must match, and the verifier must independently re-derive both guide hashes.

Build five slices, keeping nondeterministic recording outside the normal test run:

1. **Deterministic corpus contract.** Add the nine cases, independent expected and forbidden
   decision/proof-fact sets, stable IDs, recording contract, and seeded failures. Implement pure set
   grading, content hashing, prompt reconstruction, sensitive-value scanning, and named-ablation
   derivation. Start RED with hand-authored in-memory full/ablation records that exercise the positive
   discriminating pair and each invalid-pair row, then add record-binding, focused-diagnostic, and
   safety-scan tables. These are test fixtures, not accepted corpus evidence; slice 3 replaces them
   with current recorder-produced records bound to the final guide. Primary proof: unit tests in
   `packages/cli/tests/data-architecture-eval.test.ts`.
2. **Cold-start recording entry point.** Add `packages/cli/scripts/data-architecture-eval.ts` with
   `record` and `verify` modes and package scripts documenting the exact commands. `record` launches
   a structured-argv model adapter in an empty temporary working directory, sends only guide + one
   case + neutral JSON response schema, binds exact prompt/model/decoding/content hashes, and stages
   individually atomic file replacements only after re-grading. Primary proof: an integration wiring test using real prompt
   composition, filesystem, corpus walk, and grader while replacing only the subprocess model
   boundary.
3. **Canonical guidance and current records.** Rewrite
   `packages/cli/templates/guides/data-architecture-guide.md` around the accepted universal boundary,
   six triggered modules, artifact ownership, and sufficient falsifiable proof. Add direct contract
   assertions for the durable-vs-reversible boundary and required trigger/decision/proof facts, then
   use the now-green recorder to refresh every full-guide and ablation record against that exact guide
   hash. Primary proof: targeted guide assertions plus the deterministic corpus grader over the newly
   content-bound records.
4. **Supported delivery.** Reconcile the canonical template into `.safeword`, run the existing
   Claude generator, and add one independent literal inventory test covering canonical, installed,
   and Claude paths; byte identity; allowed literal Claude path substitution; planning-link
   ownership; no Codex copy; and OpenCode catalogue absence. The existing planning routes remain
   unchanged: the current planning template already invokes the data guide and host generators adapt
   that reference. The literal inventory requires exactly one emitted planning reference for Claude,
   Codex, and Cursor and no OpenCode delivery-owned reference, mapping each referenced host to its one permitted
   target: Claude →
   `plugin/resources/guides/data-architecture-guide.md`, Codex and Cursor →
   `.safeword/guides/data-architecture-guide.md`, and OpenCode → no copy and no delivery-specific path. Seed
   missing copy, Codex extra copy, Claude body drift, illegal path substitution, absent reference,
   missing target, cross-surface target, and OpenCode-reference fixtures; the last two must fail even
   when their target exists. Primary proof:
   `packages/cli/tests/data-architecture-delivery.test.ts` through real schema, reconciliation, and
   catalogue generation collaborators.
5. **Executable behavior and documentation.** Mark the accepted feature for the Vitest-backed BDD
   lane, add its `.bdd-proof.json` manifest mapping every scenario and outline row to normally
   collected tests, update the R/G/R ledger one scenario at a time, and document the record/verify
   commands in a repository-only corpus README. The package's `test:bdd` composition excludes
   `@proof.vitest` from Cucumber and runs `tests/bdd-proof-tags.test.ts` as the executable-provenance
   gate. Run focused eval/delivery tests before lint, typecheck, generated freshness, BDD proof, and
   full configured verification.

Scenario proof map:

| Scenarios | Primary proof | Supporting proof |
| --- | --- | --- |
| Mixed decision routing; durable contract rejected as helper | Recorded-result eval with exact decision/proof sets | Guide-contract unit assertions |
| Representative case outline; invalid-record outline | Deterministic corpus integration over all nine records | Seeded digest, configuration, prompt, missing-record, and failing-response unit cases |
| Artifact ownership positive and duplicate-authority rejection | Recorded-result eval and seeded negative grader | Stable ownership-ID contract assertions |
| Independent inventory; sibling-generated rejection | Exact-set rubric unit tests | Generated-manifest recorded result |
| Discriminating ablation; invalid ablation outline | Re-derived full/ablated guide pair through one grader | Hash, label-preservation, and paired-configuration unit cases |
| Conditional proof positive and rejection outlines | Table-driven deterministic rubric tests | Current relational, encryption, migration, erasure, and temporal records |
| Synthetic/read-only evidence; sensitive-value rejection outline | Recursive corpus safety scan | Seeded prefix, email-shape, and high-entropy fixtures |
| Supported-host delivery; shipped drift outline | Real reconciliation and Claude catalogue integration | Literal inventory, link-resolution, Codex/OpenCode absence, and seeded drift tests |

Affected surfaces:

| Surface | Proof |
| --- | --- |
| Safeword CLI | Real schema reconciliation installs the canonical guide and focused package scripts verify corpus records |
| Claude Code | Generated plugin resource equals the canonical guide except for the independently specified path substitution; generated planning links resolve |
| OpenAI Codex | Installed `.safeword` guide and generated planning route resolve; generated Codex catalogue contains no guide copy |
| Cursor | Installed `.safeword` guide and generated planning route resolve through schema/install integration |
| OpenCode | Explicit unaffected proof: profile catalogue contains neither a data-architecture guide copy nor a delivery-specific planning path; shared workflow prose may name the guide |

The implementation touches four major components and five build slices, below the split trigger of
more than twenty tasks or at least five major components; keep one feature ticket.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents and https://openai.com/index/trustworthy-third-party-evaluations-foundations/ | 2026-09-16 | Anthropic article published 2026-01-09; OpenAI foundation published 2026 | Safeword 1.0.0-rc.5 | Anthropic separates tasks, trials, graders, and transcripts and recommends unambiguous success criteria; OpenAI treats harness details and validity checks as part of the result | Keep cases, trials, grading, and recorded provenance separate; bind the harness inputs needed to judge validity | Sources describe general eval systems, not this repository; no source code is reused and no credentials, private code, or customer data were sent |

**Decision impact:** changed: replaced prose-golden or live-only proof with content-bound recorded
trials plus a deterministic independent grader and a named ablation control.
**Decision informed:** Separate recording from deterministic verification

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Separate recording from deterministic verification | Keep a credential-dependent recorder outside normal tests; make the release gate a pure verifier over current content-bound records | Run a live model in CI; trust stored pass/fail | Live CI is nondeterministic and credential-bound; stored verdicts can be stale or mislabeled |
| Represent guide behavior as exact semantic ID sets | Store cases and independent rubrics as readable JSON with expected, forbidden, and unknown-ID rejection; keep prose only as input | Prose snapshots; model-as-judge | Snapshots reject valid wording and hide semantic omissions; another model adds nondeterminism where exact facts suffice |
| Isolate cold-start recording behind a structured adapter protocol | Launch a caller-supplied model adapter with structured argv in an empty workspace and send only guide, case, and response schema | Reuse the review coordinator runtime; bind directly to one provider SDK; invoke a shell string | The review runtime deliberately adds reviewer capability probes, packet/rubric context, tool permissions, and a review-result schema, violating this eval's guide-plus-case-only and tools-disabled contract; a provider dependency narrows Safeword and requires version churn; shell text adds injection and canonicalization ambiguity. Reuse its accepted structured-argv, bounded-timeout, stdin, and cleanup design rather than its reviewer-specific implementation |
| Preserve canonical delivery ownership | Edit the CLI template, reconcile `.safeword`, and generate Claude through the existing catalogue; verify paths against an independent literal inventory | Hand-edit all copies; compare only generated trees | Hand edits drift; generated outputs cannot independently prove the generator's completeness |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | Exact sets, hashes, prompt reconstruction, seeded negatives, and a re-derived ablation determine pass/fail instead of trusting prose or stored verdicts | `packages/cli/tests/bdd-proof-tags.test.ts` | |
| 3. Add, never replace | Existing schema reconciliation and host-native delivery ownership remain authoritative; no host gains a competing guide copy | `packages/cli/tests/claude-plugin/delivery-schema.test.ts` | |
| 5. Correct and safe; then clear; then simple | One dependency-free TypeScript grader handles records and fixtures; model calls stay behind one process boundary | `packages/cli/tests/schema.test.ts` | |

Architecture decisions honored: `ARCHITECTURE.md` sections “Registry-Driven Agent Integrations with
Native Trust Boundaries,” “Reconciliation Engine,” “Test Structure,” and “Generated Native Claude
Plugin.” No new ADR is warranted: the feature follows those accepted, reversible delivery and test
patterns rather than establishing a project-wide technology, schema, or public API.

## Known deviations

Anthropic's general agent-eval guidance recommends multiple trials when measuring probabilistic
reliability. This ticket intentionally stores one current content-bound result per case and makes no
first-try, pass-rate, or repeated-run claim. Adding statistical reliability would change the accepted
success threshold; revisit it only through a separately scoped product decision.

The cold-start recorder trusts the selected model adapter not to obtain external context on its own.
Safeword provides an empty working directory, a closed stdin request, and a tools-disabled contract,
then records the configured adapter identity and exact prompt. The recorded decoding settings are
contract assertions supplied by the maintainer, not independently observed provider behavior.
Treating a same-user adapter as hostile would require an OS sandbox and is outside this
documentation-evaluation scope.

The corpus safety scan examines independently authored case prose, case IDs, and recording-contract
strings. Prompts are reconstructed from the canonical guide and case, responses must contain exact
rubric IDs, and every stored digest is recomputed by deterministic verification, so response IDs are
not treated as arbitrary sensitive-value inputs.

The accepted evidence remains one current full-guide result per case plus one current paired
ablation record rather than a statistical claim. Re-recording stages both files and replaces each
atomically; verification rejects an interrupted pair when a guide, case/rubric, prompt, or contract
binding changed, but does not provide a transaction across both files. The files attest prompt,
configuration, response, and content binding, but do not independently attest the remote model's
identity or observed provider settings. This ticket does not claim or retain first-attempt,
invocation-history, or pass-rate data.

Implementation reconciliation: all four recorded decisions remain current. The shipped recorder
uses structured argv, an empty temporary working directory, individually atomic replacement, and
deterministic re-grading; the corpus safety walk scans authored case and contract strings while prompt reconstruction
proves the stored prompt contains only the canonical guide, case, neutral schema, and tools-disabled
state. No design deviations were introduced.

## Doc impact

- Replace the customer-visible canonical guide at
  `packages/cli/templates/guides/data-architecture-guide.md`; reconciliation and generation update
  `.safeword/guides/data-architecture-guide.md` and
  `plugin/resources/guides/data-architecture-guide.md`.
- Document the exact record and verify commands in the repository-only
  `packages/cli/tests/fixtures/data-architecture-eval/README.md`; keep maintainer harness commands out
  of every customer-shipped guide copy.
- `README.md`: skip — no install command, public CLI contract, or navigation changes.
- `packages/website/src/content/docs`: skip — this issue changes the installed agent guide itself,
  not a website-facing feature or CLI reference.

## Assessment triggers

- The product begins claiming pass-rate, first-attempt, or cross-model reliability; add repeated
  trials and statistical thresholds before making that claim.
- A supported host changes guide ownership or planning-reference generation; update the literal
  delivery inventory and surface proof.
- Structured semantic IDs cannot represent a newly accepted qualitative rule; add a calibrated
  independent judge only for that irreducible dimension.
- The model-adapter protocol cannot enforce a new provider's tools-disabled or decoding contract;
  add a provider-specific adapter or strengthen isolation.
- The nine-case corpus misses a real review failure; add the smallest case and independent rubric
  that reproduces it before changing guidance.
