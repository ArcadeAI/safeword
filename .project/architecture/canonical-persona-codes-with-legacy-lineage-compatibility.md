# Canonical Persona Codes with Legacy Lineage Compatibility

**Status:** Accepted
**Date:** 2026-07-13 (updated 2026-07-14: explicit new codes may use 2–4 letters)

**What.** Newly derived persona codes use deterministic 3–4 character identifiers across the CLI and installed JTBD hook; collisions receive a bounded numeric suffix. Explicitly authored new codes may use 2–4 characters, so natural acronyms such as `PO` remain available. Persisted 5–6 character codes and former derived aliases continue to resolve for compatibility.

**Why.** A three-character default avoids ambiguous initials. Authors can still choose a familiar two-letter acronym, and existing codes keep their history.

**Trade-off.** Explicit two-letter codes can collide or be less recognizable, so the author owns that choice. The resolver also handles legacy aliases. The CLI and standalone hook each implement the same derivation rule because deployed hooks cannot import the CLI distribution. Exhausting the four-character collision namespace requires an explicit 2–4 character override.

**Alternatives.** Auto-generate 2–4 characters (rejected: recreates ambiguous initials by default); enforce 3–4 characters for every explicit code (rejected: forbids natural acronyms and breaks history); accept 2–6 as equally recommended (rejected: weakens concise lineage guidance); bulk-rename historical Gherkin tags (rejected: destroys stable traceability).

**Implementation.** `packages/cli/src/utils/personas.ts`, `packages/cli/templates/hooks/lib/jtbd.ts`, `packages/cli/templates/personas-template.md`, and BDD authoring templates. The repo's current persona catalog uses `TBU`, `NTB`, and `SWM`; existing historical `TB` and `SM` references resolve through compatibility aliases. Ticket FAJV19.
