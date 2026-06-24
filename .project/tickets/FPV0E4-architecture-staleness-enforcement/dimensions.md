# Dimensions: Architecture doc staleness enforcement (Slice 2)

Systematic coverage for the enforcement behavior. Partitions derive from the
resolved threshold map (ticket → "Resolved design") plus the two enforcement
surfaces.

| Dimension                     | Partitions (equivalence classes + boundaries)                                                                  | Source                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Doc state / `selfHeal` action | **would-change**: `created`, `healed`, `regenerated` · **clean**: `unchanged`, `noop` · **foreign**: `skipped` | threshold map (TB1/TB2)             |
| Enforcement surface           | agent commit (PreToolUse hook, auto-fix+stage) · CI check (`--check`, dry-run exit code)                       | wiring decision (TB1 vs TB2)        |
| Config state                  | default-on (key absent _or_ `true`) · opt-out (`false`)                                                        | config decision (TB3)               |
| Staged-state safety           | unrelated change already staged at commit time                                                                 | premortem safety scenario (TB1.AC3) |

## Partition → scenario mapping

- **would-change × commit** → TB1.AC1 (outline over created/healed/regenerated): regenerate + stage, no block.
- **clean/foreign × commit** → TB1.AC2: fresh not restaged; foreign untouched; neither blocks.
- **staged-state safety × commit** → TB1.AC3: unrelated staged change survives.
- **would-change × CI** → TB2.AC1 (outline over the three would-change states): check fails.
- **clean/foreign × CI** → TB2.AC2 (outline over unchanged/noop/foreign): check passes.
- **opt-out × commit** → TB3.AC1: hook is a no-op on a stale doc.
- **opt-out × CI** → TB3.AC2: check passes on a stale doc.

## Boundary notes

- `noop` (no modules, no doc — monorepo root) is the boundary between "clean" and
  "would-change": it must NOT be treated as `created`. Covered in TB2.AC2.
- `skipped` (foreign doc) is the boundary of ownership: enforcement governs only
  safeword-owned docs, so foreign is pass-only on both surfaces. Covered TB1.AC2 + TB2.AC2.
- Opt-out is the cross-cutting kill switch — exercised on _both_ surfaces (TB3)
  so neither can act when the project has declined enforcement.
