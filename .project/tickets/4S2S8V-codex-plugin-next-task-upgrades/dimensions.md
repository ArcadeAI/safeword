# Dimensions: Update Safeword without restarting Codex

| Dimension | Partitions and boundaries | Rule coverage |
| --- | --- | --- |
| Marketplace state | absent; configured Git source; configured non-Git source | R1 |
| Marketplace refresh result | success; command failure before plugin installation | R1 |
| Task lifecycle | task that installs the upgrade; first new task after installation; later tasks after proof | R2, R3 |
| Activation evidence | no marker; current marker; matching proof; stale or mismatched proof | R3 |
| Marker generation | canonical next-task marker; valid v0.70 restart marker; malformed or stale legacy marker | R4 |
| User guidance surface | install prose; status prose; migration bootstrap text; JSON migration state | R2, R4 |
| Trust boundary | exact package version and manifest digest match; either identity differs | R3 |

## Coverage choices

- Fresh and Git-backed marketplace paths receive separate scenarios because they invoke different Codex commands.
- Non-Git configured marketplaces retain the existing add/install path; they are covered by focused unit behavior rather than a separate persona scenario because no user contract changes.
- A refresh failure is the rejection path for R1: plugin installation must not continue from stale marketplace metadata.
- A mismatched proof is the rejection path for R3: activation cannot be claimed for a different version or hook manifest.
- A malformed or stale legacy marker is the rejection path for R4: compatibility must not manufacture current activation state.
