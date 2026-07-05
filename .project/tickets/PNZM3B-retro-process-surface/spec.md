# Spec: Retro accepts process-level friction surfaces and reports egress drops

## Intent

Retro's egress guard fails closed on any finding whose `safeword_surface` isn't a real safeword file path, and drops it with zero signal. Whole categories of real friction — process/workflow problems with no single-file home — never reach the tracker, and the extraction prompt's "a real safeword path" demand pushes the extractor to fabricate file surfaces instead. Give findings an honest, egress-safe way to name a process-level surface, and make every egress drop visible in the run summary.

## Intake Brief

- **Requested by:** the retro pipeline itself (auto-filed upstream issue #587, confirmed by a live smoke-eval); triaged by the maintainer (alex@arcade.dev).
- **Cost of inaction:** process-level friction (e.g. "TDD loop doesn't catch tsc errors", "verify-suite timeout") stays invisible to maintainers; extractors fabricate representative file paths, corrupting dedup signatures and surface attribution; degraded recall is indistinguishable from a clean session because drops are silent.
- **Reversibility:** two-way door. The virtual namespace is additive to the allowlist and slug-constrained (no new leak shape); the prompt/schema wording and summary line are trivially revertible. Already-filed `process/…` issues would simply stop being produced.

## References

- Upstream issue: ArcadeAI/safeword#587
- `packages/cli/src/retro/egress.ts` — `resolveSurface` (fail-closed wall)
- `packages/cli/src/retro/pipeline.ts` — `prepareEncounters` (silent `continue` drops)
- `packages/cli/templates/hooks/lib/self-report.ts` — `safewordInternalTail` allowlist
- `packages/cli/templates/hooks/lib/retro-extract.ts` — extraction prompt + Codex schema

## Personas

- Safeword Maintainer (SM)

## Surfaces

Affected:

- Claude Code — skip: change lives in the harness-neutral pipeline core; scenarios exercise the shared code path, not per-harness installs
- Claude Code on the Web — skip: same shared pipeline core
- OpenAI Codex — skip: same shared pipeline core (Codex extractor shares the schema/prompt constants)

## Jobs To Be Done

### retro-process-surface.SM1 — see process-level friction in the tracker

**Persona:** Safeword Maintainer (SM)

> When retro mines a session whose friction is process-level rather than tied to a single file, I want the finding filed under an honest process surface instead of silently dropped, so I can see workflow-category friction instead of losing it.

#### retro-process-surface.SM1.R1 — A finding surfaced as a constrained process area survives egress and files like any file-surfaced finding

#### retro-process-surface.SM1.R2 — The process namespace stays fail-closed: anything outside its strict slug shape is still dropped, so no new leakable shape can reach a public issue body

#### retro-process-surface.SM1.R3 — Extraction guidance offers the process surface, so an extractor with no honest file path names a process area instead of fabricating one

### retro-process-surface.SM2 — know what egress dropped

**Persona:** Safeword Maintainer (SM)

> When retro finishes a run, I want the summary to say how many findings were dropped at which egress wall, so I can tell degraded recall from a genuinely clean session.

#### retro-process-surface.SM2.R1 — Every retro run's summary reports the count of findings dropped at each egress wall (off-schema vs unresolvable surface), and stays quiet when nothing was dropped

## Rave Moment

skip: internal maintainer plumbing — no persona-facing peak to name.

## Outcomes

- A session containing only process-level friction produces filed issues (under `process/<slug>` surfaces) instead of an empty run.
- A retro run that dropped findings says so in its summary; a clean run's summary is unchanged.
- No string outside the existing path allowlist or the new slug-constrained namespace can appear as a surface in a public issue body.

## Open Questions

- Should `process/<slug>` findings carry a distinguishing label (e.g. `process`) at draft time for tracker triage?
