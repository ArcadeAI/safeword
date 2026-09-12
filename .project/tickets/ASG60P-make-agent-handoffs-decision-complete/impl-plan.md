# Impl Plan: Make terminal handoffs decision-complete

**Status:** planned

## Approach

**Riskiest assumption:** one explicit terminal-role grammar can be strict enough
to reject the two observed incomplete handoffs while remaining quiet for valid
decision, blocked, action, and short conversational replies across all three
hosts. The cheapest proof is the first slice: `Each required decision role is
independently enforced for Next and Need`, the two observed-omission scenarios,
their self-contained rewrites, and the four `Held-out ...` route, term, reason,
and action outlines. If that slice cannot classify the
fixed contract-derived corpus without fixture-specific branches, stop before
wiring any native hook.

Introduce `terminal-handoff/v1` in the existing zero-dependency
`hooks/lib/quality.ts` vocabulary module. The decision form is the same for
`Next` and `Need`: one terminal top-level paragraph with explicit `Choice`,
`Recommendation`, `Reason`, `Impact`, and `Reply` roles. The no-decision form is
one `Action` with at most one optional `Reason`. The surrounding structured brief
supplies the declared route: `Open` records `human: <one choice>` or `none`,
while `BLOCKED` implies a human-owned choice. A human declaration paired with
the action form is the exact discriminator for the accepted "decision disguised
as an action" scenarios. The evaluator validates this declared route and
terminal evidence instead of pretending to detect a falsely agent-owned
declaration from unrestricted prose.

The other semantic terms also have observable contract syntax rather than
fixture word lists:

- a concrete action contains one imperative `Action` clause with a non-empty
  specific `Object` clause; multiple clauses or a missing object fail;
- an optional action reason uses one `Reason: Required because ...` clause with
  a non-empty condition or consequence; extra explanation fails as non-essential
  context;
- a necessary unfamiliar term is explicitly marked `Term: <term> = <plain
  meaning>` in the terminal paragraph; a marked term without both sides fails.

These declarations make validation deterministic. The agent-facing contract
still requires the model to mark ownership, necessity, and unfamiliar terms
honestly; runtime enforcement checks the observable declaration, not its truth.

Route resolution is conservative and version-aware. Exact `Open: none` selects
the action form; exact `Open: human: <one choice>` selects the decision form;
`BLOCKED` always selects the decision form. An absent, legacy free-prose, or
malformed `Open` value on a substantive `CONFIDENT` reply also selects the
decision form and records a route migration violation. The observed pre-contract
omission must therefore fail with the missing decision-role set (plus the route
violation), never only a generic routing error and never outside-contract.

`Object` specificity is syntactic: after normalization it must contain at least
one content token outside a closed set of articles, pronouns, and deictic
placeholders such as `it`, `this`, `that`, `thing`, and `the work`. The contract
rejects a missing or placeholder-only object without claiming to understand the
noun phrase's real-world quality.

Every decision-role value uses the same content floor: after stripping its role
label, it must contain a content token and must not normalize to the closed
placeholder/back-reference set (`TBD`, `same`, `as above`, `see analysis`,
`described earlier`, and grammatical equivalents). This rejects structurally
present but scroll-dependent values while remaining a deterministic contract,
not a prose-quality score.

Decision cardinality is likewise syntactic: one terminal paragraph contains
exactly one `Choice` clause and one `Reply` clause. A second clause, a Markdown
list marker, or an enumeration separator inside either value fails as more than
one choice/reply. The evaluator does not infer that two ideas hidden in one
unmarked sentence are unrelated.

Extend `evaluateDecisionBriefCompliance` rather than replacing the existing
bounded CommonMark scanner. Its result will distinguish outside-contract,
structural, decision-role, action-role, routing, term-explanation, and cardinality
failures; expose the contract version and stable named requirements; and retain a
fixed linear work counter. The terminal parser may scan only the terminal
paragraph for role satisfaction, so earlier prose cannot lend missing evidence.

Applicability is a separate explicit input. The shared evaluator receives the
reply plus `substantiveEvidence`, a closed set derived by each adapter:
`structured-verdict` when the reply contains a top-level `CONFIDENT` or
`BLOCKED`, `current-turn-tool` when the host transcript records a tool call in
the current turn, `current-turn-edit` from Cursor's existing edit marker, or
`none`. A reply with a verdict or observed current-turn work is applicable even
when `Open`, `Next`, or `Need` is absent and is rejected as structurally missing;
a plain reply with `none` is outside the contract. `Open` is an existing required
CONFIDENT brief field whose value becomes versioned route syntax, not a new
paragraph. Role satisfaction still reads only the terminal paragraph.

Wire the evaluator through the real registered Stop paths:

