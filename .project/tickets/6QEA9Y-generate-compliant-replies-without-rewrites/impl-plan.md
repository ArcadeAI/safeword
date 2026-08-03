# Impl Plan: Generate compliant replies without correction loops

**Status:** implemented

## Approach

The riskiest assumption is that a small, dependency-free block scanner can
recognize the exact top-level decision brief without implementing all of
Markdown. The cheapest behavioral proof is `Ignored Markdown content does not
poison a valid terminal brief`; the one/two/four-megabyte scenario then proves
the same classifier remains bounded under adversarial input.

Create one phase-neutral decision-brief vocabulary module in
`packages/cli/templates/hooks/lib/quality.ts`. It owns verdict names, ordered
required/optional paragraph labels, terminal labels, and the prose used to
render the proactive contract. The same object feeds:

1. a renderer used by the dedicated Claude `session-reply-format.ts` hook;
2. a bounded line scanner used by `stop-quality.ts`; and
3. the existing compact `UserPromptSubmit` reminder.

The scanner normalizes CRLF and classifies CommonMark blocks in one forward
pass. Only exact top-level paragraph labels qualify. Blockquotes, list items,
fenced or indented code, and HTML blocks/comments neither create a brief nor
poison a later valid terminal brief. Its result includes the compliance
decision and examined-character count so the linear-work invariant is directly
measurable without wall-clock inference.

`session-reply-format.ts` emits the rendered contract only for
`--agent=claude`, in a dedicated `additionalContext` value below Claude's
10,000-character per-hook limit. The existing `session-safeword-context.ts`
continues to own standing instructions independently. Both use unmatched
SessionStart registrations, which cover startup, resume, clear, compact, and
fork. Config and generated-plugin tests execute the configured legacy group
and plugin dispatcher—not merely one script—to prove each delivery surface
contains the contract and existing SAFEWORD standing context exactly once.
The new hook is schema-registered; Cursor and Codex keep their current behavior.

In `stop-quality.ts`, retain the existing order: hard gates on every Stop,
`stop_hook_active` loop guard, first-Stop typecheck advice, then the existing
phase-review eligibility decision. When a review is eligible, record the review
state and allow a structurally compliant `last_assistant_message` to stop;
otherwise emit the existing phase-specific correction. This changes only the
redundant soft review path.

### Proof plan

| Scenario | Primary proof | Why this scope is sufficient |
| --- | --- | --- |
| Complete CONFIDENT / compliant first Stop | Integration: real `stop-quality.ts` subprocess | Proves the actual Claude Stop boundary emits no continuation and defeats an implementation that always emits the review. |
| Complete BLOCKED with terminal Need | Integration: real Stop subprocess | Protects the BLOCKED grammar mismatch at the entry point. |
| Near-complete first reply | Integration: real Stop subprocess | Proves missing Open receives the canonical correction. |
| Builder sees one live completion | Manual E2E: configured local Claude session | Only a live runtime proves one visible assistant completion. |
| Live runtime unavailable | Verification evidence assertion | Requires `verify.md` to name the limitation and forbids substituting hook output. |
| First non-compliant correction | Integration: real Stop subprocess | Proves the fallback continuation and exact correction output. |
| Correction attempt does not loop | Integration: real Stop subprocess with `stop_hook_active` | Proves bounded retry through the host field. |
| All SessionStart sources | Integration: generated configured hook-group outline | Proves startup/resume/clear/compact/fork selection, exact-once contract delivery, and preservation of existing SAFEWORD context. |
| Startup excludes phase evidence | Integration: real SessionStart subprocess | Proves the proactive source is phase-neutral. |
| RED/GREEN/REFACTOR stay quiet | Integration: real `prompt-questions.ts` subprocess outline | Proves every ledger step retains lead-only context. |
| Ordinary prompt reminder | Integration: real prompt subprocess | Proves the compact cue names CONFIDENT/Next and BLOCKED/Need without demanding both terminals. |
| Hard gates on first/correction Stop | Existing plus targeted Stop integration outline | Exercises every hard gate before compliance and loop state. |
| First-Stop typecheck precedence | Existing `stop-typecheck-gate` harness plus targeted case | Proves advice wins before compliant pass-through. |
| Correction loop guard precedence | Integration with real typecheck error fixture | Proves active correction suppresses otherwise-actionable advice and format output. |
| Both hooks follow a changed contract | Integration: installed hook tree, altered canonical fixture, real SessionStart and Stop subprocesses | Proves the configured consumers import one canonical source. |
| Installed hook drift | Setup/reconciliation integration | Proves the owned hook is restored from its canonical template. |
| Plugin runtime drift | Run the real Claude plugin generator, then assert the generated-artifact worktree gate rejects a stale committed plugin | Proves canonical template changes cannot leave an internally consistent but stale generated plugin. |
| Dogfood drift | Template parity integration | Proves the byte-pair mismatch is reported by parity. |
| Accepted boundary shapes | Unit: table-driven scanner test | Dense pure parsing cases are faster and clearer at unit scope. |
| Adversarial terminal shapes | Unit: table-driven scanner test | Covers every malformed grammar/container partition without subprocess overhead. |
| Ignored content does not poison | Unit: table-driven scanner test | Distinguishes ignore semantics from blanket rejection. |
| Linear parser work | Unit: instrumented one/two/four-megabyte size series | Character count proves complexity without relying on runner timing. |
| Hook performance budget | Manual benchmark: declared reference runner, fixed workload, warm-up, and repetition policy | Separates operational timing evidence from deterministic CI correctness. |

