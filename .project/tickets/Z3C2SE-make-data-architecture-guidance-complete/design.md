# Design: Complete conditional data architecture guidance

**Related:** [Feature spec](./spec.md) | [Test definitions](./test-definitions.md) |
[Executable scenarios](../../../features/make-data-architecture-guidance-complete.feature)

## Architecture

The canonical guide remains `packages/cli/templates/guides/data-architecture-guide.md`.
Safeword reconciliation installs that file into `.safeword`, while the existing Claude catalogue
generator produces the path-adapted plugin resource. Codex and Cursor consume the installed
`.safeword` guide and do not gain another copy.

A repository-only evaluation harness separates nondeterministic recording from deterministic
verification. A checked-in contract defines the model/version, decoding settings, neutral JSON
response shape, cases, rubrics, prompt format, and named ablation. The recorder launches a
caller-supplied model adapter in an empty temporary working directory and sends only the guide, one
case, and the response schema. The verifier re-derives every digest and grade from canonical inputs,
uses exact set equality for decision and proof-fact IDs, scans fixtures for sensitive-looking values,
and rejects a non-discriminating ablation pair.

```text
canonical guide + case + response schema
                  |
                  v
       isolated model adapter ----> content-bound record
                  |                         |
                  +-------------------------v
cases + independent rubrics ------> deterministic verifier
                                            |
                                            v
                                    focused pass/fail report
```

## Components

### Component 1: Canonical guide

**What:** Defines the universal decision boundary, concise core, six triggered modules, artifact
ownership, and falsifiable proof requirements.

**Where:** `packages/cli/templates/guides/data-architecture-guide.md`

**Dependencies:** Existing planning, architecture, and LLM-evaluation guides.

**Tests:** Guide-contract assertions and the nine recorded cold-start cases.

### Component 2: Evaluation corpus

**What:** Stores independently maintained cases and rubrics, one current result per case, the fixed
recording contract, seeded negative answers, and the named independent-proof ablation.

**Where:** `packages/cli/tests/fixtures/data-architecture-eval/`

**Interface:**

```typescript
interface EvaluationCase {
  id: string;
  text: string;
  rubric: {
    expectedDecisionIds: string[];
    forbiddenDecisionIds: string[];
    expectedProofFactIds: string[];
    forbiddenProofFactIds: string[];
  };
}

interface RecordedResult {
  caseId: string;
  modelVersion: string;
  decodingConfiguration: Record<string, string | number | boolean>;
  prompt: string;
  coldStartPromptSha256: string;
  guideSha256: string;
  caseAndRubricSha256: string;
  responseFormat: string;
  rubricLoader: string;
  response: { decisionIds: string[]; proofFactIds: string[] };
}
```

**Dependencies:** Canonical guide content and Node cryptography/filesystem APIs.

**Tests:** Set-equality positives, every seeded rubric failure, stale/missing record failures, prompt
isolation, content hashes, and sensitive-value rejection.

### Component 3: Recorder and verifier

**What:** Records cold-start responses through a narrow subprocess boundary and verifies stored
results without calling a model.

**Where:** `packages/cli/scripts/data-architecture-eval.ts` and
`packages/cli/scripts/lib/data-architecture-eval.ts`

**Interface:**

```typescript
function buildColdStartPrompt(guide: string, evaluationCase: EvaluationCase): string;
function verifyEvaluationCorpus(root: string): VerificationReport;
function deriveNamedAblation(guide: string, transformName: string): string;
```

**Dependencies:** Structured argv subprocess execution, an empty temporary working directory, the
checked-in evaluation contract, and no new package. The runner follows the bounded stdin, timeout,
and cleanup design already used by the review coordinator but does not reuse its reviewer-specific
packet, capability-probe, tool, or result-schema behavior.

**Tests:** Unit tests for grading/derivation and one wiring test using the real recorder with only the
subprocess model boundary replaced by a controlled adapter.

### Component 4: Delivery verifier

**What:** Proves the supported install/generation workflow produces exactly the canonical template,
installed `.safeword` copy, and path-adapted Claude resource; planning references resolve and
Codex/OpenCode add no guide copy.

**Where:** `packages/cli/tests/data-architecture-delivery.test.ts`

**Dependencies:** `SAFEWORD_SCHEMA`, `generateClaudePluginAssets`, the existing reconciliation
engine, and a literal hand-maintained expected path inventory.

