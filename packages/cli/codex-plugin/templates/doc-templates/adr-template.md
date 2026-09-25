# ADR: {title}

**Status:** proposed <!-- proposed | accepted | superseded by {ref} -->
**Date:** {YYYY-MM-DD}
**Supersedes:** none <!-- the record this replaces, linked both directions, if any -->

<!--
Architecture decision record — Nygard-core, kept lean (a page or two; no
mega-records, no design guides in disguise). Emit one only for a decision
that affects structure, key quality attributes, or is difficult to reverse;
routine choices stay in the ticket's impl-plan Decisions table.

Placement: resolved from `paths.architecture` in .safeword/config.json — a
file receives this as an appended entry; a directory receives it as its own
file named YYYYMMDD-{slug}.md (date-prefixed — merge-safe across parallel
sessions). Never write records into architecture.generated.md.

Change discipline: supersede, never edit. A changed decision gets a NEW
record; mark this one "superseded by {ref}" and link both directions.
Fill each section, then delete the guidance comments.
-->

## Context

<!-- The forces at play: the problem, constraints, and why a decision is
needed now. 1-2 paragraphs. -->

## Decision

<!-- What we chose, stated actively ("We will..."), with the load-bearing
reason and the alternatives that lost. -->

## Consequences

<!-- What becomes easier, what becomes harder, what future work this
constrains or enables. -->
