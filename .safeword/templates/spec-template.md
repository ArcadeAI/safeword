# Product Plan: {title}

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** <customer problem and decision-bearing evidence>
- **Expected outcome:** <observable business or user outcome>
- **Success threshold:** <falsifiable threshold; use an observable outcome when no honest metric exists>
- **Project non-goals:** <explicit boundaries>

## Jobs To Be Done

### <slug>.<persona-code>1 — <job title>

**Persona:** <canonical persona>

> When I <situation>, I want <motivation>, so I can <outcome>.

#### <slug>.<persona-code>1.R1 — <business invariant>

## Shape

### M1 — <milestone name>

- **Outcome:** <value delivered by this milestone>
- **Non-goals:** <what this milestone does not include>

## Killer Demo

- **Audience:** <canonical persona>
- **Starting state:** <recognizable before-state>
- **Action:** <shortest credible action>
- **Payoff:** <persona-facing result>
- **Proof:** <what makes the payoff observable>
- **Boundary:** <what the demo deliberately does not prove>

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
