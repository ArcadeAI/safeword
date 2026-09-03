# Impl Plan: Keep independent review available through OpenCode

**Status:** implemented
**Planned on:** 2026-09-01

## Approach

**Riskiest assumption:** the pinned OpenCode 1.18.23 process can carry one closed
review result through its one-shot JSON event stream while all tool permissions
are denied. Prove that contract credential-free against the real executable and
a local OpenAI-compatible loopback provider, reusing the existing conformance
fixture technique. Fast fake-process tests remain a supporting layer for error
partitions and coordinator ordering; they are not the host-contract proof.

### Proof plan

| Scenario group | Owner | Primary proof | Key assertion |
| --- | --- | --- | --- |
| R4 complete, ambiguous, and provenance output | Runtime adapter | Unit tests in `tests/review/runtime.test.ts` plus a public-command dispatch-mismatch test | Malformed, empty, and oversized streams produce `invalid_output`; missing/contradictory reviewer identity and dispatch mismatch produce `provenance_mismatch`; the command-level mismatched dispatch exits blocked with no independent check. |
| R4 event envelope and tool denial | Runtime adapter + coordinator | Opt-in live test against pinned `opencode-ai@1.18.23` plus a route-level fake-process test | The real process receives stdin, emits the completed JSON `text` event, and cannot create a sentinel through a denied tool; after Codex exhaustion, a stream with that denied request and one complete result produces exactly one accepted independent result and admits no partial evidence. |
| OpenCode discovery and capability failures | Runtime probe + coordinator | Table-driven runtime and route tests | Missing executable, unsupported version/capability, probe timeout, launch failure, and authentication failure remain distinct typed failures and fail closed before any evidence is accepted; stable 1.x drift is gated by capabilities, not assumed from 1.18.23 alone. |
| R4 process failure and timeout | Shared runner + coordinator | Supporting runner tests in `tests/review/runtime.test.ts` and route-level tests in `tests/review/job.test.ts` | Non-zero exit and controlled deadline expiry clean up the process, record the OpenCode route as failed/timed out after Codex exhaustion, admit no partial evidence, and preserve non-independent fallback policy. |
| R4 source/packet mutation | Existing packet integrity path | Integration tests in `tests/review/job.test.ts` | Source change is stale; packet mutation is failed for OpenCode as for existing reviewers. |
| R1 preferred pairings and retry classification | Route plan + coordinator | Integration tests in `tests/review/job.test.ts` with invocation-recording executables | Claude↔Codex ordering remains unchanged; preferred success and eligible-retry success leave the OpenCode invocation count at zero; a terminal preferred failure is never retried even when a retry slot remains. |
| R2 command-level OpenCode fallback, require success, and deadline boundary | Public `review run` command | Command tests with real catalog/config/packet collaborators and invocation-recording fake executables | Claude- and Codex-authored work can reach OpenCode after preferred exhaustion; valid OpenCode evidence exits 0 with OpenCode named under `require`; exactly the minimum route budget records one OpenCode launch; below-minimum budget records zero OpenCode launches and preserves the pre-change `prefer` `action_required`/`REVIEW_ROUTES_EXHAUSTED` result at exit 2 while `require` remains blocked; same-author fallback is suppressed after success. |
| R2 degraded failure policy | Coordinator + public result projection | Integration and command tests | An unusable OpenCode route returns same-author feedback with `independence: degraded`; an approving fallback keeps `prefer` at public state `healthy`, status `approved`, exit 0 with a provenance warning rather than an outage, while `require` remains `action_required`/blocked at exit 2. |
| R3 OpenCode-authored routing and self-review policy | Identity + coordinator | Public `review run` command tests with fake reviewer executables | Command-level wiring in both directions: Claude/Codex authors can reach OpenCode, while `SAFEWORD_AGENT_RUNTIME=opencode` routes Claude then Codex; a successful Codex fallback records no simultaneous OpenCode self-review; with both independent reviewers unavailable, `prefer` reports non-independent OpenCode feedback and `require` reports blocked. |
| R5 Cursor/unknown unchanged | Route plan | Unit plus command result tests | Unsupported authors report the existing unsupported-author-runtime result with no reviewer route attempted, no OpenCode spawn, and no independent check. |
| OpenCode review-stamp persistence | CLI and installed hook ledger copies | `tests/integration/review-stamp.test.ts`, `tests/hooks/review-ledger.test.ts`, and template/dogfood parity tests | Both duplicated ledgers parse and revalidate cross-runtime `opencode` identities and reject an OpenCode-author/OpenCode-reviewer pair as independent. OpenCode stamps omit `model` unless the runtime emits a verifiable model identifier; an absent model fails the opt-in `crossModelReview` gate closed while remaining valid for cross-agent review. Tests cover known-model round-trip, unknown-model cross-model rejection, and template/dogfood parity. |
| Affected surfaces | Same command-level tests | Integration | Claude Code, OpenAI Codex, and OpenCode identities all traverse the Safeword CLI command; surface tags map to those cases. |

