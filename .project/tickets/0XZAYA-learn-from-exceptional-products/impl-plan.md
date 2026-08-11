# Impl Plan: Bring proven product patterns into every feature

**Status:** implemented
**Planned on:** 2026-08-09

## Approach

The riskiest assumption is that one narrow, human-editable Markdown contract can
distinguish resolved inspiration from incomplete evidence without judging
research quality. The cheapest proof is a real transition test for each existing
gate: a marked fixture with an invalid record must remain in its prior phase and
the same fixture with a valid record must advance without mutating the evidence
artifact.

The implementation is four dependency-ordered slices:

1. **Shared activation model and product gate.** Add a pure `inspiration.ts`
   helper and lock down failure precedence before parsing a successful row:
   exact/duplicate/malformed signals, activation by either version marker or the
   independent scaffold-origin sentinel, all-three v1 requirements, pre-v1
   signal-free exemption only without committed activation provenance, missing
   baselines, mutually exclusive
   result paths, and injected evaluation dates. Then add the complete v1
   single-line/no-pipe table lexer, direct product records, unsuccessful-search
   records. Each feature owns its record; a child may re-check the same source
   without introducing parent lookup or inherited trust state.
   Drive every partition through
   table-driven unit tests before wiring `evaluateFeatureTicketReadiness`. A
   real pre-tool integration test will exercise ticket edit → readiness →
   parser and assert denial/remediation, failure precedence, prior phase, and
   unchanged `spec.md`. This proves TBU1.R1, the product half of TBU1.R3 and
   NTB1.R3, and the load-bearing architecture assumption without opening an
   activation bypass during incremental development.
2. **Implementation gate.** Reuse the same helper from `evaluateImplementEntry`,
   with `planned_on` as the lower date bound and implementation-specific version
   fields. Unit tests cover the
   technical partitions; a real pre-tool integration test exercises ticket edit
   → plan gate → impl-plan
   parser → inspiration parser for rejection and acceptance. This proves
   TBU1.R2, the implementation half of TBU1.R3, and NTB1.R3.
3. **Automatic authoring and safe research guidance.** Add the paired v1 markers,
   independent scaffold-origin sentinel, and Product Inspiration scaffold to
   feature ticket/spec creation, add the
   Implementation Inspiration scaffold to `impl-plan-template.md`, and update
   `DISCOVERY.md` plus `PLAN_IMPLEMENTATION.md` with the required ordering,
   bounded depth, plain-language synthesis, refresh, license, and
   untrusted-content rules. Template and ticket-writer integration tests prove
   NTB1.R1–R2 and the now-advisory TBU1.R4–R5 contract: ordinary loops do not
   re-run research; a builder-classified significant choice receives refresh
   guidance; and every workflow names the untrusted-content, privacy, execution,
   and license boundaries. V1 makes no runtime sandbox or semantic-detector
   claim.
4. **Distribution, parity, and docs.** Register the helper in `schema.ts`, add
   canonical collaborator tests, regenerate Cursor, Codex, and Claude assets
   from the canonical templates, and update README plus the workflow and
   hook/skill reference docs. The canonical hook gets rejection and acceptance
   wiring tests with real collaborators, phase preservation/advance, and
   artifact immutability. Generated-equality and existing host-adapter contract
   tests prove Claude, Codex, Cursor, and installed CLI routes consume that
   canonical implementation rather than duplicating validators. OpenAI Codex
   Cloud gets repository-guidance availability only; the docs and scenario
   avoid claiming a hard hook that surface does not expose. Installation
   lifecycle tests create a signal-free pre-v1 fixture
   with a recent date, upgrade it to v1, and prove both gates remain open; they
   also downgrade/uninstall and reinstall a v1-authored fixture, proving its
   customer artifact content is preserved and its retained signals reactivate
   validation without backfill.

