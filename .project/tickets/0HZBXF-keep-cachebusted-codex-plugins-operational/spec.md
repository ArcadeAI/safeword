# Spec: Keep cachebusted Codex plugins operational

## Intent

Make a cachebusted Safeword Codex plugin a coherent immutable bundle: its
manifest, package identity, bundled runtime, generated workflow commands, and
profile proof all agree on the exact installed version. Keep the normal release
bundle unchanged and preserve Claude Code and Cursor behavior.

## Intake Brief

- **Requested by:** Safeword owner after an installed `0.83.1+codex.*` bundle
  exposed generated commands that still targeted the absent `0.83.1` cache
  directory.
- **Cost of inaction:** A plugin may appear installed while explicit Safeword
  skills fail to launch their bundled runtime, and status can incorrectly demand
  an update from the same installed bundle.
- **Reversibility:** Two-way door. The generator input and build-time version
  injection are local release tooling; the default remains the package version.

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI
- Claude Code
- Cursor

## Jobs To Be Done

### cachebusted-codex.TBU1 — Use the installed Safeword workflow reliably

**Persona:** Technical Builder (TBU)

> When Codex installs a cachebusted Safeword plugin, I want every workflow to
> resolve the runtime inside that exact immutable bundle, so explicit skills and
> automatic workflow checks work without a misleading repair instruction.

#### cachebusted-codex.TBU1.R1 — Every generated Codex artifact uses one validated effective plugin version

#### cachebusted-codex.TBU1.R2 — A cachebusted bundle executes and identifies itself from its exact installed directory

### cachebusted-codex.SWM1 — Preserve release and host parity while cachebusting

**Persona:** Safeword Maintainer (SWM)

> When I generate or verify plugin artifacts, I want cachebusting to be an
> explicit Codex-only build input with regression proof, so normal releases and
> the Claude Code and Cursor contracts do not drift.

#### cachebusted-codex.SWM1.R1 — Default generation remains deterministic at the package version

#### cachebusted-codex.SWM1.R2 — Claude Code and Cursor artifacts remain independent of the Codex effective version

#### cachebusted-codex.SWM1.R3 — The upstream design records a task-bound plugin-root contract without making delivery depend on it

## Outcomes

- Maintainers can generate a Codex bundle with an explicit SemVer-compatible
  effective version such as `0.83.1+codex.20260909051010`.
- The manifest, package metadata, bundled runtime, generated skill paths, and
  proof/status identity all agree on that exact version.
- Invalid or incompatible overrides fail before an inconsistent bundle is
  written.
- Generation without an override remains byte-stable at the base package
  version.
- Existing Claude Code and Cursor generation and execution paths do not change.
- The design record proposes a task-bound plugin-root value for host-native
  relative resource resolution as the longer-term Codex interface.

## Rave Moment

skip: invisible packaging correctness; success is that the installed workflow
simply runs.

## Open Questions

None.