### Build order

1. **RED — real host contract:** Add an opt-in live test that launches pinned
   `opencode-ai@1.18.23` against a local OpenAI-compatible loopback provider. It
   must observe the review prompt arriving via stdin, return a valid closed
   review in the real completed-text event envelope, request a sentinel tool,
   and prove deny-all prevents the sentinel side effect.
2. **GREEN — runtime adapter:** Extend reviewer types/schema expectations; add
   OpenCode CLI flags, required capabilities, environment filtering/deny
   controls, JSON-event parsing, and runtime identity until the real proof passes.
   Add fast fake-process cases for malformed/empty/oversized output, non-zero
   exit, timeout, argv/environment, and stdin delivery.
3. **RED/GREEN — route policy:** Replace pair-only selection with an ordered
   route plan; add pure policy tests for all author runtimes.
4. **RED/GREEN — coordinator:** Generalize remaining-route execution to run the
   second independent reviewer before the existing degraded fallback, preserving
   the preferred reviewer's alternate-model behavior, deadline, provenance,
   mutation, and failure reporting. OpenCode receives one attempt only: Safeword
   does not select its model and therefore cannot choose or claim an alternate;
   retryable or terminal OpenCode failure proceeds to the policy-controlled
   degraded route. Prove that classification with remaining budget.
5. **Wiring and stamps:** Exercise the public `review run` command with real
   config/packet collaborators and fake only Claude/Codex/OpenCode executables.
   Cover all five command-scoped cases: fallback success, required-gate success,
   both exact/below-minimum deadline outcomes, and mismatched-dispatch blocking;
   assert process exit, public status, reviewer identity, and independence.
   Extend review-ledger/stamp identities so verified OpenCode provenance can be
   persisted without widening the closed result contract elsewhere.
6. **Docs, architecture, and generated copies:** Update README, `packages/website/src/content/docs/reference/cli.mdx`,
   and `packages/website/src/content/docs/reference/configuration.mdx`,
   revise the existing `ARCHITECTURE.md` cross-agent coordinator decision in
   place for the third runtime, regenerate template-derived dogfood copies via
   the repository install workflow, run `bun run generate:codex-plugin` and
   `bun run generate:claude-plugin` from `packages/cli`, and update generated
   purpose prose when its described reviewer set changes.
7. **Verification:** Run focused review/runtime/identity and public-command tests,
   BDD lane, lint, typecheck, `bun run --cwd packages/cli test:release`, then the
   full repository suite once. Extend the
   existing pinned OpenCode CI job and locally run
   `SAFEWORD_RUN_OPENCODE_CONFORMANCE=1 bun run --cwd packages/cli test tests/opencode/conformance-command.test.ts tests/review/opencode-live.test.ts`
   so the credential-free real-process proof executes against 1.18.23 rather
   than remaining an unrun opt-in test.

The four implementation slices in steps 2–5 and twenty-three scenarios remain one cohesive feature;
splitting would create partial routes with no independent user value.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://github.com/anomalyco/opencode/blob/v1.18.23/packages/web/src/content/docs/cli.mdx | 2026-09-01 | 1.18.23 | pinned CI/live-proof version 1.18.23 | Documents `run`, JSON events, model selection, `--pure`, and inline config environment variables. | Use the native one-shot CLI as the process boundary. | OpenCode persists sessions and emits events rather than a single schema response; Safeword accepts only its bounded final text result. MIT licensed; no source copied. |
| https://github.com/anomalyco/opencode/blob/v1.18.23/packages/web/src/content/docs/permissions.mdx | 2026-09-01 | 1.18.23 | pinned CI/live-proof version 1.18.23 | Documents global deny policy, permissive defaults, and the complete permission categories. | Explicitly deny all permissions; never rely on defaults. | Permission denial is defense in depth, not proof of no mutation; packet/source hashes remain authoritative. MIT licensed; no source copied. |
| https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/cli/cmd/run.ts | 2026-09-01 | 1.18.23 | pinned CI/live-proof version 1.18.23 | Shows stdin fallback and completed `text` JSON events; the relevant stdin/event lines are unchanged in checked 1.18.25. | Stream the bounded prompt on stdin and parse completed text events. | Upstream event shape may change; the pinned real-process proof and capability checks must fail closed. MIT licensed; no source copied. |

