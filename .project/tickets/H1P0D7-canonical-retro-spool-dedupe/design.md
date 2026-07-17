# Design: Cloud spool canonical dedupe

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

The existing CLI `RetroDraft` already carries a canonical signature and embeds
its marker in the code-assembled body. The cloud spool currently narrows that
draft to legacy fields, so this feature preserves the same identity as an
optional JSONL field and tells both shipped cloud filers to use it only as an
exact fallback after legacy lookup.

```text
RetroDraft → JSONL spool (canonicalSignature?) → cloud filer prompt → exact issue match → comment or create
```

## Components

### Component 1: Retro draft spool

**What:** Reads and writes the optional canonical signature without changing
the shape or behavior of old records.

**Where:** `packages/cli/templates/hooks/lib/retro-draft-spool.ts`

**Interface:** `SpooledDraft` gains `canonicalSignature?: string`; the parser
rejects a present non-string field and disables canonical fallback when its value
does not match the exact code-owned marker in the sealed body.

**Tests:** Current-record round trip; malformed-field rejection; legacy read.

### Component 2: Shipped filer definitions

**What:** Gives Claude/Cursor and Codex the same deterministic matching
procedure: exact legacy marker, then optional exact canonical marker, open
issues only, never title matching.

**Where:** `packages/cli/templates/agents/safeword-retro-filer.{md,toml}`

**Tests:** Parse both formats and pin the ordered contract in
`retro-filer-agent-defs.test.ts`.

### Component 3: Executable transport reference

**What:** Passes the preserved draft unchanged to the posting seam so the
prompt contract and on-disk contract share one data shape.

**Where:** `packages/cli/templates/hooks/lib/retro-draft-spool.ts`

**Tests:** The seam receives a canonical draft verbatim and drains it only after
the mocked post succeeds.

## Data Model

```ts
interface SpooledDraft {
  signature: string;
  canonicalSignature?: string; // absent on legacy records
  title: string;
  body: string;
  labels: string[];
  bodyDigest?: string;
}
```

## Key Decisions

### Optional explicit canonical field

**What:** Persist `canonicalSignature` as an optional JSONL property.

**Why:** It avoids asking the agent to derive opaque identity from prose and
keeps independently valid old JSONL records readable.

**Trade-off:** One additional field in current spool lines.

### Canonical field integrity

**What:** Use a canonical field only when the body contains its exact canonical
marker.

**Why:** The body is code-assembled and sealed; an independently modified JSONL
field must not redirect a recurrence to an unrelated issue.

**Trade-off:** A mismatched field loses only canonical fallback and retains the
ordinary legacy-signature path.

### Exact markers, not titles

**What:** The prompt may merge only on exact legacy or canonical markers.

**Why:** Titles are model-derived and can collide or drift; GitHub candidate
searches must be limited to open issues.

**Trade-off:** A semantically related finding without either marker opens a new
issue rather than being guessed into an old one.

## Implementation Notes

- Preserve body assembly in CLI code; the agent only reads the supplied value
  and posts body/title/labels verbatim.
- Keep `bodyDigest` validation unchanged.
- No customer documentation changes: this is an internal cloud transport fix.

## Open Questions

None.
