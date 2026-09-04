# Feature Contribution: {title}

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** {parent}
- **Milestone:** {milestone}
- **Parent job:** {parent_job}

## Contribution

<What this feature contributes to the selected milestone and parent job.>

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable-next-line MD001 -->

#### {parent_job}.{ticket_id}.R1 — <business invariant owned by this feature>

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
