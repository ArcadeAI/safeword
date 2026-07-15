# Design: Keep persona lineage readable for builders

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Persona-code policy remains a pure parsing concern. The CLI implementation in
`packages/cli/src/utils/personas.ts` is authoritative for customer-facing
validation and lookup; the installed JTBD hook carries a deliberate copy because
deployed hooks cannot import the CLI distribution. Tests pin both copies to the
same input/output table.

The persisted validation pattern remains 2–6 uppercase alphanumeric characters.
Automatic derivation is 3–4 characters; explicitly authored new codes are
recommended at 2–4 characters, with 5–6 retained for compatibility.
Collision suffixes are allocated deterministically in source order while the
result fits four characters; exhaustion becomes a validation error requesting
an explicit code.

## Components

### Component 1: CLI persona-code policy

**What:** Derive canonical codes, preserve explicit compatible codes, allocate
bounded collision suffixes, and expose actionable validation errors.

**Where:** `packages/cli/src/utils/personas.ts`

**Interface:**

```typescript
const PERSONA_CODE_PATTERN: RegExp; // persisted compatibility: 2–6
const CANONICAL_PERSONA_CODE_PATTERN: RegExp; // generated default: 3–4

function derivePersonaCode(name: string): string;
function resolvePersonaCodes(parsed: readonly ParsedPersona[]): ResolvedPersona[];
function validatePersonas(parsed: readonly ParsedPersona[]): PersonaValidationError[];
```

**Tests:** Canonical derivation, collision ordering/exhaustion, short-name
rejection, compatible explicit-code boundaries.

### Component 2: Installed JTBD-hook mirror

**What:** Resolve the same canonical and legacy reference forms inside installed
agent hooks without importing the CLI package.

**Where:** `packages/cli/templates/hooks/lib/jtbd.ts`

**Dependencies:** Markdown heading parsing and JTBD gate evaluation already in
the hook module.

**Tests:** Table-driven parity against CLI outputs plus real intake-gate legacy
reference acceptance.

### Component 3: Authoring assets and dogfood catalog

**What:** Teach persona authors to use automatic 3–4 or explicit 2–4 letter codes and show the
same code flowing into JTBD and Gherkin Rule tags.

**Where:** `packages/cli/templates/personas-template.md`, BDD `DISCOVERY.md` and
`SCENARIOS.md`, installed copies, `.project/personas.md`, and project surfaces.

**Tests:** Installed-asset contract tests for Claude Code, Codex, and Cursor;
schema/parity tests protect distribution.

### Component 4: Architecture and customer documentation

**What:** Record why canonical generation is narrower than persisted-code
compatibility and document the migration boundary.

**Where:** `ARCHITECTURE.md` and the website configuration reference.

**Tests:** Documentation contract assertions where stable; markdown/lint checks
for the rest.

## Data Model

No persistent schema is added. `ResolvedPersona` keeps its existing `code`
string and gains an optional `codeError` discriminator:

```typescript
type PersonaCodeError = 'non-canonical-derived-code' | 'collision-space-exhausted';

interface ResolvedPersona extends ParsedPersona {
  code: string;
  codeError?: PersonaCodeError;
}
```

On failure, `code` retains the attempted base for diagnostics; validation emits
the actionable error before duplicate-code checks, and lookup excludes errored
personas. The hook mirror returns the same discriminator alongside its reference
set so the intake gate can surface the same failure class.

## Component Interaction

```text
personas.md heading
  → CLI parser/resolver → check + agent lookup
  → installed hook mirror → intake gate
  → JTBD id → Gherkin Rule tag
```

## User Flow

1. A builder authors `## Platform Operator` or an explicit
   `## Platform Operator (PLO)` persona.
2. Safeword resolves `PLO`; explicit compatible legacy codes remain unchanged.
3. BDD guidance writes `feature.PLO1` and `@feature.PLO1.R1`.
4. If a short name or exhausted collision space cannot yield 3–4 characters,
   `safeword check` asks for an explicit 2–4 letter code.

## Key Decisions

### Separate canonical generation from compatibility validation

**What:** Generate 3–4 characters, recommend 2–4 for explicit new codes, and
continue accepting persisted 5–6 character explicit codes.

**Why:** A hard pattern change would invalidate existing customer-owned
`personas.md` files and stored lineage; the repository alone has more than 100
files containing two-letter lineage.

**Trade-off:** The validator supports a wider legacy language than the authoring
guidance recommends.

### Keep the hook mirror explicit

**What:** Port the same pure policy into the installed hook and pin parity with
tests.

**Why:** Deployed hooks execute independently and cannot import CLI `dist`.

**Trade-off:** Two implementations require table-driven parity protection.

## Implementation Notes

**Constraints:** Preserve exact explicit codes; never rewrite completed lineage;
keep every derived result within four characters; edit templates before
dogfood copies.

**Error handling:** Short-name and collision-exhaustion errors point to
`## Name (CODE)` with a 2–4 character example.

**Gotchas:** Explicit codes claim their namespace before derived codes. Collision
allocation must remain deterministic in persona source order.

**Open Questions:** None.

## References

- `personas-file (7YN5QB)`
- `persona-gate-code-derivation (G9BXE9)`
- [Cucumber tags](https://cucumber.io/docs/cucumber/api/)
- [IBM requirements traceability](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability)
