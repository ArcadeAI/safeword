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
  review 2026-07-06), because a short hex slug would otherwise clear it. The
  secret-shape check must also consider the whole slug AND its hyphen-split
  segments (hyphen-split hex) and non-hex high-entropy alphabets (base32/36).
- Accepted residuals, mirroring egress.ts's documented posture: low-entropy
  pure-alpha tokens (no practical stricter wall without a dictionary),
  pure-digit runs; canonical-UUID shapes are structurally excluded by the ≤32
  bound.
- `MAX_RAW_FINDINGS` overflow (anti-abuse ceiling of 50, unreachable by a
  legitimate session) is deliberately EXCLUDED from drop reporting — waived
  here per quality review 2026-07-07; the summary counts the schema and
  surface walls only.
- Drop counts are code-generated integers; they add no egress surface. At
  implement time, the summary scenarios must assert the rendered summary line
  with counts flowing from prepareEncounters through the command reporter —
  not a hand-injected counts object (wiring seam, quality review 2026-07-07).
