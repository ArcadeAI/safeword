# Spec: Prove review remedies with controlled execution

## Intent

Add execution evidence only where a named deterministic check can resolve a declared review unknown, and reserve verified-remedy language for the exact tested patch.

## Intake Brief

- **Requested by:** Alex, through the accepted phase split of #1909.
- **Cost of inaction:** The advisory core remains useful, but every model remedy must stay explicitly unverified.
- **Reversibility:** One-way-adjacent security boundary; customer code execution requires sandbox, command, and evidence contracts that are hard to retract after adoption.

## References

- Parent P0D6S2; prerequisite HXT3GW.
- Draft PR #1917 exposed false remedy verification and is evidence only.

## Personas

- **Technical Builder (TBU)** — needs verification claims backed by exact execution evidence.
- **Safeword Maintainer (SWM)** — needs execution to remain narrow, same-repository-only, and auditable.

## Surfaces

Affected:

- **Safeword CLI**
- **GitHub pull request conversation**
- **GitHub Actions execution sandbox**

## Vocabulary

- **Named evidence check:** One configured argv command authorized to resolve one declared unknown against one exact revision.
- **Verified remedy:** The exact displayed patch applied in a sandbox and passed by all named relevant checks.

## Jobs To Be Done

### advisory-execution.TBU1 — Trust only execution-backed verification claims

**Persona:** Technical Builder (TBU)

> When Safeword says a remedy was verified, I want the exact patch and check outcomes, so I can distinguish tested evidence from model confidence.

#### advisory-execution.TBU1.R1 — A verified-remedy claim identifies the exact patch and successful relevant commands

#### advisory-execution.TBU1.R2 — Mismatched, partial, failed, or errored execution remains unverified

### advisory-execution.SWM1 — Execute only the minimum named evidence path

**Persona:** Safeword Maintainer (SWM)

> When a review unknown can be resolved deterministically, I want only the named check to run in an eligible sandbox, so execution does not become general agent authority.

#### advisory-execution.SWM1.R1 — Eligibility alone never authorizes code execution

#### advisory-execution.SWM1.R2 — Every execution records its command, revision, outcome, and purpose

## Rave Moment

skip: inherited from parent epic #1908.

## Outcomes

- Verification language always traces to the exact patch and successful named commands.
- No fork code executes and same-repository execution remains purpose-bound.

## Open Questions

None.
