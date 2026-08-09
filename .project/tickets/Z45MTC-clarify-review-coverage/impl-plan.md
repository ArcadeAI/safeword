# Impl Plan: Make review coverage clear without false alarms

**Status:** implemented

## Approach

The riskiest assumption is that Safeword can make permitted same-agent review
feel normal without weakening an explicit independence requirement or rewriting
machine provenance. The cheapest proof is the closed surface map: Safeword CLI
rows execute the real `review run` command, while the five conversational-host
rows inspect generated instruction contracts only. That is paired immediately with
“Required independence remains blocked in the machine result.”

Build four outside-in slices. Each slice begins by binding its scenarios to a
real actor-facing boundary and proving RED before production changes:

1. Characterize the existing public result before production work: prove that
   a successful degraded result contains `assigned_reviewer` and
   `preferred_failure`, contains no recovery entry, and that blocked recovery
   plus quiet/JSON/help modes retain their documented behavior or typed schema. If that
   baseline differs, stop and revise the presentation design rather than
   manufacturing missing data. Then bind one executable public behavior: a permitted same-agent review
   through real `review run` must complete with the standard-coverage message
   and unchanged degraded machine provenance. Prove that RED with a fake
   reviewer subprocess, then drive the minimum dependency-free
   tuple-to-presentation mapping through that command. The mapping is a total,
   read-only presentation function over trusted internal results: inconsistent
   tuples project to incomplete and are never rejected at runtime. Keep the existing
   `independence` values, reviewer identity, automation finding codes, exit
   states, and `require` behavior unchanged. Primary proof:
   `packages/cli/tests/cli-protocol/review-wiring.test.ts` plus a focused unit
   matrix for representative raw-provenance/completion/policy branches.
2. Bind the requested-details and ordinary-summary scenarios before changing
   advice rendering. Prove default output is noisy and details are not yet
   selective, then move install/sign-in/retry guidance behind the actor-facing
   details action: `review run --verbose` for the CLI and the exact foreground
   prompt `Show review coverage details.` in conversational-host instruction
   contracts. Canonical host skills publish that phrase as a discoverability
   example; no parser grammar or live classification is claimed. Manifest and
   generated-surface parity prove the wording reaches every distributed asset.
   `not_installed` offers install/update,
   `not_authenticated` offers sign-in, and another retryable preferred failure
   offers retry. A completed review in a no-route environment describes its
   achieved coverage without advertising an impossible optional upgrade.
   Primary proof: public-command integration for default versus `--verbose`,
   including exact absence of legacy degraded-warning strings.
3. Bind the three host-fallback distribution scenarios to the existing canonical
   `finish-review` instructions before editing them. Change only prescribed
   prose: model-mediated self-review is calm supplemental feedback, never a
   completed standard review or machine provenance; `require` remains
   unsatisfied. Preserve the existing continuation admission, retry bounds,
   result shape, the named acceptance recovery value, and routing semantics. Update canonical
   only the manifest-listed `quality-review` and `finish-review` templates, then
   regenerate Codex, Claude, Cursor, and dogfood surfaces. Static identity and
   parity tests prove distribution only; no scenario treats them as live host
   execution.
4. Complete the remaining thin Cucumber bindings, one scenario per RED/GREEN/
   REFACTOR ledger loop. Update configuration and hooks-and-skills reference
   docs, run focused Vitest and Cucumber after each slice, then run release
   parity and full verification. The feature-level `@wip` is already absent so
   each slice runs its focused scenario tags while later steps are still
   undefined; after all bindings exist, all nineteen scenario definitions and
   their 127 expanded cases execute together in the default Cucumber lane as the final
   feature gate.

Shared presentation-mapping scenarios use `@contract.shared` and make no adapter-
wiring claim. CLI-only machine assertions remain tagged only for Safeword CLI;
host scenarios assert only the text prescribed by distributed assets. The two
require-policy scenarios share preconditions but use separate assertions for
human presentation and structured policy status. A real CLI scenario proves
the default permitted-policy path completes with standard coverage while its
completed envelope correctly omits `review_policy`.

