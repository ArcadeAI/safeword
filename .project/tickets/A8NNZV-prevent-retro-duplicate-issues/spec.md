# Spec: Prevent repeated retro findings from opening duplicate issues

## Intent

Keep a recurring retro finding attached to its canonical GitHub issue when
model-assigned wording and classification drift between sessions. This makes
the backlog accumulate evidence instead of near-duplicate issues.

## Intake Brief

- **Requested by:** Safeword Maintainer via GitHub issue #1032.
- **Cost of inaction:** A recurring root problem can open another public issue,
  splitting evidence and creating backlog noise that a maintainer must merge by hand.
- **Reversibility:** Two-way door. New hidden markers affect newly filed issues;
  legacy markers and exact signature lookup remain intact.

## References

- GitHub issue #1032 — this feature's scope and acceptance criteria.
- GitHub issue #631 — observed false misses caused by model-derived signature inputs.
- GitHub issues #1030, #1031, #1034, #1035 — parent and deliberately separate slices.
- [GitHub issue search documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests?apiVersion=2022-11-28&tool=cli) — body search supports candidate retrieval; code must retain an exact marker filter.

## Personas

Safeword Maintainer (SM)

## Surfaces

Affected:

- CLI retro filing — this issue changes its deterministic triage path.

Unaffected:

- Spool/agent filer — #1031 owns its marker transport and filing behavior.
- Related-issue search — #1034 owns fuzzy candidate discovery and visible links.

## Vocabulary

- **Canonical marker:** An HTML comment containing a deterministic hash of
  normalized repro evidence, used only for exact recurrence lookup.

## Jobs To Be Done

### prevent-retro-duplicate-issues.SM1 — Preserve one evidence trail per root problem

**Persona:** Safeword Maintainer (SM)

> When a retro run finds the same Safeword problem with different model wording,
> I want it recorded on the established issue, so I can prioritize from one
> complete evidence trail rather than reconcile duplicates.

#### prevent-retro-duplicate-issues.SM1.R1 — A canonical repro identity remains stable when title, category, and surface classifications drift

#### prevent-retro-duplicate-issues.SM1.R2 — Exact lookup prefers legacy signature compatibility before canonical identity and never treats a fuzzy candidate as a duplicate

#### prevent-retro-duplicate-issues.SM1.R3 — A canonical match records the recurrence through the existing occurrence ledger

## Rave Moment

skip: internal backlog-maintenance behavior; no user-facing peak interaction.

## Outcomes

- A CLI recurrence with altered title/category/surface and the same normalized
  repro matches the existing canonical issue and bumps its ledger.
- An old issue carrying only the legacy signature remains dedupable.
- A non-exact canonical candidate remains a new issue.

## Open Questions

defer: Canonicalizing semantic rewordings of the repro itself would need fuzzy
matching and belongs to #1034; this slice deliberately requires exact normalized repro equality.
