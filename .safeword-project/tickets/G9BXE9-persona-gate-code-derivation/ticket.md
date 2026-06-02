---
id: G9BXE9
slug: persona-gate-code-derivation
type: task
phase: done
status: done
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.608Z
last_modified: 2026-06-02T05:33:00.000Z
---

# Hook JTBD gate must accept derived persona codes (align with documented behavior)

**Goal:** Make the intake-exit JTBD gate resolve persona references the same way the skill documents — including auto-derived short codes — so a correctly-authored spec is never silently blocked.

**Why:** P0 — the only finding that silently breaks correct user input. `knownPersonaRefs` in [jtbd.ts:88](packages/cli/templates/hooks/lib/jtbd.ts) only emits a persona's literal name plus an _explicit_ `(CODE)`. So a persona written as bare `## Platform Operator` with a JTBD referencing `**Persona:** PO` is **denied** — even though [DISCOVERY.md:38](packages/cli/templates/skills/bdd/DISCOVERY.md) promises "codes auto-derive (`Platform Operator` → `PO`)" and the CLI's own `lookupPersonaReference` ([personas.ts](packages/cli/src/utils/personas.ts)) derives and even suggests on casing. The gate is stricter than its own docs.

**Scope:** Port the code-derivation logic from `derivePersonaCode` ([personas.ts:56](packages/cli/src/utils/personas.ts)) into the hook's `knownPersonaRefs` (deliberate cross-runtime copy — hooks can't import the CLI dist; this boundary is already documented at [jtbd.ts:1-11](packages/cli/templates/hooks/lib/jtbd.ts)). The gate must still reject genuinely-unknown personas; it just stops rejecting derived codes. Sync the template change to `.safeword/hooks/` (template = source of truth for tests).

**Out of scope:** casing-suggestion UX in the gate (the gate denies; the agent/`safeword check` path owns suggestions); unifying the two parsers (covered by P58R22).

**Done when:** a JTBD referencing a derived code against a bare-named persona passes the gate; an unknown persona still denies; a regression test in `tests/hooks/jtbd.test.ts` pins both.

## Work Log

- 2026-06-02T04:58:17.608Z Started: Created ticket G9BXE9
- 2026-06-02T05:04Z RED: add failing test — `knownPersonaRefs` must include the derived code for a bare-named persona (`Platform Operator` → `PO`); unknown persona still denies.
- 2026-06-02T05:11Z GREEN: ported `derivePersonaCode` into `knownPersonaRefs` (jtbd.ts); bare-named personas now contribute their derived code + combined form. Synced template → `.safeword/hooks/` (identical). 32/32 tests pass (jtbd unit + ac-gate + jtbd-gate integration); parity-check clean (116 pairs + 3 contracts). Done-when met — awaiting user confirmation before marking done.
- 2026-06-02T05:16Z REFACTOR: extracted `addCodeForms(references, name, code)` helper to collapse the duplicated code+combined-form blocks in `knownPersonaRefs`. Behavior unchanged; 32/32 still pass; dogfood re-synced identical.
- 2026-06-02T05:33Z Complete: /verify green (full suite 2361/2361, lint+build clean), verify.md committed (7a15599e). Closed by user confirmation. status/phase → done.
