# Work Log — Y2HCNJ (JTBD as Phase 0 artifact)

Feature. Epic DZ2NM5 child #4. Depends on 7YN5QB (personas ✓) + K7N2QM (configurable paths ✓), both done.

## Session 2026-05-28 — intake / converge

### Epic decisions that gate this ticket (locked)

- **D1 product-first order:** orientation → JTBD → AC → engineering scope/done-when → self-test.
- **D2 storage:** new per-ticket `spec.md` sibling. Sections: Intent → References → Personas (refs) → Vocabulary → JTBDs (nested AC later) → Outcomes. `ticket.md` keeps scope/out_of_scope/done_when frontmatter + phase machine + work log + `**Goal:**` stub + `**See:** spec.md` pointer. `**Why:**` DROPPED from ticket template.
- **D4 features only.** **D5 new tickets only**, routed by `spec.md` presence.

### Resolved by existing ticket scope (no user input needed)

- JTBD form: "When I…, I want…, so I can…".
- One persona per JTBD → persona overlap produces multiple JTBDs (arcade's choice).

### Code-surface map (from Explore)

- `packages/cli/templates/spec-template.md` — does NOT exist; must create.
- `packages/cli/src/utils/ticket-writer.ts:85-110` — `renderTicketMarkdown` inline string; has `**Goal:**` (102) + `**Why:**` (104). ticket.md scaffolded inline, NOT from a file template.
- `packages/cli/src/commands/ticket-new.ts:24-67` — creates ticket.md only; type enum `patch|task|feature`.
- `src/schema.ts` — managedFiles pattern (personas.md L576-584, glossary.md L586-594: `{ template, configKey }`). Per-ticket artifacts (ticket.md/test-definitions.md/dimensions.md) are NOT in schema → spec.md follows suit (no registration).
- `validatePersonaReference(cwd, input)` → `{status:'valid',match} | {status:'unknown',suggestion?}` in `src/utils/personas.ts`.
- `templates/hooks/pre-tool-quality.ts:230-300` — intake-exit gate on test-definitions.md creation: requires scope/out_of_scope/done_when frontmatter, phase≠intake, and (features) dimensions.md OR `skip: <reason>`. JTBD gate slots here. Template at templates/hooks/, deployed to .safeword/hooks/ — MUST sync.
- `.claude/skills/bdd/DISCOVERY.md` + paired `packages/cli/templates/skills/bdd/DISCOVERY.md` — Load personas / Load glossary sub-steps; JTBD sub-step slots after Load glossary, before Understanding.
- `templates/SAFEWORD.md` Phase 1 Clarify — needs JTBD mention.
- Tests: tests/utils/{personas,glossary}-ref.test.ts, tests/commands/check.test.ts, tests/integration/discovery-*-substep.test.ts as patterns.

### Open decisions for user (converge)

1. Gate strictness when personas.md empty (JTBD needs a persona, but 7YN5QB allows "proceed without"). Lean: mirror dimensions.md `skip:<reason>` escape valve.
2. Numbering boundary vs XT1FFM. Lean: Y2HCNJ establishes JTBD-level id (`<slug>.<persona><n>`); XT1FFM extends to AC/scenario + coverage checks.
