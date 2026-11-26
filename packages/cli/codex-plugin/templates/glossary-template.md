# Glossary

<!--
Project-wide domain vocabulary. Every spec, JTBD, and scenario in this
project should use terms consistently with this file. Safeword validates
the file's structure during `safeword doctor`; the `bdd` intake flow reads
it so domain terms stay consistent across tickets.

FORMAT

Each term is a `##` block with:

- A term name in the header (e.g., `## Tool`)
- A `**Definition:**` line (required) — one or more lines; wrapped text
  is joined into a single definition.

Optional fields (parsed if present, never required):

- `**Used in:**` — which domains/services use this term.
- `**Example:**` — a usage example.
- `**Do not confuse with:**` — related terms with distinct meanings.
- `**Aliases:**` — comma-separated synonyms (e.g., `**Aliases:** Function, Capability`).

Unknown `**Field:**` lines are tolerated (forward-compat). An alias must
not collide with a declared term name (lookup would be ambiguous).

To retire a term, delete its block.

Example (uncomment to use):

## Tool

**Definition:** A single callable operation.
**Do not confuse with:** A toolkit groups related tools.
-->
