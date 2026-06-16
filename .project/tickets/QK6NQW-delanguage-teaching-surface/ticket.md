---
id: QK6NQW
slug: delanguage-teaching-surface
type: task
phase: intake
status: in_progress
created: 2026-06-16T13:07:39.023Z
last_modified: 2026-06-16T13:07:39.023Z
---

# Show non-JS examples in skills, guides, and doc templates

**Goal:** Skills, guides, and doc-templates should teach with language-neutral or multi-language examples, not TypeScript as the only language.

**Why:** A Python/Go/Rust user reading the shipped teaching material sees only TS examples and JS-only enforcement, signalling they're a second-class citizen on a tool that claims to support them.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 2-C. Model to follow: `SAFEWORD.md:132-136` already does multi-language dependency guidance well.

## Findings (file:line)

- `guides/testing-guide.md:144-402` — all examples ` ```typescript `; `playwright.config.ts`, `bun run dev:test`, "Vitest/Jest".
- `guides/architecture-guide.md:340-349` — boundary enforcement is `eslint-plugin-boundaries` + `bun add -D` only; no import-linter (Python) / depguard (Go) equivalent.
- `doc-templates/architecture-template.md:65` — bakes *"Boundaries enforced via eslint-plugin-boundaries"* into the customer-filled template.
- `skills/testing/SKILL.md` (10× ` ```typescript `), `skills/refactor/SKILL.md:69/97/115`, `guides/design-doc-guide.md:70`, `doc-templates/design-doc-template.md:25/45/61` — illustrative code is all TS.
- `guides/context-files-guide.md:240` — *"@package.json for available npm commands."*
- `skills/bdd/TDD.md:31-33`, `skills/bdd/SCENARIOS.md:207` — BDD RED step prescribes TypeScript step defs + vitest skeleton.

## Acceptance criteria

- [ ] Pervasive TS-only examples replaced with language-neutral pseudocode or paired multi-language examples.
- [ ] Architecture boundary-enforcement guidance lists import-linter/depguard alongside eslint-plugin-boundaries; doc-template generalized.
- [ ] No customer-facing guide hard-codes `package.json`/npm as the only manifest.

## Work Log

- 2026-06-16T13:07:39.023Z Started: Created ticket QK6NQW