**Tests:** Fresh install/generation integration plus a literal map requiring exactly one planning
reference for Claude, Codex, and Cursor and zero for OpenCode, with seeded missing-copy, extra-copy,
body-drift, illegal-substitution, absent-reference, broken-reference, cross-surface-reference, and
unexpected OpenCode-reference cases.

## Data Model

The corpus has four independent authorities:

- `contract.json` owns the concrete model version, exposed inference settings, response protocol,
  and named ablation binding.
- `cases.json` owns case prose plus expected/forbidden decision and proof-fact IDs.
- `records.json` owns the nine current full-guide responses and their content bindings.
- `ablation-record.json` owns the current recorder-produced response against the derived guide
  ablation.

The verifier derives prompt, guide, case/rubric, and ablated-guide hashes rather than trusting stored
pass/fail fields. Expected and actual IDs are compared as sets, never by order. The delivery inventory
lives in test code rather than being derived from the schema or generator it checks.

Sensitive-value scanning covers independently authored case prose. Prompt bytes and hashes are
reconstructed, response IDs are exact-set graded against the rubric, and the remaining hashes are
recomputed from canonical inputs rather than accepted as authored evidence.

## Component Interaction

1. The recorder loads one case, the canonical guide, and the fixed response schema, constructs the
   exact prompt, then invokes the model adapter in an empty working directory with tools disabled by
   the adapter protocol.
2. The recorder stores the response and provenance fields, then invokes the same deterministic grader
   used by verification.
3. Verification reloads canonical inputs, re-derives hashes and the named ablation, scans authored
   case prose, and grades full-guide and ablation records.
4. Delivery tests generate/install from the canonical template and compare the resulting
   repository-relative paths and allowed Claude substitutions against independent literals.

## User Flow

1. A Safeword maintainer changes the canonical data-architecture guide.
2. The maintainer follows the repository-only corpus README and runs its record command with a model
   adapter, updating the nine content-bound records plus the paired ablation record.
3. The deterministic verify command reports exact missing, forbidden, unknown, stale, unsafe, or
   non-discriminating evidence.
4. The normal generation/install commands update supported guide surfaces.
5. Focused tests prove guide behavior and delivery before the full suite runs.

## Key Decisions

### Decision 1: Separate model recording from deterministic verification

**What:** One command records context-free model output; a pure verifier owns all release-blocking
grading, content binding, negative fixtures, and ablation checks.

**Why:** Model calls are nondeterministic and credential-dependent, while release verification must
be repeatable and must reject stale or mislabeled evidence.

**Trade-off:** Maintainers explicitly refresh records when the guide, corpus, rubric, model, or
configuration changes; CI does not prove repeated-run reliability.

### Decision 2: Use structured ID sets instead of prose snapshots

**What:** Responses contain decision and proof-fact IDs graded by exact set equality.

**Why:** Multiple phrasings can be correct, but missing, extra, forbidden, or unknown obligations
must fail with focused diagnostics.

**Trade-off:** The corpus maintains stable semantic IDs alongside readable case prose.

### Decision 3: Preserve existing delivery ownership

**What:** The CLI template remains canonical; `.safeword` is reconciled from it, Claude is generated
with literal path adaptation, and Codex/OpenCode gain no copy.

**Why:** This matches the schema-as-source-of-truth and generated-plugin contracts already enforced
by the repository.

**Trade-off:** Delivery verification must distinguish allowed path substitutions from any other
Claude body drift.

## Implementation Notes

**Constraints:** No production credentials or real sensitive data in fixtures; no new dependency;
only one current result per case; no first-try or statistical reliability claim; application code
remains untouched until the implement phase.

**Error handling:** Recorder failures name the adapter, case, and failed protocol stage before staged
files are promoted. Each file replacement is atomic. Verification rejects an interrupted
records/ablation pair whenever its guide, case/rubric, prompt, or recording-contract binding changed;
it does not claim a transaction across both files. Verification aggregates deterministic diagnostics
by case and exits nonzero on any mismatch.

**Gotchas:** The verifier must never derive expected IDs, expected guide paths, or the ablation
transform from generated output. The recorder and verifier re-grade responses from canonical inputs;
there is no stored pass/fail verdict to trust. Model processes run outside the repository so ambient
files and tools cannot satisfy a cold-start case.

**Open questions:** None.

## References

- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://openai.com/index/trustworthy-third-party-evaluations-foundations/
- https://github.com/ArcadeAI/safeword/issues/4560
- `ARCHITECTURE.md` sections “Registry-Driven Agent Integrations with Native Trust Boundaries,”
  “Reconciliation Engine,” and “Generated Native Claude Plugin.”
