# Preserve native Codex hooks through a shared content projection

**Status:** Proposed, 2026-10-20; ticket 2ENRH5.
**Supersedes:** the Codex packaging aspect of the
[shared host contract decision](./shared-host-contracts.md).

## Context

Exact Codex 0.160.0 accepts the portable root manifest and its inline OpenAI
metadata, but its versioned loader explicitly omits hook sources for that format.
The same generated package, installed with only its compatibility manifest,
exposes all five native Safeword hook events awaiting user trust. See the
[native comparison and primary source](../tickets/2ENRH5-consistent-host-contract/codex-hook-discovery.md).
Metadata precedence cannot establish enforcement. No trust change can enable a
hook that the host never discovers.

## Decision

Keep one Codex native compatibility container on that target. Its skills,
references, guides, helpers and runtime derive from the shared content owner;
its manifest and invocation/address translations are a host projection. There
is one installed skill owner and one native hook authority, preserving the
current registration and activation boundary. Required shipped proofs load this
container. Retain portable-root capability proof separately with its truthful
resource-only boundary; never use it to admit hook protection.

Cursor continues to use the portable core and its necessary hook/worker
extension. Generated copies across host containers are permitted; equivalent
authored skill/policy copies are not. All existing ownership, evidence,
enrollment and recovery decisions remain in force.

## Alternatives and consequences

A root-only inline extension cannot meet the accepted guard outcome on 0.160.0.
A separate Codex hook companion could expose hooks, but would add a registration,
identity, activation and recovery dependency without removing any authored
content or policy owner. Keeping the existing container is smaller and preserves
compatibility. This choice changes delivery mechanics, not host coverage or
required guarantees. No new package dependency or trust bypass is introduced.

## Reassess and implementation

A future root-format mechanism requires exact native hook discovery, denial,
allow and continuation proof before a reviewed binding-policy change selects it.
Current documentation alone is insufficient. This decision is proposed; refresh
the implementation and execution reviews before further production changes.