- Claude Code consumes `last_assistant_message`, after hard gates and
  `stop_hook_active`, before optional generic review. Its existing bounded
  current-turn transcript scanner supplies `current-turn-tool`; missing or
  unreadable transcript evidence fails open unless the reply itself carries a
  structured verdict.
- OpenAI Codex 0.153.4 consumes documented `last_assistant_message` and
  `stop_hook_active` fields in `codex/stop.ts`, after stronger ticket state checks
  and before lower-priority advisory continuation. Its documented
  `transcript_path` supplies current-turn tool evidence only; if absent or
  unreadable, a structured verdict still applies and otherwise the check fails
  open.
- Cursor reads the last assistant message from `transcript_path` on its native
  `stop` event and suppresses when `loop_count > 0`; setup's `loop_limit: 1`,
  confirmed in `packages/cli/src/templates/config.ts`, is defense in depth.

Each adapter catches payload, transcript, contract, and evaluator failure and
returns its normal successful no-op. Incomplete applicable handoffs receive one
contract-versioned correction in the host's native continuation shape. The
correction names the exact missing or conflicting requirements and asks only for
the terminal paragraph rewrite.

The correction is default-on because terminal format is already a mandatory
Safeword contract and prompt-only delivery is the confirmed failure. Add
`terminalHandoffCorrection: false` as the explicit emergency off switch; it
disables only this presentation correction, never hard completion or safety
gates. Add the key reader beside the existing config-flag helpers in
`hooks/lib/review-ledger.ts`, document its Boolean-only/default-on semantics,
and cover malformed, absent, true, and false values in config and native-boundary
tests.

### Scenario proof map

| Scenario group | Primary RED/GREEN proof | Supporting proof |
| --- | --- | --- |
| Complete/missing `Next` and `Need` roles, empty paragraph, one-choice cardinality, and marked-term explanation | Table-driven unit tests in `tests/hooks/terminal-handoff-contract.test.ts` | Bounded scanner work assertions, legacy-route regression, and held-out paraphrases |
| Concrete action, optional/essential reason, vague/multiple/ceremonial action, and disguised decision | Same focused evaluator test with explicit routing fixtures | Existing reply-shape structural cases stay green |
| Short conversation and brief substantive applicability | Pure evaluator applicability table | Real-host compliant/no-op outlines |
| Versioned symmetric contract and validator rejection paths | Contract-validator unit table | Renderer snapshot proves both decision variants share one five-role set |
| Long observed failures, rewrites, action cases, and deterministic oracle | Checked-in `tests/fixtures/terminal-handoff-corpus.ts` evaluated by fresh evaluator instances | Corpus expectations and missing-role sets are authored directly from the canonical contract, never generated by the evaluator; generated-copy imports are parity proof only |
| Claude, Codex, and Cursor correction/no-op/fail-open cases | Real subprocess tests invoking the command read from each installed host configuration | Frozen native payload/transcript fixtures; normal cases replace only the external host process. Evaluator-failure cases use a temporary installed hook tree whose otherwise-compatible `quality.ts` evaluator throws, proving the adapter catches a damaged collaborator through the same registered command. |
| Repeat suppression, fresh session, and compliant-stop re-arm | Repeated real subprocess invocations using each host's native loop fields | Assertions cover both correction count and successful process exit |
| Version, missing-copy, role-set, and corpus-behavior parity | Real `bun scripts/parity-check.ts --mode=all` fixture runs | Existing generation and dogfood parity tests |

Create `steps/make-agent-handoffs-decision-complete.steps.ts` and
`features/make-agent-handoffs-decision-complete.bdd-proof.json`. Every saved
scenario gets one RED → GREEN → REFACTOR ledger loop. Scenario outlines may use
one table-driven focused test, but each ledger scenario receives its own failing,
passing, and refactor commit evidence. The feature tag and focused Vitest file
run together at each loop; never start a second Vitest process while one is live.

### Build slices

1. **Contract slice:** write executable steps and failing evaluator/validator
   tests for decision roles, action roles, routing, applicability, term handling,
   cardinality, and deterministic work; implement the versioned grammar and
   correction text in canonical `quality.ts`, and update the canonical
   `packages/cli/templates/SAFEWORD.md` guidance plus the typed Boolean config
   reader in the same slice.
2. **Corpus slice:** add the two observed failures, compliant rewrites,
   no-decision cases, and held-out paraphrases with independently authored
   expected results in the RED commit; prove earlier prose cannot satisfy the
   terminal paragraph and legacy `Open` still reports missing decision roles.
3. **Claude/Codex slice:** drive the configured hook commands as subprocesses,
   then integrate first-stop correction, re-entry suppression, successful no-op,
   failure isolation, and precedence with existing hard gates/advisories.
