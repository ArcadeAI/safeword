---
id: 0FA865
slug: preserve-intermediate-edits
type: task
phase: verify
status: in_progress
created: 2026-11-08T23:27:33.769Z
last_modified: 2026-11-08T23:27:33.769Z
---

# Preserve unfinished edits for coding agents

**Goal:** Resolve #2810 and #2809 by making post-edit JS/TS diagnostics non-mutating

**Why:** Whole-file fixes between edits rewrite unrelated lines and delete imports before later edits use them.

## Scope

Claude, Codex (shared Claude lint hook), and Cursor post-edit JS/TS checks report diagnostics without applying fixes. Explicit helper fix mode and other languages retain existing behavior.

## Done when

- Hook entry tests preserve pending imports and unrelated formatting for ESLint, Biome, and Ultracite.
- Claude receives diagnostics and Cursor retains its existing marker behavior.
- Existing explicit fix-mode tests pass; generated surfaces, lint, types, and test lanes have recorded results.

## Root Cause

The hook invokes whole-file fix commands immediately after each edit. This removes temporarily unused imports and changes untouched code. Mutation timing is the cause; import resolution is not involved. The existing test preset disables some unused-import rules, narrowing but not removing the risk in host configurations.

## Design decision

Post-edit JS/TS checks become observational; explicit lint actions retain mutation. Changed-line filtering cannot safely distinguish imports spanning multiple edits; scheduling delayed fixes requires new state. The local check-only option avoids both failure classes. Tradeoff: automatic JS/TS Prettier formatting is deferred to explicit formatting or commit tooling. Real hook-entry tests cover Claude and Cursor; Codex invokes the shared Claude hook.

## Test evidence

- Focused GREEN: 34 tests passed across host-toolchain and post-edit-preservation suites.
- Tests mock external tool processes only and assert preserved bytes and diagnostic delivery.
- Initial implementation preceded recorded RED evidence; no historical RED commit is claimed.
- Project-wide typecheck passed after a frozen-lockfile forced reinstall repaired missing AJV files.
- Independent Claude review approved both passes, including strengthened diagnostic and marker assertions.
- User approved updating existing tests to require check-only behavior and preserved contents. Codex hook assertions and matching integration assertions now reflect that requirement.
- Codex wiring confirmed: collectPostToolLintContexts executes post-tool-lint.ts with tool_input.file_path.
- Approved Codex tests now require check-only argv and exact preservation of a pending import and unrelated unformatted code.
- Root formatter acceptance was reconciled with the new contract. Positive process/diagnostic checks prevent startup failures from falsely satisfying preservation assertions; targeted acceptance passes 10/10.
- Independent Claude approved the expanded code/test packet (5e6ec2bf-abb6-48c3-95a3-98cde606f479) and the strengthened acceptance packet (c5e4eb8d-4a26-46c3-a10e-5dede07b96c0).
- Review suggestions retained as non-blocking limits: root Biome acceptance may exercise unavailable-tool warnings; real local Biome/Ultracite mutation regression coverage is in hook-entry and host-toolchain suites. Cursor preserves its prior silent diagnostic handling. Other-language mutation policy is separate work.
- All five generated surfaces regenerated and lifecycle fixtures verified before the final stable-source full-suite run. Parity: 276 pairs and 11 contracts in sync.

## Out of scope

- Changing Python, Rust, SQL, shell, or document post-edit mutation policy.
- Installing or activating global Claude/Codex profiles.
- Unrelated UTF-8 diagnostic truncation behavior.

## Work Log

- 2026-11-08T23:27:33.769Z Started: Created ticket 0FA865
