# Personas

Project-wide persona definitions. Every spec, JTBD, and scenario references
personas from this file by name or short code. Safeword validates these
references during Phase 0 — unknown personas surface as questions, not
silent failures.

## Format

Each persona is a `##` block with:

- A name in the header (e.g., `## Platform Operator`)
- A `**Role:**` one-sentence description (required)
- An optional `**Context:**` block (technical level, environment, constraints)

Short codes are **auto-derived** by safeword on next save:

- Multi-word names → first letter of each word, uppercased (`Platform Operator` → `PO`)
- Single-word names → first 2 characters, uppercased (`Auditor` → `AU`)
- Collisions get a numeric suffix (`PO`, `PO2`, `PO3`)

To override the derived code, write it explicitly:

```markdown
## Platform Operator (PLATOPS)
```

Codes must match `^[A-Z][A-Z0-9]{1,5}$` (2–6 chars, uppercase letter first).

To retire a persona, delete the block. References to retired codes surface
as unknown automatically.

## Example (uncomment and customize)

<!--
## Platform Operator

**Role:** Infrastructure owner — registers servers, configures rate limits, manages projects.

**Context:** Has Dashboard admin access; may have direct infrastructure access. Reads logs, sets configuration, manages service accounts.

## End User

**Role:** Signs in to use the product.
-->