**Decision impact:** retained: extend the existing trusted-executable process adapter because current OpenCode exposes the same bounded one-shot shape with a different output envelope.
**Decision informed:** Invoke OpenCode through the existing trusted headless process boundary.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Invoke OpenCode through the existing trusted headless process boundary. | `opencode run --format json --pure`, stdin prompt, deny-all permissions, shared cleanup/deadline. | Long-lived `serve` API; bespoke SDK; shell wrapper. | Server/SDK add lifecycle and dependency surface; wrapper weakens executable trust and argv boundaries. |
| Represent reviewer selection as an ordered route plan. | Preferred independent reviewer, next independent reviewer, then same-author degraded reviewer. | Nested special cases; generic unbounded reviewer list. | Special cases duplicate policy; an open-ended list obscures the fixed independence and retry contract. |
| Parse OpenCode events inside the runtime adapter. | Extract the single completed text result, then reuse the closed output validator and provenance check. | Ask OpenCode for plain text; trust exit code; add an OpenCode-only result schema. | Plain text and exit zero are ambiguous; a second schema would fork the trust contract. |
| Treat OpenCode as a one-attempt independent fallback. | Do not retry or select an alternate OpenCode model; after its failure, continue to the bounded degraded route according to policy. | Retry the same OpenCode configuration; select a Safeword alternate model. | Retrying changes deadline semantics without independent diversity; selecting a model contradicts the user-owned provider/model boundary. |
| Fail closed on unverifiable OpenCode model identity. | Persist a model tag only when emitted verifiably; otherwise cross-agent evidence is valid but opt-in `crossModelReview` remains unsatisfied. | Guess the configured model; treat unknown as different. | Either alternative can falsely certify a cross-model review. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Automatic fallback needs no user routing, while typed command results still expose the actual reviewer and failure chain. | `packages/cli/tests/cli-protocol/review-wiring.test.ts` | |
| 1. Structure enforces; instructions suggest | Different runtime plus closed provenance satisfies independence; deny permissions and post-run hashes enforce the read-only boundary. After every independent route fails, exact non-independent provenance preserves useful same-author feedback without mislabeling it. | `packages/cli/tests/review/runtime.test.ts` | |
| 3. Add, never replace | Existing preferred pairings, policy behavior, models, and result fields remain intact; OpenCode is additive. | `packages/cli/tests/review/policy.test.ts` | |
| 5. Correct and safe; then clear; then simple | Reuse one process runner and one result schema; isolate only OpenCode's flags and event parsing. | `packages/cli/tests/review/runtime.test.ts` | |

**Architecture decisions honored:** `ARCHITECTURE.md` → “Host-owned cross-agent adversarial review coordinator.” Amend that accepted record in place with a dated OpenCode subsection, preserving the original Claude/Codex rationale, consequences, and reassessment trail verbatim. This follows the document's living-decision update policy; the change adds one concrete route to the same coordinator rather than replacing the decision, so a supersession entry would split one still-current rationale across two records.

## Known deviations

skip: no principle deviation planned. The inherited internal value
`independence: degraded` is provenance, not the public service state: under
`prefer`, approving same-author feedback remains `healthy`/`approved` with exit
0 and a warning; only `require` blocks. Command tests pin that distinction.

## Doc impact

- `README.md`: list OpenCode among independent reviewer/fallback runtimes and state the independence rule.
- `packages/website/src/content/docs/reference/cli.mdx` and `reference/configuration.mdx`: document route order, policy outcomes, and OpenCode requirements.
- `ARCHITECTURE.md`: update the accepted host-owned coordinator decision from a Claude/Codex pair to the fixed three-runtime route plan and record the real OpenCode boundary proof.
- `packages/cli/architecture.generated.md`: update only affected human-owned purpose prose if it still describes a two-runtime reviewer set after generation.

## Assessment triggers

- OpenCode changes or removes `run --format json`, `--pure`, stdin prompt input,
  or the completed `text` event shape.
- OpenCode adds a native closed JSON-schema output contract that removes the
  need for event extraction.
- A fourth review runtime is requested; replace the fixed three-agent plan only
  when another concrete route exists.
- Live conformance shows deny-all permissions or `--pure` do not isolate a
  supported stable 1.x release.
- If `--pure` prevents the project-local loopback provider configuration from
  loading, stop and revise the process-boundary decision; do not silently remove
  plugin isolation or substitute a credentialed provider.
