---
id: '108'
slug: persona-checks
title: 'Persona coverage checks during BDD scenario authoring'
type: Feature
status: backlog
priority: low
---

# Feature: Persona Coverage Checks

**Type:** Feature | **Priority:** Backlog

## Problem

When writing BDD scenarios, it's easy to forget about certain user types. A feature might have thorough happy-path scenarios for a power user but completely miss the first-time user experience or the CI/automated pipeline case.

## Solution

Let customers declare personas in `.safeword.yml`. The BDD skill reads these during Phase 3/4 (scenario authoring) and uses agent judgment to assess whether the scenarios adequately cover each persona's perspective. Not deterministic — the agent simply asks "did we capture use cases for the IT administrator here?" based on its understanding of the feature and the persona descriptions.

## Configuration

```yaml
# .safeword.yml
personas:
  - name: new-user
    description: 'First-time user, no prior config'
  - name: power-user
    description: 'Existing user with custom config and overrides'
  - name: ci-bot
    description: 'Automated pipeline, non-interactive'
  - name: team-lead
    description: 'Manages shared config across a team'
```

## How It Works

1. Customer declares personas in `.safeword.yml`
2. BDD skill loads personas into context during Phase 3/4
3. After scenarios are drafted, the agent reviews them against each persona using judgment — not string matching or tags
4. Agent flags personas that seem relevant but uncovered: "This feature affects config setup, but none of the scenarios consider the `ci-bot` (automated pipeline) perspective — worth adding?"
5. Author decides whether to add scenarios or move on

## Implementation

- Add `personas` array to `.safeword.yml` schema
- Update BDD skill Phase 3/4 (`DISCOVERY.md` or scenario gate) to read personas from config and include them in the agent's context
- Add a prompt instruction: after drafting scenarios, review against declared personas and flag gaps
- No gates, no blocking — just a judgment call surfaced as a question

## Out of Scope

- Deterministic matching (tags, string matching, coverage tracking)
- Persona-based test generation (auto-creating scenarios)
- Standalone `safeword personas` command
- Enforcement gates