4. **Cursor slice:** drive the configured `stop` command and real transcript
   reader, then add `loop_count`, first-follow-up correction, fail-open behavior,
   and coexistence with review/retro continuation priority.
5. **Delivery slice:** extend parity to version, role-set, required-copy, and
   corpus behavior; regenerate Claude and Codex plugin artifacts, verify the
   Cursor `safeword-core` wrapper from `packages/cli/src/cursor-wrappers.ts`
   still resolves the reconciled customer-installed `.safeword/SAFEWORD.md`,
   exercise setup into a temporary customer project, and reconcile dogfood with
   `bun run parity:fix` rather than hand-editing generated copies.
6. **Dogfood observation:** run the reconciled hook over a bounded sample of
   current substantive dogfood replies plus the short-conversation corpus;
   record every correction and confirm the off switch suppresses only terminal
   presentation correction. Default-on passes only with zero corrections for
   every new-grammar compliant and short-conversation case, and with every
   pre-contract correction matching its recorded route/missing-role oracle; any
   unexpected correction returns work to the contract slice.
7. **Cross-scenario refactor:** run the feature tag, focused integration suite,
   typecheck, lint, release/parity checks, then the final full suite once. Update
   remaining user documentation and the accepted architecture decision before
   verification.

This is one feature: the shared contract is the dependency for all three small
adapters, and splitting it would create an untestable intermediate release.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [Claude Code hooks](https://code.claude.com/docs/en/hooks) and [Cursor hooks](https://cursor.com/docs/hooks) | 2026-09-12 | Claude Code 2.1.268 docs; Cursor hooks current docs | Safeword `terminal-handoff/v1` | Both hosts expose a terminal event, final-response access, and bounded continuation state | Correct once at the host's native terminal boundary and fail open when observation is unavailable | Host payloads and continuation schemas differ; no host contract implies semantic truth, and no external code is copied |
| [OpenAI Codex hooks](https://learn.chatgpt.com/docs/hooks) | 2026-09-12 | Codex CLI 0.153.4 release behavior | Safeword `terminal-handoff/v1` | The Stop event documents `last_assistant_message`, `stop_hook_active`, `transcript_path`, and `decision: "block"` continuation | Consume the stable final-message field, use native re-entry state, and treat the transcript only as optional applicability evidence | The transcript format is explicitly unstable; absence or parse failure must fail open, and no external code is copied |

**Decision impact:** changed: prompt-only distribution becomes a shared explicit-role contract plus one bounded native correction on each supported host.

**Decision informed:** Terminal handoff enforcement

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Terminal handoff enforcement | Shared deterministic contract plus one native-boundary correction | Prompt-only guidance; an LLM judge at every Stop | Prompt-only guidance produced issue #4500; a model judge adds latency, drift, and correlated judgment without making the terminal evidence deterministic. |
| Decision-form grammar | Explicit `Choice`, `Recommendation`, `Reason`, `Impact`, and `Reply` roles inside the terminal `Next` or `Need` paragraph | Free-prose keyword search; separate `Next` and `Need` grammars | Free prose cannot be classified reliably; separate grammars recreate the observed asymmetric blocked path. |
| Substantive eligibility | Use explicit structured-brief route (`Open: human: <choice>` or `Open: none`) plus host/current-turn work evidence; ordinary conversation is outside the contract | Apply the template to every answer; infer substantive work from reply length | Universal templating harms routine chat; length is not evidence that work occurred. |
| Host loop control | Native `stop_hook_active` or `loop_count`/`loop_limit`, scoped to the current correction cycle | Durable global latch; unbounded retries | A global latch leaks across sessions and requires re-arm state; retries can trap the agent. |
| Enablement | Default on with `terminalHandoffCorrection: false` as a narrow off switch | Reuse optional `stopQualityReview`; staged opt-in; no escape hatch | The existing optional review already failed to cover the contract, opt-in would preserve the bug by default, and a narrow escape hatch limits false-positive blast radius without weakening other gates. |
| Delivery parity | Compare required copies by version, unordered roles, and fixed corpus behavior through `bun scripts/parity-check.ts --mode=all` | Compare prompt presence or bytes only | Presence/byte checks can faithfully distribute an incomplete or internally contradictory contract. |

Evidence: Claude documents `last_assistant_message` and `stop_hook_active` in
its [hooks reference](https://code.claude.com/docs/en/hooks). Cursor documents
the `stop` event, `followup_message`, `loop_count`, and configurable loop limit
in its [hooks reference](https://cursor.com/docs/hooks). CommonMark 0.31.2 defines
the top-level paragraph/container behavior used by the existing bounded scanner
in the [block specification](https://spec.commonmark.org/0.31.2/). Official
[OpenAI Codex hook documentation](https://learn.chatgpt.com/docs/hooks) names
`last_assistant_message`, `stop_hook_active`, and `decision: "block"` for Stop;
when the official page and installed 0.153.4 generated schema disagree, the
release-matched schema is the test fixture authority and the discrepancy blocks
shipping rather than inventing a fallback field.

## Design alignment

| Principle / architecture decision | Consequence | Proof |
| --- | --- | --- |
| Optimize for the Non-Technical Builder without constraining the Technical Builder | Human decisions carry five familiar-language role labels with inline term meanings; routine work carries one action and optional essential reason. | Independently reviewed NTB1.R1 scenarios plus renderer snapshots that contain no unexplained Safeword vocabulary |
| Structure enforces; instructions suggest | The renderer and evaluator share one grammar, and native Stop adapters correct a missing role once. | SWM1.R1 and SWM1.R3 |
| Fire at boundaries, not every turn | Full evaluation runs only on substantive native terminal events, never on every prompt. | Short-conversation and native-boundary no-op scenarios |
| Correct and safe, then clear and simple | Existing hard gates and continuation priorities stay ahead of presentation repair; diagnostic text names only the failed contract roles. | Host precedence regression tests and correction snapshots |
| Reconciliation over copy | Canonical templates remain authoritative; generators and setup produce delivered copies. | SWM1.R4 plus setup/generation parity tests |
| Cross-agent Stop delivery | Each host retains its native output schema while consuming the same contract result. | Registered-command subprocess outlines |

The feature adds a project-wide cross-host terminal contract, so
`ARCHITECTURE.md` will gain an accepted **Versioned Terminal Handoff Contract**
decision. It extends, rather than supersedes, Continuous Quality Gates and
Cross-agent Stop delivery: evidence gates keep their precedence and Codex
continuation remains advisory.

## Known deviations

The evaluator proves declared and explicit evidence, not the truth of a
recommendation, ownership label, `Required because` claim, or unfamiliar-term
marking. That is an intentional boundary: inferring those facts would require
an unbounded or model-graded semantic judge. The accepted disguised-decision
scenarios are satisfied specifically as declared human-route/action-form
mismatches; a falsely declared agent-owned route is not detectable. The
contract makes ownership, roles, cardinality, reason claims, and marked-term
explanations observable; corpus and held-out cases test those mechanics without
depending on the two incident strings.

The shared-evaluator oracle scenario compares each result to independently
authored, contract-derived expectations. Delivered-source behavior belongs to
SWM1.R4. The expectations and missing-role sets are committed in the RED step
before the evaluator's GREEN commit and are not rewritten during REFACTOR.

The necessary-term diagnostic covers explicitly marked but incomplete `Term`
clauses only. Unmarked unfamiliar jargon is not observable to the local parser.
Likewise, `Object` concreteness means “contains a non-placeholder content token,”
not that the object is genuinely useful; real false negatives trigger reassessment.
Decision cardinality detects repeated clauses, lists, and explicit enumeration
separators, not two unrelated ideas hidden inside one unmarked sentence.

Cursor's hook must parse a host-owned transcript because Cursor exposes no
`last_assistant_message` field. Layout drift can therefore silently disable
correction while returning a successful no-op; the frozen native fixture and
assessment trigger are the accepted detection boundary. The hook's own
`loop_count > 0` check is the primary one-correction bound; `loop_limit: 1` is
defense in depth.

## Doc impact

- `packages/cli/templates/SAFEWORD.md`: replace free-prose terminal guidance
  with the versioned decision/action forms and ownership signal.
- `README.md`: describe decision-complete terminal calls without exposing hook
  internals.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: update its
  existing Claude/Cursor/Codex Stop rows with native one-shot correction and
  fail-open behavior.
- `packages/website/src/content/docs/reference/configuration.mdx`: document
  default-on `terminalHandoffCorrection` and its narrow `false` escape hatch.
- `ARCHITECTURE.md`: add the accepted cross-host contract decision and bump its
  minor version/date.

## Assessment triggers

- Claude Code or Codex removes `last_assistant_message` or changes
  `stop_hook_active` semantics.
- Cursor changes the `stop` transcript, `followup_message`, `loop_count`, or
  `loop_limit` contract.
- A new terminal intent cannot be expressed as one decision or one action.
- Real false positives show that the explicit ownership route is routinely
  misdeclared.
- Real under-declarations—human choices labeled `Open: none` or unfamiliar terms
  left unmarked—reproduce a non-actionable handoff without a correction.
- The parser exceeds its fixed linear-work factor or needs a runtime dependency.
- A supported host provides a native typed response schema that can replace the
  Markdown role grammar.
