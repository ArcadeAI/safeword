# Spec: ADR consultation step + ADR-creation prompt

## Intent

Make architectural awareness a working part of impl-plan authoring: before TDD starts, the agent reads the project's recorded architecture decisions (file or directory, wherever `paths.architecture` points) and populates the impl plan's Arch alignment section from them — and when no decisions are recorded yet, prompts the user to consider drafting the first ADR instead of silently writing "N/A". Absorbed from arcade's `/implement-spec` step 2 (epic M6D315).

## References

- Epic [M6D315](../M6D315/ticket.md) — replan 2026-06-10 (paths.architecture file-or-dir, no adrLocation field)
- [XDNSZA](../XDNSZA/ticket.md) — the impl-plan artifact whose Arch alignment section this populates
- K7N2QM — configurable `paths.*` machinery this extends
- YR6C49 strictness ruling — structural-only validation, no prose extraction

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- **Architecture record** — the file at `paths.architecture` (default `.safeword-project/architecture.md`), or, when that path is a directory, each `.md` file in it except README.md (an ADR).

## Jobs To Be Done

### adr-consultation.DEV1 — Implementations honor recorded decisions

**Persona:** Technical Builder (TB)

> When my agent plans an implementation, I want it to read the architecture decisions my project has already recorded and name the relevant ones in the impl plan, so I can trust new code follows the decisions instead of silently drifting.

#### adr-consultation.DEV1.AC1 — The consultation step reads records from the configured location, whether it is a single file or a directory of ADRs

#### adr-consultation.DEV1.AC2 — When no decisions are recorded, the agent surfaces the first-ADR prompt instead of leaving the section blank

### adr-consultation.SM1 — Catch stale architecture claims structurally

**Persona:** Safeword Maintainer (SM)

> When an impl plan claims alignment with architecture records, I want `safeword check` to flag the claim when no records exist at the configured location, so I can catch fabricated or stale alignment sections without parsing prose.

#### adr-consultation.SM1.AC1 — `safeword check` surfaces a question when Arch alignment carries content but the architecture location is absent, and stays quiet on skip-annotated sections or present locations

## Outcomes

- Impl plans name the decisions they honor; arcade points `paths.architecture` at `docs/docs/arch` and its ADR directory is consumed verbatim.
- Projects without ADRs get nudged toward their first one at the moment it matters (plan-authoring), not retroactively.

## Open Questions

defer: per-reference existence validation waits on MBGQ89's reference schema; reconciliation of claims at implement-exit is ERVA6V.
