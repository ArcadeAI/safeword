---
id: P58R22
slug: gate-parser-divergence-test
type: task
phase: implement
status: in_progress
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.657Z
last_modified: 2026-06-02T04:58:17.657Z
---

# Differential test pinning hook vs CLI markdown-section parsers

**Goal:** Add a differential test that feeds shared fixtures to the hook-side parser and the CLI-side parser and asserts they agree, so the deliberate cross-runtime copies can't silently drift.

**Why:** P1 — the `## Jobs To Be Done` section is parsed by three independent implementations across two runtimes (hook [jtbd.ts](packages/cli/templates/hooks/lib/jtbd.ts), CLI [scenario-coverage.ts](packages/cli/src/utils/scenario-coverage.ts) + [markdown-sections.ts](packages/cli/src/utils/markdown-sections.ts)). The duplication is intentional and documented (hooks can't import the CLI dist), but the copies **diverge** on HTML-comment handling: the hook's `stripComment` treats mid-line `<!--` (after content) as opening a block comment that swallows subsequent lines, while the CLI's `computeSkipMask` only opens on a line that _begins_ with `<!--` (CommonMark-correct). No test guards them against further drift.

**Scope:** A test (in `tests/hooks/` or a shared fixtures module) that runs both comment-strippers / section-walkers over a shared fixture set — including the divergent case (a JTBD line with a trailing unclosed `<!--`) — and asserts matching parses. Decide per case whether to (a) make the hook CommonMark-correct to match the CLI, or (b) document the divergence as accepted and assert the current behavior. Prefer (a) if cheap.

**Out of scope:** unifying the parsers into one module (impossible — runtime boundary); the persona-code derivation (G9BXE9).

**Done when:** a differential test exists and fails if either parser's comment/section handling drifts from the other; the mid-line `<!--` case is explicitly covered.

## Work Log

- 2026-06-02T04:58:17.657Z Started: Created ticket P58R22
