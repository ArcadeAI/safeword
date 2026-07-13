# Personas

<!--
Project-wide persona definitions. Every spec, JTBD, and scenario in this
project references personas from this file by name or short code.
Safeword validates these references during intake — unknown personas
surface as questions, not silent failures.

FORMAT

Each persona is a `##` block with:

- A name in the header (e.g., `## Platform Operator`)
- A `**Role:**` one-sentence description (required)
- An optional `**Context:**` block (technical level, environment, constraints)

SHORT CODES

New codes use 3–4 letters and auto-derive when you save the file:

- Single-word names → first 3 characters, uppercased
  ("Auditor" → AUD)
- Two-word names → first 2 characters of the first word plus the second initial
  ("Platform Operator" → PLO)
- Names with 3+ words → initials, truncated to 4 characters
  ("Site Reliability Engineer" → SRE)
- Collisions get a bounded numeric suffix ("PLO", "PLO2", "PLO3")
- Override by authoring a canonical code explicitly: `## Platform Operator (PLAT)`

Legacy explicit codes remain compatible at 2–6 characters so existing JTBD and
Gherkin lineage does not break. Do not use the wider legacy range for new codes.
Persisted codes must match `^[A-Z][A-Z0-9]{1,5}$` (uppercase letter first).

To retire a persona, delete the block. References to retired codes surface
as unknown automatically.

EXAMPLE (uncomment, customize, then delete this comment)

## Platform Operator

**Role:** Infrastructure owner — registers servers, configures rate limits, manages projects.

**Context:** Has Dashboard admin access; may have direct infrastructure access. Reads logs, sets configuration, manages service accounts.

## End User

**Role:** Signs in to use the product.
-->
