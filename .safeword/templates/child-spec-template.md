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

<!--
Which supported contexts must keep working: agent, runtime, protocol, client, or
deployment. Name surfaces from the configured surfaces inventory (paths.surfaces)
where one exists; a context that only ever matters to this ticket can stay local.

Every entry under Affected needs a scenario tagged @surface.<slug> (lowercase,
non-alphanumerics to hyphens: OpenAI Codex -> @surface.openai-codex), or an
inline skip on its own line. Unaffected is informational -- record it so a
reviewer can see the boundary was considered rather than missed.

Delete this section only when the work touches no supported context at all.
These comment lines are ignored by the parser, so an unfilled template declares
no surfaces.

Affected:
- Claude Code
- OpenAI Codex — skip: <why this surface needs no scenario of its own>

Unaffected:
- Cursor — <why this work cannot reach it>
-->
