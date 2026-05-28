# Y2HCNJ — Behavioral Dimensions

Systematic coverage analysis for the JTBD-as-Phase-0-artifact feature
(new per-ticket `spec.md`, JTBD authoring sub-step, intake-exit gate).
Each dimension is partitioned into equivalence classes + boundary
values; scenarios in `test-definitions.md` cover one per partition.

## Dimension table

| Dimension                          | Partitions                                                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scaffold by ticket type**        | `feature` → spec.md created next to ticket.md / `task` → no spec.md / `patch` → no spec.md / type omitted (defaults to `task`) → no spec.md                                                         |
| **ticket.md template shape**       | `feature` → `**Goal:**` + `**See:** spec.md`, NO `**Why:**` / `task` → `**Goal:**` + `**Why:**` (unchanged) / `patch` → `**Goal:**` + `**Why:**` (unchanged)                                        |
| **spec.md scaffold idempotence**   | spec.md absent → written / spec.md already present (re-run / EEXIST path) → not overwritten                                                                                                         |
| **spec.md template content**       | has all six section headers (Intent → References → Personas → Vocabulary → Jobs To Be Done → Outcomes) / Jobs To Be Done section carries a worked example in the `When I…, I want…, so I can…` form |
| **JTBD section parse**             | one entry (`**Persona:**` + statement) / multiple entries / zero entries (header only) / `skip: <reason>` declaration / entry with empty `**Persona:**` value / non-JTBD prose only                 |
| **Gate routing (D5)**              | spec.md present → JTBD gate applies / spec.md absent (grandfathered in-flight ticket OR task/patch) → JTBD gate skipped, old flow                                                                   |
| **Gate outcome (spec.md present)** | ≥1 JTBD whose persona resolves → allow / `skip: <non-empty reason>` → allow / zero JTBD entries → deny / persona ref not in personas.md → deny / `skip:` with empty/whitespace reason → deny        |
| **Persona resolution at gate**     | exact persona name match in personas.md / explicit code match (`(PO)`) / ref absent from personas.md → unresolved / personas.md missing entirely → unresolved (degrade, no throw)                   |
| **Doc integration**                | `DISCOVERY.md` + paired template both carry the JTBD sub-step after "Load project glossary" / `SAFEWORD.md` template + dogfood copy mention the JTBD sub-step in the Clarify/Phase-0 description    |

## Notes on derivation

- **Scaffold by ticket type** — D4 (features only). The `type omitted`
  boundary matters because `createTicket` defaults `type` to `task`
  ([ticket-writer.ts:86](packages/cli/src/utils/ticket-writer.ts:86));
  a defaulted ticket must NOT get a spec.md.

- **ticket.md template shape** — D2 drops `**Why:**` "from the ticket
  template" because product motivation moves to `spec.md`'s `## Intent`.
  But task/patch get no spec.md, so dropping their `**Why:**` would
  orphan the motivation with no replacement home. Resolved: the drop is
  feature-only; task/patch keep `**Goal:** + **Why:**` unchanged. The
  feature variant gains a `**See:** spec.md` pointer instead.

- **JTBD section parse** — the gate's unit of work is a JTBD _entry_,
  defined minimally as a `**Persona:** <ref>` line inside the
  `## Jobs To Be Done` section. The full `When I…` statement form and the
  `<slug>.<persona><n>` id are _coached_ in DISCOVERY.md and authored by
  the agent, but NOT gate-enforced — id-pattern + scenario-coverage
  enforcement is XT1FFM's scope, not this ticket's. Keeping the gate's
  entry definition minimal (persona presence) avoids over-fitting the
  gate to a format XT1FFM will formalize.

- **Gate outcome** — partitions mirror the existing `dimensions.md`
  escape-valve gate
  ([pre-tool-quality.ts:281-298](packages/cli/templates/hooks/pre-tool-quality.ts:281)):
  real content OR `skip: <non-empty reason>`, empty reason denied. The
  JTBD gate adds one semantic partition the dimensions.md gate lacks —
  _persona-ref-unresolved → deny_ — because the epic's whole purpose is
  catching a product anchor that points at a persona that doesn't exist.

- **Persona resolution at gate** — lightweight membership against
  personas.md (`## Name (CODE)` headers), NOT the full
  `validatePersonaReference` (case-suggestion, etc.) which stays in the
  agent/authoring path. personas.md-missing degrades to _unresolved_
  without throwing, mirroring `validatePersonaReference`'s I/O-boundary
  contract ([personas.ts:449](packages/cli/src/utils/personas.ts:449)).
  This is the **3rd consumer** of the "parse `##` blocks" pattern
  (personas.ts, glossary.ts, now the JTBD gate) — per the epic's
  deferred-refactor decision, M6D315 extracts at this 3rd consumer;
  Y2HCNJ mirrors the pattern in place and flags it, does not extract.

- **Doc integration** — two partitions because two artifacts on disk,
  each with a canonical/dogfood pair that must stay in sync (the
  template-sync rule). Mirrors YR6C49 R8.2 (DISCOVERY.md glossary
  sub-step doc-presence assertion).
