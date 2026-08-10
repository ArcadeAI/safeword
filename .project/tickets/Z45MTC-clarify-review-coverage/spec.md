# Spec: Make review coverage clear without false alarms

## Intent

Make the result of Safeword's best available review easy to trust in every
supported environment. A completed review is standard coverage; an independent
review is a stronger, optional capability. Only an explicitly requested
independence requirement turns the absence of independent coverage into an
unsatisfied assurance promise.

## Intake Brief

- **Requested by:** Safeword Maintainer (SWM), on behalf of builders using a
  single available agent or a cloud-sandboxed agent runtime.
- **Cost of inaction:** completed reviews keep sounding like service failures
  in normal, constrained environments. Builders either distrust useful results
  or learn to ignore warnings, which weakens the meaning of the one warning
  that must remain: an explicitly required assurance level was not met.
- **Reversibility:** two-way door for rendered language and guidance, but
  cross-surface. Structured provenance and explicit-policy semantics must stay
  stable so integrations and review records remain honest.

## References

- `ZRV8D5-review-with-the-best-available-agent` — delivered best-available
  routing and currently calls permitted same-agent coverage “degraded.”
- #2003 and #2243 — introduced and repaired the shared review coordinator's
  handoff/fallback path.

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- Claude Code on the Web
- OpenAI Codex
- OpenAI Codex Cloud
- Cursor
- Cursor Cloud Agents
- Safeword CLI

Unaffected:

- GitHub Pull Request Conversation — advisory receipt wording is not part of
  the interactive review-completion experience.

## Vocabulary

- **Standard coverage:** a completed best-available review. It is the normal
  baseline, including a permitted typed same-agent CLI fallback with validated
  reviewer output and provenance.
- **Supplemental host feedback:** model-mediated self-review guidance produced
  after typed routes are exhausted. It is useful and calm, but is not called a
  completed standard review and never changes the blocked machine result.
- **Independent coverage:** review performed by a separate agent; a positive
  upgrade to standard coverage, not a prerequisite for it.
- **Required independence:** an explicit policy that makes independent
  coverage mandatory. Its absence remains an unsatisfied requirement, not a
  quiet advisory.
- **Provenance:** machine-readable evidence of who reviewed and what
  independence level was actually achieved. Presentation vocabulary must not
  erase it.
- **Reviewer identity projection:** human coverage is derived read-only from
  the coordinator's existing typed provenance. A consistent same-agent
  `degraded` result is standard, a consistent supported cross-agent result is
  independent, and `none` or an inconsistent tuple is incomplete. This ticket
  does not add a runtime validator, reject previously accepted results, alter
  stamping, or change the typed envelope.
- **Supported reviewer identities:** foreground authors are `claude`, `codex`,
  or `cursor`. A same-agent result may use the matching identity. Independent
  coverage may use only the external CLI reviewer identities `claude` or
  `codex`, different from the foreground author; Cursor is a supported author
  but not an external CLI reviewer route.
- **Reviewer outcome vocabulary:** raw host/CLI envelopes use verdict
  `approve | request_changes`; public normalized status uses
  `approved | changes_requested` (or `blocked` when policy enforcement
  supersedes completion). Scenarios name the raw verdict or normalized status
  explicitly and never treat them as one field.
- **Optional upgrade suggestion:** successful typed standard coverage already
  retains trusted `assigned_reviewer` and `preferred_failure` but has no
  recovery entry. Requested human details derive exactly one fixed suggestion
  description from those fields; they do not fabricate a command or change the
  typed result. Blocked results keep their existing structured recovery entry
  and command unchanged.
  A completed review with `status: changes_requested` does not show the
  optional coverage upgrade; requested fixes remain the only action.

  The fixed human-only mapper is:

  | `preferred_failure` | Suggestion for reviewer `R` |
  | --- | --- |
  | `not_installed` | `To add independent coverage, install or update R, then retry review.` |
  | `not_authenticated` | `To add independent coverage, sign in to R, then retry review.` |
  | `timed_out`, `process_failed`, `invalid_output`, `source_changed` | `To add independent coverage, retry R review.` |

  `R` is title-cased `Claude` or `Codex`. No other identity or failure value
  produces guidance.
- **Compatibility boundary:** the new first coverage line and optional
  suggestion are asserted as literal text while existing reviewer summaries
  and findings remain visible after them. Quiet remains empty, help retains its
  documented options, and JSON retains the same typed schema and field values.
  Existing blocked recovery construction stays unchanged. The one previously
  empty explicit-`require`/unsupported-author branch now receives the same
  accepted retry-command grammar so the host can name a capable-environment
  action without inventing recovery.
