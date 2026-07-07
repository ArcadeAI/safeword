# Dimensions: retro-process-surface

Derived from intake (slug constraint, drop accounting, extraction guidance) plus
domain knowledge of the egress posture (#601: the surface field bypasses
sanitizeTextDeep — resolveSurface is the only wall before public interpolation).

| Dimension                     | Partitions                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Surface input shape           | real safeword file path (existing allowlist — unchanged); `process/<valid-slug>`; `process/<invalid-slug>`; non-safeword path (still dropped)           |
| Slug validity                 | lowercase alnum + hyphens ≤32 (survives); uppercase / underscore / extra `/` (drop); >32 chars (drop); empty (drop)                                     |
| Slug secret shape             | ordinary word slug (survives); hex run of ANY length incl. sub-20 (drop); high-entropy token (drop)                                                     |
| Drop accounting               | clean run (no drop line); off-schema drops counted; unresolvable-surface drops counted; both walls in one run                                           |
| Process-finding downstream    | draft body carries `process/<slug>` surface; draft labels include `process`; file-surfaced drafts unchanged (no `process` label)                        |
| Extraction guidance parity    | Claude system prompt offers `process/<area>`; Codex schema/prompt offers it too; `safeword_surface` stays a required field (no surface-less findings)   |

Boundary notes:

- The slug wall must run the hex/secret-shape rejection at any length — it must
  NOT inherit the ≥20-char floor of the free-text entropy backstop (quality
  review 2026-07-06), because a short hex slug would otherwise clear it.
- Drop counts are code-generated integers; they add no egress surface.
