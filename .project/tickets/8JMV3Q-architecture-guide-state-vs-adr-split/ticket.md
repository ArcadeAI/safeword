---
id: 8JMV3Q
slug: architecture-guide-state-vs-adr-split
type: task
phase: done
status: done
created: 2026-06-23T03:46:29.732Z
last_modified: 2026-06-23T03:54:00.000Z
---

# Architecture guide: state-vs-ADR split + polyglot boundary enforcement (Slice 4, scoped)

**Goal:** Split `architecture-guide.md` so it documents BOTH architecture-doc
genres — the machine-owned generated state doc (Slices 1–3) and the hand-curated
ADR/decision record — clearly distinguished, and make the boundary-enforcement
section polyglot instead of JS-only.

**Why:** Slices 1–3 now ship generated `architecture.generated.md` docs, but the
guide documents only the hand-curated ADR genre — a customer who finds a
generated doc has no guidance on what it is or why not to hand-edit it. And the
enforcement section tells every project to install `eslint-plugin-boundaries`
(JS-only), which is wrong for safeword's polyglot audience (Python/Go/Rust/dbt)
and inconsistent with what safeword actually generates (dependency-cruiser).

## Scope

1. **Genre split** — add a short orienting section near the top distinguishing
   the two architecture documents: the **generated state doc**
   (`architecture.generated.md`, machine-owned, "what the system is now",
   self-healing + enforced, monorepo root+leaves — don't hand-edit) vs the
   **hand-curated ADR/decision doc** (`ARCHITECTURE.md` / `paths.architecture`,
   "why we decided X"). The existing guide body is the ADR genre's how-to.
2. **Generated-genre section** — a compact new section documenting Slices 1–3:
   the generated path, the `generator:` ownership marker / don't-hand-edit rule,
   freshness via SessionStart self-heal, enforcement via
   `safeword architecture --check`/`--stage` + `architectureDocEnforcement`,
   and the monorepo root-index + colocated-leaf model. Points to the CLI; does
   not duplicate the per-flag detail.
3. **Polyglot boundary enforcement** — rewrite "Enforcement with
   eslint-plugin-boundaries" into language-agnostic concept + a per-language
   enforcement matrix: JS/TS → dependency-cruiser (safeword's generated
   mechanism; `eslint-plugin-boundaries` as a JS alternative), Python →
   import-linter, Go → compiler (build-time, no circular pkgs), Rust → compiler
   (module system). Mirrors the matrix the `/audit` skill already encodes.
4. **Parity + references** — update both `templates/guides/architecture-guide.md`
   and `.safeword/guides/architecture-guide.md` (byte-identical), and fix the
   SAFEWORD.md reference table so the guide is found for both genres.

## Out of scope

- The `/architecture` LLM-prose resync skill → deferred to **JT852Q** (first
  LLM-prose capability, separate design).
- Changing the generated-doc behavior itself (Slices 1–3 are done).
- Rewriting `data-architecture-guide.md` (only touch if a cross-reference breaks).

## Done when

- `architecture-guide.md` opens with a clear two-genre distinction; a reader who
  finds `architecture.generated.md` learns what it is and that it's machine-owned.
- The boundary-enforcement section is polyglot (concept + per-language matrix),
  no longer instructing every project to install a JS-only plugin.
- Both guide copies are byte-identical (parity green); SAFEWORD.md references
  resolve; lint (markdown + gherkin) + full suite green.
- An independent review confirms the split is non-duplicating and accurate to the
  shipped Slice 1–3 behavior.

## Work Log

- 2026-06-23T03:46:29Z Started: Created ticket 8JMV3Q.
- 2026-06-23T03:50:00Z Intake: Slice 4 scoped to the guide split + polyglot
  enforcement reconcile (resync skill deferred to JT852Q). User constraint:
  enforcement "has to work polyglot" → concept + per-language matrix, not a
  JS-only plugin. Next: write the split, update parity + references, review, verify.
- 2026-06-23T03:54:00Z Complete: wrote the two-genre split + generated-doc section
  - polyglot enforcement matrix; mirrored both guide copies + SAFEWORD.md (parity
    159 pairs green), markdown lint clean (1014 files). Independent review:
    PASS-WITH-NITS — every shipped-behavior claim verified against code, split
    non-duplicating, matrix correct; one in-scope nit (architecture-template.md
    both copies still prescribed eslint-plugin-boundaries with a now-dangling
    section anchor) FIXED → repointed to the polyglot section. No other dangling
    refs. Closing 8JMV3Q (full suite is the belt-and-suspenders confirm on a
    docs-only change).