- **Explicit review-details action:** either supported global-option placement,
  `safeword --verbose review run …` or `safeword review run --verbose …`, on
  the Safeword CLI, or the exact foreground prompt
  `Show review coverage details.` on Claude
  Code, Claude web/cloud, Codex, Codex Cloud, Cursor, and Cursor Cloud Agents.
  CLI selection is executable behavior. Conversational hosts publish that one
  phrase as a discoverability example in model-mediated instructions; no
  case/whitespace/near-miss grammar or live classification behavior is claimed.
  Quiet and JSON modes take precedence over verbose human detail: a successful
  quiet review emits no human output, while action-required behavior keeps the
  existing CLI contract. JSON emits the unchanged typed envelope and never
  mixes human detail prose into stdout or stderr.
- **Machine policy-field invariant:** `data.review_policy` is present on a
  coordinator result whose `status` is `blocked`, including exhausted `prefer`
  and `require` routes, and absent from `approved` and `changes_requested`
  results. Absence must never be interpreted as evidence that policy was
  `prefer`.

The exact distribution manifest for the two changed host contracts is:

- Canonical sources:
  `packages/cli/templates/skills/finish-review/SKILL.md`,
  `packages/cli/templates/commands/finish-review.md`,
  `packages/cli/templates/cursor/rules/safeword-finish-review.mdc`,
  `packages/cli/templates/skills/quality-review/SKILL.md`,
  `packages/cli/templates/commands/quality-review.md`, and
  `packages/cli/templates/cursor/rules/safeword-quality-reviewing.mdc`.
- Packaged destinations:
  `plugin/skills/{finish-review,quality-review}/SKILL.md` and
  `packages/cli/codex-plugin/skills/{finish-review,quality-review}/SKILL.md`.
- Dogfood/install destinations:
  `.safeword/skills/{finish-review,quality-review}/SKILL.md`,
  `.claude/skills/{finish-review,quality-review}/SKILL.md`,
  `.cursor/commands/{finish-review,quality-review}.md`, and
  `.cursor/rules/{safeword-finish-review,safeword-quality-reviewing}.mdc`.
- Consumer registrations: `packages/cli/src/schema.ts`, `plugin/inventory.json`,
  `plugin/.claude-plugin/plugin.json`, and
  `packages/cli/codex-plugin/.codex-plugin/plugin.json`.

Existing generator, inventory, schema, release-contract, and dogfood-parity
gates reject missing, extra, stale, or disconnected packaged assets. This
ticket's focused acceptance check verifies the current edges through those
production generators and registrations rather than duplicating their mutation
harness. Claude Code/cloud/web share the Claude package; Codex/cloud share the
Codex package; Cursor/cloud agents share the Cursor installation artifacts.

The exact source → destination → registration graph has 12 edges:

| Canonical source | Destination | Registration |
| --- | --- | --- |
| `templates/skills/finish-review/SKILL.md` | `plugin/skills/finish-review/SKILL.md` | `plugin/inventory.json` + Claude plugin manifest |
| `templates/skills/quality-review/SKILL.md` | `plugin/skills/quality-review/SKILL.md` | `plugin/inventory.json` + Claude plugin manifest |
| `templates/skills/finish-review/SKILL.md` | `codex-plugin/skills/finish-review/SKILL.md` | Codex plugin manifest |
| `templates/skills/quality-review/SKILL.md` | `codex-plugin/skills/quality-review/SKILL.md` | Codex plugin manifest |
| `templates/skills/finish-review/SKILL.md` | `.safeword/skills/finish-review/SKILL.md` | `schema.ts` |
| `templates/skills/quality-review/SKILL.md` | `.safeword/skills/quality-review/SKILL.md` | `schema.ts` |
| `templates/skills/finish-review/SKILL.md` | `.claude/skills/finish-review/SKILL.md` | `schema.ts` |
| `templates/skills/quality-review/SKILL.md` | `.claude/skills/quality-review/SKILL.md` | `schema.ts` |
| `templates/commands/finish-review.md` | `.cursor/commands/finish-review.md` | `schema.ts` |
| `templates/commands/quality-review.md` | `.cursor/commands/quality-review.md` | `schema.ts` |
| `templates/cursor/rules/safeword-finish-review.mdc` | `.cursor/rules/safeword-finish-review.mdc` | `schema.ts` |
| `templates/cursor/rules/safeword-quality-reviewing.mdc` | `.cursor/rules/safeword-quality-reviewing.mdc` | `schema.ts` |