The Cucumber step file will bind each saved scenario to these Vitest-backed
helpers or equivalent real subprocess fixtures, and `bun run test:bdd` remains
the feature-level acceptance lane.

### Affected surfaces

- **Claude Code:** real configured SessionStart group, UserPromptSubmit, and Stop
  subprocesses; the installed local `claude 2.1.170` runtime makes the live
  walkthrough required unless availability changes during verification.
- **Claude Code Cloud:** skip: this environment cannot launch an
  Anthropic-managed session; verification records the limitation explicitly.
- **Safeword CLI:** temporary-project setup/reconciliation plus parity and
  packaged-plugin generation tests.

### Build order

1. RED/GREEN/REFACTOR the structured grammar, renderer, scanner boundaries,
   ignored-container behavior, and instrumented linear-work proof; retain the
   wall-clock budget in the declared reference-runner benchmark lane.
2. RED/GREEN/REFACTOR compliant pass-through, malformed correction, one-loop
   protection, and hard/advisory precedence through the real Stop hook.
3. RED/GREEN/REFACTOR configured exact-once SessionStart delivery, additive
   standing context, and TDD/ordinary prompt behavior through real hook groups
   and subprocesses.
4. RED/GREEN/REFACTOR installed-tree change propagation and per-consumer parity,
   then regenerate plugin runtime and dogfood mirrors with `bun run parity:fix`.
5. Bind the feature lane, run targeted tests, then the full suite; perform the
   live Claude walkthrough or record the explicit runtime limitation.

This is five slices across the existing hook library, three hook entry points,
and parity/test infrastructure. It stays below the plan split threshold; no
child tickets are warranted.

Skill mapping: no language-specific TypeScript skill is installed in this
project. `safeword:testing` governs every automated proof; the project hooks
authoring guide governs the three hook entry points; `safeword:bdd` governs the
scenario-by-scenario R/G/R sequence.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Canonical contract ownership | One structured grammar object in `hooks/lib/quality.ts`, rendered and validated by exported functions | Separate prompt string and parser constants; copy the exact prose into each hook | Separate representations can drift and fail the maintainer JTBD. |
| Markdown recognition | Dependency-free forward block scanner over exact paragraph labels | Nested/large regex; full `markdown-it`/CommonMark AST dependency | Regex risks adversarial backtracking; installed hooks run in customer projects where repository-only dependencies are unavailable; the exact grammar does not require a full renderer. |
| Proactive delivery | Emit a separate under-cap value through `session-reply-format.ts`, retain independent standing context, and test both configured event groups | Append to the large standing-context value; put the full contract on every UserPromptSubmit | Claude replaces an individual value above 10,000 characters with a preview/path, so an appended tail is not guaranteed to arrive; per-prompt delivery adds high-frequency context noise. |
| Stop integration | Validate only where the existing phase review would emit, after hard gates, loop guard, and typecheck advice | Validate before hard gates; validate every Stop; remove Stop enforcement | Earlier placement can bypass stronger gates, every-Stop validation violates boundary cadence, and removing the fallback makes the proactive instruction the only control. |
| Runtime proof | Pure scanner tests plus real hook/setup/plugin subprocess tests; mock only the live/cloud process boundary | Fully mocked hook tests; live Claude for every parser case | Internal mocks miss install/import wiring; live runs are too slow and nondeterministic for dense parser partitions. |

