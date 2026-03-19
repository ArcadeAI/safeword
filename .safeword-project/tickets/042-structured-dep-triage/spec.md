# 042: Structured Dependency Triage & W005 Stale Tool Config

## Problem

When `/audit` reports outdated packages, the output is raw `bun outdated` / `npm outdated` table dumps. Claude improvises risk categorization, options, and verdicts — producing good results but inconsistently. Similarly, knip has built-in "Configuration Hints" that detect stale config overrides, but safeword doesn't surface them.

Real-world example from a project using safeword:

- `knip 5.86.0 → 5.88.1` (dev, patch) — safe to update
- `safeword 0.23.0 → 0.24.0` (dev, minor) — safe to update
- `eslint 9.39.4 → 10.0.3` (dev, major) — needs dedicated investigation

Claude correctly triaged this, but the audit template didn't guide it to do so.

## Solution

### Part 1: Structured Outdated Package Triage

Enhance the "Outdated Packages" section of `/audit` to instruct Claude to:

1. Parse `bun outdated` / `npm outdated` output
2. Classify each package by **semver tier** (patch / minor / major) and **dep type** (prod / dev)
3. Assign risk: `Low` (dev patch/minor), `Medium` (prod patch/minor, dev major), `High` (prod major)
4. Present a structured table with risk levels
5. Give a **verdict** per risk tier with concrete actions

Output format:

```
**Outdated Packages:**

| Package | Current | Latest | Type | Bump | Risk |
|---------|---------|--------|------|------|------|
| knip | 5.86.0 | 5.88.1 | dev | patch | Low |
| safeword | 0.23.0 | 0.24.0 | dev | minor | Low |
| eslint | 9.39.4 | 10.0.3 | dev | major | High |

**Verdict:**
- ✅ **Low risk (2):** Safe to update now — dev-only tools, patch/minor bumps
- ⚠️ **High risk (1):** Defer `eslint` major bump to dedicated task — research breaking changes first
```

### Part 2: W005 Stale Tool Config

Add a new warning code for stale tool configuration:

- **[W005] Stale config:** Tool configuration contains unnecessary overrides

Detection method:

1. Run `bunx knip --reporter json` (already running knip in audit)
2. Parse the JSON output for `configurationHints` entries
3. Flag each stale override as W005

Example output:

```
- [W005] Stale config: `knip.json` — `.safeword-project/**` can be removed from ignore
- [W005] Stale config: `knip.json` — `safeword` can be removed from ignoreDependencies
```

## Research Findings

- **Knip supports `--reporter json`** with structured output including configuration hints
- **`bun outdated` has no JSON flag** — must parse table output (has `(dev)` annotation for devDeps)
- **Renovate's 3-tier model** (patch=auto, minor=review, major=approval) is industry standard
- **Dev vs prod separation** is universal best practice — dev tools are lower risk
- **Pre-1.0 deps** (`0.x`) should treat minor bumps as majors (semver allows breaking changes)

## Scope

- Modify: `packages/cli/templates/commands/audit.md` (source of truth)
- Sync: `.claude/commands/audit.md` (project copy)
- No code changes — template-only modifications
- No new warning codes beyond W005

## Out of Scope

- Auto-update command (`/dep-update`) — future work
- Configurable risk tolerance — future work
- Auto-creating tickets for major bumps — future work
