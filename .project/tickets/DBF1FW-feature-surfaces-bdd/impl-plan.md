# Implementation Plan: Let projects track feature surfaces during BDD

**Status:** implemented

## Approach

Riskiest assumption: the existing managed-file `configKey` path is enough for surfaces too, while the new runtime/context coverage check can stay advisory instead of becoming a persona-level validator. The cheapest proof is the configured-path suppression scenario plus a `safeword check` fixture where a feature affects Claude Code and OpenAI Codex but only tags Claude.

Test layers and order:

1. Integration: extend `reconcile-namespace-root.test.ts` to prove fresh setup, configured root, and existing authored surfaces in temp customer projects.
2. Integration: extend `reconcile-configured-paths.test.ts` for `paths.surfaces` suppression and reset-full preservation.
3. Unit: extend `namespace-root-defaults.test.ts` so `resolveConfiguredPath(cwd, 'surfaces')` derives from the resolved root and honors overrides.
4. Doc-presence: add BDD discovery and spec-template tests for canonical, Claude dogfood, and Codex dogfood copies where relevant.
5. Unit/CLI: parse `spec.md ## Surfaces` `Affected:` entries and report missing/stale `@surface.<slug>` feature-source tags as zero-exit advisories.
6. BDD: prove the concrete "only Claude, missing Codex" failure mode through `safeword check`.

Process boundary mocked: filesystem only through temp directories. No network or subprocess boundary is needed for the core contract.

## Decisions

| Choice | Alternatives considered | Rejected because |
| --- | --- | --- |
| Add `surfaces` to `ConfiguredPathKey` and schema `configKey` | Hard-code `<namespace-root>/surfaces.md` only | Would split surfaces from personas/glossary and block customer path overrides. |
| Use a managed file with `surfaces-template.md` | Owned file under `.safeword/` | Surfaces are project knowledge and must be customer-authored after scaffold. |
| Update BDD guidance text plus `safeword check` advisories rather than adding a hard hook gate | Validate/prompt via new blocking hook logic | v1 explicitly avoids hard-blocking implementation on surfaces while still surfacing coverage drift. |
| Define surfaces as runtime/context support | Define surfaces as screens, prompts, files, or docs pages | User clarification centered on Claude Code, OpenAI Codex, Cursor, web/mobile/MCP, and deployment modes; "places behavior appears" would miss parity failures. |
| Update installed dogfood copies alongside canonical templates | Template-only change | Existing tests assert shipped docs and dogfood copies stay aligned. |

## Arch alignment

- Honors Schema as Single Source of Truth: new template registration lives in `packages/cli/src/schema.ts`.
- Honors Reconciliation Over Copy: `surfaces.md` is managed, not owned, preserving user edits.
- Honors Template Separation: canonical template lives under `packages/cli/templates/`; dogfood `.project/surfaces.md` is local project knowledge.
- Keeps the coverage check in the existing scenario-lineage advisory path, avoiding a new command or blocking gate.

## Known deviations

skip: no deviations from recorded architecture; this extends the existing personas/glossary project-knowledge pattern.

## Assessment triggers

- If customers need validation of spec-local surface references, add a follow-up validator rather than making v1 intake blocking.
- If `surfaces.md` grows beyond a simple inventory, revisit whether it needs a parser parallel to personas/glossary.
- If users want surface coverage to block merges, promote the current `safeword check` advisory into an opt-in CI policy instead of changing default local workflow.
- If upgrade should avoid creating new managed project-knowledge files, revisit the managed-file contract globally instead of special-casing surfaces.
