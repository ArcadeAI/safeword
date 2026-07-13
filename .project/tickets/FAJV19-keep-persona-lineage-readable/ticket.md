---
id: FAJV19
slug: keep-persona-lineage-readable
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/FAJV19-keep-persona-lineage-readable/spec.md'
  - 'scenario-gate: packages/cli/features/keep-persona-lineage-readable.feature'
  - 'plan-implementation: packages/cli/features/keep-persona-lineage-readable.feature'
  - 'implement: .project/tickets/FAJV19-keep-persona-lineage-readable/impl-plan.md'
  - 'verify: .project/tickets/FAJV19-keep-persona-lineage-readable/test-definitions.md'
scope:
  - Derive new persona codes as 3–4 uppercase alphanumeric characters, using mnemonic name fragments and bounded collision suffixes.
  - Keep explicitly-authored legacy 2–6 character codes valid and resolvable so existing customer personas and lineage do not break on upgrade.
  - Carry the resolved persona code unchanged through JTBD IDs and Gherkin Rule tags; scenario names remain plain English.
  - Update persona authoring guidance, BDD examples, hook-side derivation, dogfood personas, and the architecture decision record to the canonical 3–4 letter convention.
out_of_scope:
  - Bulk-renaming codes embedded in completed tickets, historical Gherkin, or existing customer repositories.
  - Adding a user-authored alias registry, an interactive persona editor, or automatic file mutation during `safeword check`; deterministic former-derived aliases are retained only for compatibility.
  - Changing Gherkin tag grammar, Rule numbering, or scenario-name conventions beyond the persona-code segment.
done_when:
  - A newly derived persona code is always 3–4 characters or produces a clear validation error when the name cannot yield a conformant code.
  - Explicit legacy codes that satisfy the existing 2–6 character compatibility pattern still validate and resolve.
  - CLI and installed-hook derivation agree for single-word, two-word, three-plus-word, punctuation, digit, and collision-relevant inputs.
  - Templates and BDD guidance show 3–4 letter codes flowing unchanged from personas.md into JTBD and Gherkin lineage.
  - Focused persona, JTBD-gate, Gherkin, schema, lint, and type-check verification passes.
created: 2026-07-13T22:08:35.793Z
last_modified: 2026-07-13T22:08:35.793Z
---

# Keep persona lineage readable for builders

**Goal:** Give every persona a canonical 3–4 letter code and carry it unchanged into JTBD and Gherkin lineage without breaking legacy projects.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-13T22:08:35.793Z Started: Created ticket FAJV19
- 2026-07-13T22:10:00.000Z Intake: User confirmed implementation after the figure-it-out recommendation. Canonical 3–4 letter generation, legacy explicit-code compatibility, and no historical bulk rewrite are accepted boundaries.
- 2026-07-13T22:11:00.000Z Intake complete: Scope, out-of-scope, and done-when are bounded; failure modes cover collision overflow and legacy breakage; open questions are resolved. Advanced to define-behavior.
- 2026-07-13T22:12:00.000Z Define-behavior complete: Seven scenario groups plus two outlines cover canonical derivation, collision and short-name edges, legacy compatibility, invalid bounds, and cross-runtime lineage guidance. Advanced to scenario-gate.
- 2026-07-13T22:14:00.000Z Scenario review: Fresh reviewer found four blockers (vacuous lineage assertion, missing CLI↔hook parity, weak legacy preservation proof, undefined collision exhaustion). Revised to nine scenario groups with deterministic installed-asset coverage and explicit rejection boundaries.
- 2026-07-13T22:15:00.000Z Scenario re-review: Strengthened collision parity across CLI and hook, made legacy resolution identify the exact persona/code, and added explicit 3/4-character recovery boundaries without adding scenario groups.
- 2026-07-13T22:16:00.000Z Scenario gate passed: Independent reviewer confirmed all nine scenario groups pass vacuous-pass, AODI, determinism, boundary, negative-case, surface, and wiring checks. Review stamp recorded; advanced to plan-implementation.
- 2026-07-13T22:18:00.000Z Plan review: Added a real setup/install test that executes the copied hook, tied evidence to every significant decision, and settled `codeError` as the shared non-throwing failure discriminator.
- 2026-07-13T22:19:00.000Z Plan gate passed: Independent reviewer returned PASS. Plan is parse-valid with six content sections, status planned, nine scenario proofs, all affected surfaces, and the riskiest legacy-compatibility assumption first. Advanced to implement.
- 2026-07-13T23:14:00.000Z Quality review correction: Reconstructed the former six-character derivation and source-ordered collision aliases in both runtimes, prevented explicit canonical codes from reserving duplicate collision slots, and replaced source-only asset checks with real setup-installed hook and authoring-asset fixtures.
- 2026-07-13T23:22:00.000Z Quality review passed: Fresh review approved dependency hygiene, documentation, security, scope discipline, and real setup-installed hook wiring. Advanced to verify.
- 2026-07-13T23:50:00.000Z Verify: Persona-focused unit, integration, installed-hook, documentation, and walkthrough tests pass 143/143; Gherkin passes 429 scenarios with 3 skipped; configured build, lint, and typecheck lanes pass. Repository-wide verification remains red on two unrelated pre-existing fixtures (Rust clippy autofix and cleanup-zombie process discovery), so the ticket remains in verify.
