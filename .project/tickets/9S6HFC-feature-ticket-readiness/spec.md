# Spec: Validate feature ticket readiness before define-behavior

## Intent

Legacy feature tickets can already be `in_progress` at `define-behavior` while
missing required intake artifacts. Safeword currently catches those gaps only
when an agent tries to create `test-definitions.md`, so the interruption lands
mid-formulation instead of before scenario work starts.

This feature moves that signal to the entry point. New phase advances into
`define-behavior` are blocked when readiness is missing, and existing
`define-behavior` tickets get an upfront resume message listing the missing
artifacts and the next remediation step.

## References

- GitHub issue #404: legacy `in_progress` feature tickets can start
  define-behavior without `ticket.md` scope fields, `spec.md`, or
  `dimensions.md`.
- `/figure-it-out` decision, 2026-06-24: use one shared readiness validator
  from both the pre-tool phase-entry gate and the prompt hook. Rejected
  prompt-only because it would not prevent new bad state; rejected broad edit
  blocking because it would overreach while a ticket is being repaired.
- Existing late gate: `.safeword/hooks/pre-tool-quality.ts` already blocks
  `test-definitions.md` creation when frontmatter, `spec.md`, JTBD/ACs, or
  `dimensions.md` are missing.

## Personas

- **Technical Builder (TB)** - uses Safeword to run feature work and needs
  missing intake artifacts surfaced before scenario writing starts.
- **Safeword Maintainer (SM)** - owns hook behavior and wants one readiness
  rule shared across entry and resume paths.

## Vocabulary

- **Readiness artifacts** - the intake artifacts required before
  define-behavior: `scope`, `out_of_scope`, `done_when`, valid feature
  `spec.md` JTBD/AC framing, and `dimensions.md` or `skip: <reason>`.
- **Entry check** - the pre-tool validation that runs when a ticket edit would
  change the phase into `define-behavior`.
- **Resume check** - the prompt hook signal for an active legacy feature ticket
  that is already in `define-behavior`.

## Jobs To Be Done

### feature-ticket-readiness.TB1 - Avoid mid-formulation readiness blocks

**Persona:** Technical Builder (TB)

> When I resume or advance a feature ticket into define-behavior, I want missing
> intake artifacts listed before scenario work starts, so I can fix readiness
> once instead of being blocked while writing test definitions.

#### feature-ticket-readiness.TB1.R1 - New feature tickets missing readiness cannot enter define-behavior

#### feature-ticket-readiness.TB1.R2 - Legacy define-behavior tickets surface a clear remediation message on resume

#### feature-ticket-readiness.TB1.R3 - Ready feature tickets keep the normal define-behavior flow

### feature-ticket-readiness.SM1 - Keep readiness validation centralized

**Persona:** Safeword Maintainer (SM)

> When I maintain the ticket gates, I want one helper to describe feature
> readiness, so phase-entry and resume messaging cannot drift from each other
> or from the existing artifact prerequisites.

#### feature-ticket-readiness.SM1.R1 - One shared helper evaluates ticket frontmatter, spec, and dimensions readiness

#### feature-ticket-readiness.SM1.R2 - Tasks and patches are not newly gated by feature readiness rules

## Outcomes

- Editing a feature ticket from `intake` to `define-behavior` fails before the
  write when required readiness artifacts are missing.
- A legacy active feature ticket already in `define-behavior` receives a prompt
  hook message naming missing readiness items and remediation steps before the
  normal scenario-writing reminder.
- A fully ready feature ticket is not blocked or warned.
- Task and patch tickets are unaffected by the feature readiness gate.

## Open Questions

(none - issue #404 defines the required artifacts and the implementation
decision converged via `/figure-it-out`)