Finite provenance, verdict, details, and failure domains are explicitly
enumerated in Cucumber example tables and focused unit-test tables. Exact
counts and set-equality assertions guard accidental omission; actual wiring
evidence remains the executable CLI integration and generated-asset
identity/parity checks.

The feature deliberately separates executable CLI behavior from static host
contract distribution. No host row feeds runtime tuples through prose or claims
renderer equivalence. The parity harness proves only that each shipped host
asset contains the canonical prescribed wording and is correctly registered.

No new command or external boundary is introduced. `--verbose` is an existing
global CLI option (`execute.ts` already parses and forwards it; `result.ts`
already gates implementation detail on it). This ticket compatibly extends its
review-result detail while preserving parsing, help text, quiet/JSON behavior,
and every non-review command. The existing public-command integration is the
wiring proof: real config → public handler → coordinator → subprocess boundary
→ parser → renderer; focused tests cover global-option placement before and
after `review run`, help output, and unchanged default/quiet/JSON rendering.

The authoritative presentation mapping is:

| Trusted result | Policy/outcome | Human coverage |
| --- | --- | --- |
| `independence: cross-agent` with validated reviewer output | completed | independent coverage |
| `independence: degraded` with validated same-agent output | `prefer`, completed | standard coverage |
| `independence: degraded` with validated same-agent output | `require` | achieved feedback is standard coverage and required independence is unsatisfied; standard coverage is never presented as satisfying the requirement |
| `independence: none` | blocked, failed, not requested, or no validated CLI reviewer output | incomplete/not run; never standard coverage |
| original CLI envelope with `independence: none` | host continuation not yet validated | incomplete/not run |
| host instructions after typed CLI exhaustion | `prefer` | prescribe calm supplemental feedback, never completed standard coverage or machine provenance |
| host instructions after typed CLI exhaustion | `require` | prescribe supplemental feedback plus an unsatisfied requirement and existing capable-environment recovery |

Verdict and coverage are independent axes. A table-driven contract test covers
every valid terminal tuple:

| Independence | Result policy field | Reviewer verdict | Top-level state / status | Human result |
| --- | --- | --- | --- | --- |
| `cross-agent` | absent on completed result | `approve` | `healthy` / `approved` | independent coverage |
| `cross-agent` | absent on completed result | `request_changes` | `action_required` / `changes_requested` | independent coverage with requested changes |
| `degraded` | absent on completed result | `approve` | `healthy` / `approved` | standard coverage |
| `degraded` | absent on completed result | `request_changes` | `action_required` / `changes_requested` | standard coverage with requested changes |
| `degraded` | `require` | either | `action_required` / `blocked` | achieved standard coverage; independence requirement unsatisfied; preserve the reviewer verdict/findings |
| `none` | any | no valid verdict | `action_required` / `blocked` | incomplete |

The machine scenarios inspect only existing fields: top-level `state`, plus
`data.status`, `data.independence`, and conditional fields already emitted by
the coordinator. Every blocked result includes the resolved
`data.review_policy`, exactly `prefer` or `require`; approved and
changes-requested completed results omit `data.review_policy`. Completed results include
`data.actual_reviewer`; exhausted results omit it and retain
`REVIEW_ROUTES_EXHAUSTED`. “Standard coverage” maps to existing
`independence: degraded`; no public `coverage` field is added.
`review_policy` records the policy that produced a blocked state, not
provenance: renderers and tests never infer `prefer` merely because that field
is absent. The terminal matrix explicitly exercises blocked `prefer` and
blocked `require` results.

The NTB completion wording and SWM policy outcome are projections of the same
authoritative mapping, not separately authored strings. A table-driven test
feeds each trusted result tuple through both projections so a wording change
cannot make standard coverage appear to satisfy a required policy.