Primary proof is integration for phase transitions and scaffold generation,
because those behaviors cross real collaborators and are visible to users.
Pure parsing permutations use unit tests for fast exhaustive coverage. Host
parity proves generated or reference equality to that executable boundary
instead of relabeling one call as several independent validators. The `@manual` Gherkin feature
remains the behavioral acceptance record; no fake step implementation will
claim an agent's qualitative research judgment or research safety is
executable.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://github.github.com/gfm/ | 2026-08-09 | 0.29-gfm | 0.29-gfm | GFM formally defines table headers, delimiter rows, cells, and pipe handling for the Markdown artifacts Safeword already ships. | Keep the evidence record readable, but accept only one exact header shape and deterministic row grammar. | GFM tables allow arbitrary inline text and escaped pipes; the v1 subset rejects pipe-bearing cells rather than attempting full Markdown rendering. |
| https://spec.commonmark.org/0.31.2/ | 2026-08-09 | CommonMark 0.31.2 | CommonMark 0.31.2 | CommonMark defines HTML comments as bounded HTML blocks, matching Safeword's existing invisible contract markers. | Use one exact preamble comment as the spec-side version marker and strip comments before section parsing. | CommonMark accepts many HTML forms; v1 accepts only the exact Safeword marker and treats altered syntax or placement as invalid. |

