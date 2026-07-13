# Impl Plan: Keep persona lineage readable for builders

**Status:** implemented

## Approach

**Riskiest assumption:** The CLI and installed hook can adopt canonical 3–4
letter derivation while preserving every explicit legacy code and old JTBD
reference. The cheapest proof is “CLI and installed hooks derive the same
canonical code,” backed by “A pre-existing legacy JTBD reference still
resolves.” Build this parity slice first.

**Proof plan:**

| Scenario group | Primary proof | Supporting proof |
| --- | --- | --- |
| CLI and installed hooks derive the same canonical code | Setup/install integration that executes the copied hook from a fixture project | Unit table through both public helpers; Cucumber outline |
| First collision / exhausted collision space | Unit tests on ordered catalogs | Installed-copy integration executes one collision and compares the error discriminator |
| Short-name override | Unit validation assertion | CLI `check` integration message |
| Compatible explicit code / invalid bounds | Unit validation and lookup | Intake-gate integration for exact legacy persona |
| Installed assets prescribe one lineage code | Setup/schema integration using real templates | Static parity checks across Claude, Codex, Cursor |
| Two-letter defaults are legacy-only | Documentation contract test | Markdown and schema verification |

**Affected surfaces:** Claude Code, OpenAI Codex, and Cursor share the same
managed `personas.md` and BDD source templates. One real setup/schema integration
test proves the common assets; existing wrapper/parity tests prove each runtime
receives them.

**Build order:**

1. RED: replace persona unit expectations with canonical derivation, collision,
   exhaustion, short-name, and explicit compatibility cases.
2. GREEN: implement the CLI policy and actionable validation state.
3. RED: add installed-hook parity, legacy intake-gate, and setup/install wiring
   tests. The wiring test imports and executes the copied hook from a fixture
   project, mocking only the filesystem/process boundary.
4. GREEN: port the pure policy and `codeError` discriminator to the hook
   boundary; refactor shared test tables.
5. RED/GREEN: add installed-asset documentation contracts, then update source
   templates and sync dogfood copies.
6. Update `.project/personas.md`, surfaces, website reference, and
   `ARCHITECTURE.md`; do not rewrite historical ticket/Gherkin lineage.
7. Run focused unit/integration/Cucumber lanes, lint/type-check, then the full
   package verification plan.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because | Evidence |
| --- | --- | --- | --- | --- |
| Identifier ownership | One code resolves at personas.md and flows unchanged through lineage | Derive independently in each artifact | Independent derivation drifts after renames and breaks traceability | Figure-it-out traceability domain; [IBM traceability](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability); `SCENARIOS.md` lineage contract |
| New vs persisted bounds | Generate 3–4; accept explicit 2–6 | Hard-change all codes to 3–4 | Breaks customer-owned files and historical lineage | Repository survey found 100+ two-letter lineage files; `personas-file (7YN5QB)` made personas user-owned |
| Two-word derivation | First two characters of the first word plus first of the second | Initials only; first three flattened characters | Initials recreate two-letter defaults; flattening loses the second-word signal | Validated examples in `keep-persona-lineage-readable.feature`; user explicitly chose mnemonic 3–4 letter codes |
| Collision allocation | Deterministic source order with a suffix while total length stays ≤4 | Unbounded decimal suffix; random hash | Unbounded suffix violates the canonical bound; hashes are opaque | Existing source-order collision contract in `resolvePersonaCodes`; reviewed collision/exhaustion scenarios |
| Failure representation | `codeError` discriminator on resolved personas and hook results | Throw during resolution; infer from malformed code | Throwing prevents aggregate file diagnostics; inference confuses compatibility-valid 5-character codes with exhaustion | Existing `validatePersonas` aggregates line-addressed errors; reviewed exact-error parity scenario |
| Runtime reuse | Deliberate CLI/hook copies pinned by unit and installed-copy integration tests | Import CLI dist from hooks | Installed hooks run without a guaranteed package import boundary | `persona-gate-code-derivation (G9BXE9)` and `jtbd.ts` boundary comment |

## Arch alignment

- **Schema as Single Source of Truth:** source templates remain registered and
  runtime copies are produced through reconciliation.
- **Product-Framing Layer in BDD Phase 0:** persona → JTBD → Rule → scenario
  lineage remains machine-checkable.
- **Frozen Transcript Fixture Testing:** pure policy changes use narrow
  deterministic fixtures, not broad snapshot churn.

## Known deviations

- The hook duplicates CLI derivation logic. This is the established deployed
  runtime boundary from `persona-gate-code-derivation (G9BXE9)`; parity tests
  make the divergence observable.
- Historical two-letter lineage remains inconsistent with the new authoring
  convention by design. Bulk migration is excluded because identifiers are
  already persisted and user-owned.

## Doc impact

- `packages/cli/templates/personas-template.md`: canonical and legacy rules.
- BDD `DISCOVERY.md` / `SCENARIOS.md`: 3–4 letter worked lineage.
- `packages/website/src/content/docs/reference/configuration.mdx`: customer
  format and migration note.
- `ARCHITECTURE.md`: project-wide identifier decision and migration boundary.
- `README.md`: skip — it does not document persona-code format.

## Assessment triggers

- More than nine common collisions make numeric suffixes unreadable.
- A fourth runtime consumes persona policy through a different execution
  boundary.
- Users request safe renaming or aliases for persisted codes.
- Customer telemetry shows legacy 2/5/6-character codes can be retired in a
  future major version.