The host result is the existing second-stage `finish-review` instruction contract, not a
reinterpretation of the CLI envelope and not a persisted/public CLI coverage
field. Automation reading `review run --json` still sees the original
`independence: none`; the foreground host may report human-only continuation
feedback under the distributed instruction contract. That host continuation
is deliberately a human foreground result, not a second machine-readable CLI
record; under `require`, the original CLI exhaustion remains blocked and the
host report cannot replace or satisfy it.

Host identity is deliberately not promoted to provenance because these hosts
offer no trustworthy runtime identity signal at this boundary. The prescribed
host JSON shape has no identity field. Any human disclosure names only the
foreground session or fresh context; it does not populate `actual_reviewer`,
write a stamp, or replace the original exhausted machine result. The static
contract requires the exact identity-free shape without claiming a runtime
parser or proof of which model executed a live interaction.

Upgrade-action inputs are explicit:

| Surface evidence | Details action |
| --- | --- |
| preferred failure `not_installed` | install/update the named reviewer |
| preferred failure `not_authenticated` | sign in to the named reviewer |
| another retryable preferred failure | retry the independent review |
| unsupported author or no completed review | no standard completion; retain incomplete recovery |
| host instruction where the host exposes no external reviewer route | prescribe supplemental feedback only and leave machine completion blocked |
| explicit `require` policy where the active host exposes no external reviewer route | name a capable environment and give the exact accepted review command to rerun there; never imply the current host can satisfy the policy |

For a successful typed standard result, requested details read only its existing
trusted `assigned_reviewer` and `preferred_failure`: `not_authenticated` → sign
in; `not_installed` → install/update; another recognized retryable runtime
failure → retry. The renderer emits one fixed human suggestion description and
no command. Missing/unrecognized/no-route data emits no optional upgrade.
Blocked results keep their existing structured recovery entry and exact command
unchanged. This mapping is table-tested without adding data fields.

Recovery command parsing, shell variants, target validation, and serialization
remain out of scope. Existing recovery branches stay unchanged. The explicit
`require`/unsupported-author branch now uses the coordinator's existing
`retryCommand` builder because its host contract otherwise demanded a recovery
command that did not exist. Focused real-CLI tests pin that accepted value and
prove `prefer` remains empty.

Conversational hosts have no deterministic prompt dispatcher: skill activation
is intentionally model-mediated. The exact phrase `Show review coverage
details.` is therefore a documented host instruction-contract request, not a
claim of a new hard parser. Static contract tests assert only that canonical
assets publish this discoverability phrase and the ordinary/supplemental
wording rules; generated-surface identity/parity distributes those exact
instructions. No host row asserts that
a live model followed them. The CLI
`--verbose` branch remains the real deterministic actor-facing wiring proof.
The static details-response contract nevertheless requires shipped instructions
to tell the host to report achieved coverage and existing typed provenance,
derive any optional suggestion only from typed coordinator fields, preserve an
unsatisfied require/blocked state, and invent neither provenance nor recovery.
Tests prove only that every canonical/generated asset prescribes these rules;
they do not claim a live model obeyed them.
If a future host exposes a blockable prompt-dispatch hook, that is an assessment
trigger for replacing this soft contract with executable dispatch.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Vocabulary boundary | Derive human “standard / independent / incomplete” presentation from existing result state, policy, and provenance | Rename `independence: degraded`; add a second persisted `coverage` enum | Renaming breaks machine consumers and historical evidence; a second field creates two sources of truth (`ARCHITECTURE.md`, Host-owned cross-agent coordinator). |
| Warning threshold | Warn only for incomplete review or an explicitly unmet `require` policy; ordinary permitted completion is informational | Keep a warning but soften its wording; suppress all independence information | Soft warnings preserve the false-alarm experience; suppressing provenance hides useful assurance (`PRINCIPLES.md`, Optimize for the NTB without constraining the TBU). |
| Upgrade guidance | Show one actionable independent-coverage improvement only in requested details/verbose output and only when actionable | Repeat setup advice after every standard completion; never offer an upgrade | Repetition violates the boundary/noise principle; total omission makes the stronger option undiscoverable (`PRINCIPLES.md`, Fire at boundaries, not every turn). |
| Host parity | Change canonical wording, then regenerate/dogfood through existing identity/parity machinery | Hand-edit each host copy; claim live execution | Hand edits drift; the repository can prove distribution but not model-mediated execution. |

