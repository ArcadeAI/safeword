# Dimensions — Ticket 144

Derived from intake: scope (manifest + pre-commit + slash command), done_when (per-entry failure modes), resolved open questions (byte-identical only; `pair` + `contract` entry types only for v1).

## Behavioral dimensions

| Dimension                 | Partitions                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Manifest entry type       | `pair`, `contract`                                                                  |
| Pair state                | identical (clean), differ in any byte (drift), one side missing                     |
| Contract state            | all `requires` present (clean), one missing, multiple missing, target file missing  |
| Manifest validity         | well-formed, malformed JSON, schema-invalid (unknown keys, missing required fields) |
| Enforcement surface       | pre-commit (blocks commit), slash command (reports only, never blocks)              |
| Bypass path               | `--no-verify` allows commit despite drift                                           |
| Manifest presence         | manifest file exists, manifest file missing entirely                                |
| Multi-failure aggregation | single failure reported, multiple failures all reported in one run (no fail-fast)   |

## Boundary cases

- Empty manifest (zero pairs, zero contracts) — passes trivially with `All 0 pairs and 0 contracts in sync.`
- Whitespace-only diff between pair files — fails (strict byte comparison; no normalization)
- Multiple required strings missing from a single contract — all reported in one failure line
- Multiple manifest entries failing simultaneously — all listed (no fail-fast in either pre-commit or slash command)

## Rule mapping

Each dimension contributes to one or more rules:

- Manifest entry type (`pair`) × Pair state → **Rule: Pair entries enforce byte-identical files**
- Manifest entry type (`contract`) × Contract state → **Rule: Contract entries enforce required strings**
- Enforcement surface (pre-commit) × Bypass path × Multi-failure aggregation → **Rule: Pre-commit hard-blocks broken state**
- Enforcement surface (slash command) × Multi-failure aggregation → **Rule: Slash command reports state without blocking**
- Manifest validity × Manifest presence → **Rule: Manifest is the explicit source of truth**

## Out-of-scope dimensions (documented for future)

- **`directory_pair` entry type** — for skill-style directories when Claude/Cursor migrate from `.claude/commands/*.md` and `.cursor/commands/*.md` to `.claude/skills/<name>/SKILL.md` directory structures. Add when the first command migrates to a skill.
- **`canonical` field on `pair` entries** — tunes failure messages to name the source-of-truth side (template → runtime relationship). Add if/when divergence-direction matters for diagnosis.
- **Negative declarations** (Claude-only files with no Cursor counterpart) — add a `claude_only` list to the manifest if false positives emerge.
- **Auto-pair by convention** — explicitly rejected. Manifest only.
- **Forward-compat scenarios** (e.g., manifest tolerates extra fields gracefully) — YAGNI. Add when a real extension lands.

## Card-ratio self-check

- **Rules:** 5. Each has 4 scenarios except "Manifest" which has 6. No rule with zero examples; none with 8+.
- **Total scenarios:** 18.
- **Open questions remaining at this phase:** 0 (all resolved during define-behavior).
