# Spec: Keep advisory reviews current without repeated noise

## Intent

Reduce repeated model work and repeated findings without weakening the exact-head trust contract delivered by HXT3GW.

## Intake Brief

- **Requested by:** Alex, through the accepted phase split of #1909.
- **Cost of inaction:** The MVP remains safe but re-reviews inert or immaterial updates and repeats findings in less useful locations.
- **Reversibility:** Two-way door; classification and finding identity are additive result metadata.

## References

- Parent P0D6S2; prerequisite HXT3GW.
- Draft PR #1917 is implementation evidence only.

## Personas

- **Technical Builder (TBU)** — needs current conclusions without repeated review noise.
- **Non-Technical Builder (NTB)** — needs consequential findings where the change occurred.

## Surfaces

Affected:

- **Safeword CLI**
- **GitHub pull request review**
- **GitHub pull request conversation**

## Vocabulary

- **Freshness bridge:** Evidence that a new head changes neither reviewed behavior nor support for the prior conclusion.
- **Inert exclusion:** A generated, vendored, binary-only, or otherwise non-behavioral artifact omitted only with recorded proof.

## Jobs To Be Done

### advisory-freshness.TBU1 — Avoid repeated work without trusting stale evidence

**Persona:** Technical Builder (TBU)

> When a PR changes again, I want Safeword to reuse only what it can prove remains valid and suppress unchanged findings, so the current receipt stays trustworthy and useful.

#### advisory-freshness.TBU1.R1 — Inert exclusions and no-review outcomes carry explicit evidence

#### advisory-freshness.TBU1.R2 — Only proven immaterial updates may reuse a prior conclusion

#### advisory-freshness.TBU1.R3 — Finding identity suppresses unchanged noise and removes resolved findings

### advisory-freshness.NTB1 — See consequential findings at the changed evidence

**Persona:** Non-Technical Builder (NTB)

> When a review finds a consequential problem, I want it anchored on the exact changed line, so I can connect the advice to the change.

#### advisory-freshness.NTB1.R1 — Inline findings bind to the exact reviewed SHA and diff location

## Rave Moment

skip: inherited from parent epic #1908.

## Outcomes

- Immaterial and all-inert changes avoid unnecessary model work only with auditable evidence.
- Current findings are inline, deduplicated, and visibly resolved when their evidence disappears.

## Open Questions

None.