This is one reversible presentation PR. It does not add or formalize a host
envelope parser, continuation admission rule, retry bound, recovery object,
target grammar, shell renderer, identity source, route, subprocess, network
boundary, or prompt dispatcher. Those hardening ideas are captured in a
separate follow-up ticket and are not prerequisites now because host self-review
is labeled supplemental rather than trusted completion. Reverting this PR
restores prior prose/details placement plus the single unsupported-author
recovery entry while leaving routing and host continuation behavior unchanged; compatibility
snapshots prove that boundary.
Canonical sources, packaged artifacts, inventory digests, and dogfood copies
are regenerated together in the release commit. Existing generator, packaging,
release-contract, setup, and parity tests verify the actual produced package and
installed copies in addition to the 12-edge vocabulary manifest. Older installed assets retain the old
wording until setup/upgrade, which is compatible because machine fields and
routing do not change. A rollback release restores all manifest-listed prose
artifacts together; identity tests reject mixed old/new copies.

Premortem: this design fails if a newly added host writes its own completion
prose; mitigate with canonical-template identity/parity assertions and the
cross-surface distribution lane, without claiming live host execution. Whether
a model follows the changed host prose is explicitly unproven and excluded from
the ticket outcome; only prescribed text and distribution are accepted here.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Calm plain-language completion by default; verbose/JSON evidence and explicit `require` with a concrete next action remain available | `packages/cli/features/clarify-review-coverage.feature` | |
| 2. Fire at boundaries, not every turn | Upgrade advice appears only in requested details, never every successful completion | `packages/cli/tests/cli-protocol/review-wiring.test.ts` | |
| 5. Clarity before correctness | One coverage mapping owns human terms; structured provenance remains the enforcement source | `packages/cli/src/cli-protocol/review-presentation.ts` | |

Architecture decisions honored:

- **Host-owned cross-agent adversarial review coordinator:** routing, bounded
  fallback, policy, and provenance remain owned by the existing coordinator.
- **Schema as single source of truth / generated agent parity:** canonical
  templates are edited first; generated and dogfood surfaces are reconciled.

## Known deviations

The planned ticket diff updates the previous principle text, which required
every same-agent fallback to be labeled a
“degraded review” in human output. This feature intentionally supersedes that
presentation rule: `PRINCIPLES.md` is updated to require exact non-independent
provenance and live-source limits without treating permitted completion as a
service degradation. The machine-readable `independence: degraded` value stays
for backward compatibility. If the vocabulary performs poorly in user review,
revert the principle wording and presentation mapping together; do not leave
the principle and product copy disagreeing.

## Doc impact

- Update `packages/website/src/content/docs/reference/configuration.mdx` to
  explain `prefer` as standard best-available coverage and `require` as the only
  warning boundary.
- Update
  `packages/website/src/content/docs/reference/hooks-and-skills.mdx` to separate
  human coverage vocabulary from raw `cross-agent | degraded | none`
  provenance.
- README has no review-coverage wording to change.
- Include the already-authored ticket change to `PRINCIPLES.md`, replacing the
  old mandatory degraded-review label with standard best-available presentation
  plus exact provenance.

## Assessment triggers

- A new reviewer route or host surface cannot map cleanly to independent,
  standard, or incomplete coverage.
- Consumers request a first-class public coverage field distinct from raw
  independence provenance.
- Review results become persisted and justify a dedicated `status` command;
  persisted status is explicitly outside this ticket, whose requested-details
  path is `review run --verbose` or the foreground host's detail response.
- A host cannot consume canonical templates or generated parity tests.
- A host exposes a deterministic prompt-dispatch hook suitable for replacing
  the current model-mediated details-request contract.
