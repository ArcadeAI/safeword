# Feature Contribution: {title}

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** {parent}
- **Milestone:** {milestone}
- **Parent job:** {parent_job}
- **Killer Demo:** inherited from the parent spec

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

<What this feature contributes to the selected milestone and parent job.>

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### {parent_job}.{ticket_id}.R1 — <business invariant owned by this feature>

<!-- markdownlint-enable MD001 -->

## Surfaces

<!-- Contexts this must keep working in (see paths.surfaces). Each Affected entry
needs a scenario tagged @surface.<slug> or an inline skip; Unaffected is
informational. These comment lines declare nothing until you fill them in.

Affected:
- Claude Code
- OpenAI Codex — skip: <why no scenario of its own>

Unaffected:
- Cursor — <why this work cannot reach it> -->