**Decision impact:** retained: current GFM and CommonMark specifications support
the existing direction of a strict readable subset, while making the no-pipe,
single-line v1 boundary explicit.
**Decision informed:** Evidence authoring format

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Evidence authoring format | Strict versioned Markdown sections and exact GFM-shaped tables ([GFM](https://github.github.com/gfm/)) | YAML/frontmatter records; fenced JSON validated by [JSON Schema 2020-12](https://json-schema.org/specification) | YAML introduces unordered mappings, implicit typing, and duplicate-key edge cases; JSON is deterministic but substantially worse for routine human editing. The selected subset keeps one artifact and one language while remaining parseable. |
| Parser architecture | One dependency-free pure helper shared by intake readiness and the implementation plan gate | Separate stage parsers; a generic Markdown AST dependency | Separate parsers invite drift; a full Markdown engine expands the dependency and attack surface for a deliberately narrow grammar. Stage-specific schemas can share marker, row, date, and result primitives. |
| Activation and migration | Paired ticket/spec v1 markers plus an independent `inspiration_contract_scaffold: v1` origin sentinel; any current signal or committed activation provenance activates and all three current signals are required; signal-free pre-v1 artifacts without provenance are exempt at every creation date | Release-date cutoff; current installed-version inference; marker pair alone; retroactive backfill | Cutoffs strand work created by older installs, current version does not prove creation provenance, and a pair alone cannot detect deletion of both markers. The sentinel proves scaffold origin before the first commit; Git history preserves that provenance afterward. Downgrade ignores the additive fields and reinstall reactivates retained or historically activated v1 artifacts. |
| Enforcement boundary | Extend the existing `define-behavior` readiness and `implement` plan gates | Add a new phase; stop-hook-only reminders; validation on every edit | Existing transitions are the irreversible decision boundaries. A new phase adds ceremony, reminders are soft, and per-edit checks add noise without stronger evidence. |
| Qualitative quality and research safety | Skills and independent review assess credibility, relevance, and comparability; [OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) informs the explicit untrusted-content guidance; code validates only explicit structure and bounds | LLM-as-gate scoring; fixed reference quota; an owned runtime sandbox in this feature | Subjective scoring is nondeterministic and a quota rewards filler. V1 promises guidance and review, not runtime isolation that Safeword does not own. |
| Host delivery | Change canonical templates/helpers, register them in schema, then regenerate/check host assets | Hand-edit generated host copies | Canonical generation preserves agent parity and prevents host-specific drift. |

Recommend **strict versioned Markdown backed by one shared pure validator**
because it is the only candidate that preserves the artifacts builders already
read while providing deterministic phase-boundary evidence. Fenced JSON was
close on validation strength but loses on everyday authoring and duplicates the
human-readable record.

**Premortem:** Six months from now this design most likely fails because the
Markdown grammar grows ad hoc exceptions; mitigate that now by exporting
stage-specific v1 schemas, rejecting ambiguity, and requiring a version bump
for incompatible syntax.

**Next:** implement activation and failure precedence in
`packages/cli/templates/hooks/lib/inspiration.ts` through a failing unit test
before adding any successful evidence row.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Inspiration is present by default with plain-language remediation at each host's available enforcement level, while technical builders retain explicit references, unsuccessful-search evidence, and review records. | `packages/cli/tests/integration/inspiration-intake-transition.test.ts` | |
| 1. Structure enforces; instructions suggest | Existing transition hooks require durable evidence structure; qualitative research quality and safety boundaries stay in guidance and independent review. OpenAI Codex Cloud remains guidance-only because Safeword owns no blockable transition boundary there. | `packages/cli/tests/hooks/inspiration.test.ts` | explicit-conflict |
| 2. Fire at boundaries, not every turn | Validation runs only when entering `define-behavior` or `implement`, and research refresh is guidance for significant new choices rather than every TDD loop. | `packages/cli/features/learn-from-exceptional-products.feature` | |
| 3. Add, never replace | New sections and helpers extend existing specs, plans, gates, and generated surfaces; signal-free pre-v1 tickets remain valid across upgrade, while downgrade/uninstall preserves customer artifacts. | `packages/cli/tests/hooks/inspiration.test.ts` | |
| 5. Correct and safe; then clear; then simple | A single named helper and exact v1 record shapes are preferred over a generic Markdown framework or duplicated stage parsers. | `packages/cli/templates/hooks/lib/inspiration.ts` | |

Architecture decisions honored:

- `ARCHITECTURE.md` — Schema as SSOT and reconciliation: the new deployed
  helper is template-first and registered once in `SAFEWORD_SCHEMA`.
- `ARCHITECTURE.md` — Product-Framing Layer in BDD Phase 0: the product scan
  stays between confirmed JTBDs and Rules in `spec.md`.
- `ARCHITECTURE.md` — plan-implementation as a gated planning phase: technical
  inspiration lives in `impl-plan.md` and is checked by its existing entry gate.
- `ARCHITECTURE.md` — generated Codex/Claude plugins and Cursor wrappers consume
  canonical skill sources rather than host-specific edits.

No new ADR is warranted: this is a reversible extension of established artifact,
gate, schema, and generation decisions rather than a new cross-feature
architectural direction.

## Known deviations

- **1. Structure enforces; instructions suggest:** OpenAI Codex Cloud receives the
  canonical BDD workflow but no Safeword-owned blockable transition hook, so the
  feature promises automatic guidance there rather than a hard block. The
  surface scenario and docs state that limit explicitly.

## Doc impact

- `README.md`: update the feature workflow summary and template inventory so
  product and implementation inspiration are visible in the top-level contract.
- `packages/website/src/content/docs/getting-started/workflow.mdx`: show Product
  Inspiration between JTBD and Rules and Implementation Inspiration inside the
  planning phase.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: document
  the automatic scans, deterministic content-or-search gate, and safety limits.

These updates ship in slice 4 after canonical behavior and parity tests are
green, so documentation describes verified behavior.

## Assessment triggers

- A second contract version needs different columns or nested/multiline values;
  reassess whether the strict table subset remains clearer than structured data.
- Another artifact or phase needs the same evidence model; extract only the
  already-proven stage schema API rather than broadening the parser preemptively.
- False blocks show ordinary Markdown escaping cannot be represented without
  ambiguity; specify and test a v2 grammar instead of weakening v1 in place.
- Safeword gains an owned research runtime or browser boundary; replace static
  safety-contract proof with executable isolation, effect logging, and refusal
  integration tests.
- A host stops consuming the canonical templates or transition hooks; add a
  host-native wiring proof before claiming parity for that surface.