Paths in this table are relative to `packages/cli/` for template and Codex
plugin entries, and repository-relative for dogfood entries.

## Executable Fixture Predicates

Scenario setup phrases are assertions over trusted coordinator inputs and
validated outputs, not subjective labels:

- **Completed standard coverage:** a parsed raw `approve` or `request_changes`
  reviewer envelope with foreground author `claude | codex | cursor`, the same
  recognized `actual_reviewer`, and `independence: degraded`.
- **Completed independent coverage:** the same validated reviewer envelope with
  `independence: cross-agent` and `actual_reviewer: claude | codex` different
  from the recognized foreground author.
- **Incomplete review:** bounded routes end without a valid reviewer envelope;
  the coordinator returns `status: blocked`, `independence: none`, and the
  `REVIEW_ROUTES_EXHAUSTED` finding without `actual_reviewer`.
- **Active policy permits best-available coverage:** resolved review policy is
  `prefer`. **Explicitly requires independent coverage:** it is `require`.
- **Independent review could be configured:** trusted `preferred_failure` is
  `not_installed`, `not_authenticated`, or another retryable route failure.
  **Cannot be configured in the active environment:** there is no external
  reviewer route exposed by that host.
- **Host self-review fallback:** after typed CLI routes are exhausted, generated
  host instructions may guide the foreground model to provide supplemental
  feedback. This ticket changes only that wording. It does not add a host
  envelope parser, admission rule, retry bound, recovery renderer, machine
  completion, reviewer identity, or stamp.

Every recognized failure for an exposed reviewer route is recoverable:
`not_installed` maps to install/update, `not_authenticated` maps to sign-in,
and `timed_out`, `process_failed`, `invalid_output`, and `source_changed` map to
retry. The only non-offerable state is an active host with no external reviewer
route; under `require`, recovery moves to the fixed capable-environment action.

CLI presentation tests cover standard coverage with each recognized preferred
failure, malformed or untrusted failure values, independent coverage, and
incomplete `REVIEW_ROUTES_EXHAUSTED` coverage. Conversational-host tests do not
run tuples through prose or claim runtime equivalence; they assert only the
canonical instruction text and its generated distribution.

## Jobs To Be Done

### clarify-review-coverage.NTB1 — Understand a completed review without an alarm

**Persona:** Non-Technical Builder (NTB)

> When a review completes in my single-agent or cloud-sandboxed setup, I want
> it described as standard coverage, so I can rely on the result without being
> told that my available setup is a degraded failure.

#### clarify-review-coverage.NTB1.R1 — A completed best-available review is presented as normal coverage unless an explicit policy was not met

### clarify-review-coverage.TBU1 — Improve review coverage only when it helps

**Persona:** Technical Builder (TBU)

> When independent review would strengthen a completed review, I want concise
> actionable guidance in requested details rather than a recurring warning, so
> I can improve assurance without interrupting my work.

#### clarify-review-coverage.TBU1.R1 — Independent coverage is presented as an optional, actionable upgrade to standard coverage

### clarify-review-coverage.SWM1 — Keep an explicit assurance promise honest

**Persona:** Safeword Maintainer (SWM)

> When a workflow explicitly requires independent review, I want
> non-independent evidence to remain unsatisfied and clearly labeled, so the
> assurance contract stays truthful.

#### clarify-review-coverage.SWM1.R1 — An explicit independence requirement remains visible and unsatisfied until independent coverage is achieved

#### clarify-review-coverage.SWM1.R2 — Machine-readable review provenance retains the actual achieved coverage level and reviewer identity

## Rave Moment

### clarify-review-coverage — A review result I can trust at a glance

- **Moment:** A builder sees “Review complete — standard coverage” and carries
  on; details offer an independent-review upgrade only when they choose to look.
- **Beats:** a scary “degraded” warning after every successful review in a
  normal one-agent setup.
- **They'd say:** "It tells me what I got, not what I should feel guilty about."

## Outcomes

- Builders in single-agent and cloud-sandboxed environments see completed
  review as standard coverage, not a degradation warning.
- Builders can discover the available independent-review upgrade and its next
  action through deliberately requested details.
- Existing explicit `require` policy behavior still reports missing
  independence as unsatisfied, with raw provenance retained for automation.

## Open Questions

None. The behavior change is presentation and coverage policy; reviewer
routing, persisted provenance, and explicit `require` enforcement are retained.