Evidence: Claude documents SessionStart context before the first prompt and Stop
fields `last_assistant_message`/`stop_hook_active` in the
[hooks reference](https://code.claude.com/docs/en/hooks). CommonMark 0.31.2
distinguishes top-level paragraphs, container blocks, code, and HTML in the
[block specification](https://spec.commonmark.org/0.31.2/). OWASP documents
catastrophic backtracking risk for overlapping repeated regexes in
[ReDoS guidance](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS).

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Compliant work produces one plain-language completion, while TDD retains its lead-only quiet path and technical gate evidence remains available. | `features/generate-compliant-replies-without-rewrites.feature`; live walkthrough evidence in `verify.md` | |
| 1. Structure enforces; instructions suggest | SessionStart guidance is backed by deterministic Stop validation and real subprocess observation rather than trusted alone. | `steps/reply-format-contract.steps.ts`; `packages/cli/tests/hooks/reply-format-contract.test.ts` | |
| 2. Fire at boundaries, not every turn | The full contract is delivered at SessionStart boundaries; UserPromptSubmit stays compact and active TDD stays lead-only. | `steps/reply-format-contract.steps.ts` | |
| 3. Add, never replace | SessionStart appends the decision contract while preserving the complete existing SAFEWORD standing context. | Configured hook-group preservation assertions in `steps/reply-format-contract.steps.ts` | |
| 5. Clarity before correctness | One named vocabulary module drives both consumers, proven by a changed-contract wiring test; table-driven scanner tests keep every classification rule legible. | `steps/reply-format-contract.steps.ts`; `packages/cli/tests/hooks/reply-format-contract.test.ts` | |

Architecture decisions honored:

- `ARCHITECTURE.md` → **Reconciliation Engine**: templates remain canonical and
  setup/upgrade converge installed hook files without clobbering customer data.
- `ARCHITECTURE.md` → **Build & Distribution**: generated Claude plugin runtime
  is derived from templates and checked for parity.
- `ARCHITECTURE.md` → **Hard Block for Done Phase** and **Continuous Quality
  Gates**: hard evidence gates keep precedence; the changed behavior remains a
  soft, boundary-triggered quality review.
- `ARCHITECTURE.md` → **Hierarchy Navigation on Ticket Completion**: preserve
  the established zero-runtime-dependency rule for installed hooks.

No ADR is needed: this is a reversible extension of existing settled hook and
template architecture, not a new structural boundary or data ownership choice.

## Known deviations

skip: no design deviations. The local Claude executable initialized, but its
API rejected the configured and explicit model aliases before any edit; this
is recorded in `manual-acceptance.md` as an evidence limitation, not an
architecture deviation.

## Doc impact

skip: no command, configuration, or documented verdict semantics change. The
README already describes CONFIDENT/BLOCKED as the end-of-turn decision brief;
this work changes when Claude receives that existing contract and avoids a
redundant correction.

## Assessment triggers

- Claude changes SessionStart sources, Stop payload fields, or Markdown
  rendering semantics.
- A new verdict or nested decision-brief format makes the exact paragraph
  grammar materially more complex.
- Cursor or Codex adopts equivalent proactive/terminal enforcement under #1547.
- The scanner exceeds its fixed linear-work bound or 500 ms at four megabytes.
- Installed hooks gain a guaranteed Markdown parser dependency, reopening the
  AST-versus-scanner tradeoff.
