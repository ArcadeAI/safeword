---
id: 505
slug: keep-shipped-hooks-host-lintable
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/505
created: 2026-07-28T00:00:00Z
last_modified: 2026-07-29T02:00:00Z
scope:
  - Keep every shipped TypeScript template compatible with the supported ESLint baseline used by host projects.
  - Add release validation for the schema-declared distributed TypeScript surface: baseline lint, typed-preset parse/config loading, and strict installed-shape TypeScript checking.
  - Keep package-owned Codex runtime template mirrors under parity validation.
out_of_scope:
  - Adding a host-project lint ignore for .safeword/hooks.
  - Normalizing the existing template corpus to every stylistic and security rule in the full typed host preset.
done_when:
  - Shipped TypeScript hooks have no errors from the supported ESLint baseline.
  - Every physical shipped hook loads without a fatal parser/config diagnostic under the actual typed host preset.
  - Every physical shipped hook typechecks in a generated installed-shape fixture without customer dependencies.
---

# Keep shipped hooks host-lintable

**Goal:** Let a Safeword upgrade complete without shipped hooks blocking the host project's lint.

**Why:** Installed hooks are part of the host repository's lint surface and can otherwise break a customer commit after an upgrade.

**Type:** Bug

**Scope:** Remove the reported lint violations from the shipped TypeScript hook
templates and add release-lane validation for every schema-declared shipped TypeScript template:
the supported host baseline, fatal parser/config loading under Safeword's typed
preset, and strict typechecking in its installed shape.

**Out of Scope:** Ignoring `.safeword/hooks/**` in generated host configs,
changing unrelated ESLint policies, or validating arbitrary customer dependency versions.

## Decision

Use the preferred upstream contract: shipped templates stay in host lint scope
and must pass the supported ESLint baseline. The release test derives the exact
TypeScript install surface from `SAFEWORD_SCHEMA`, including parser/config
integration and strict typechecking in a temporary installed fixture using
Safeword's package-pinned development types. Full-preset policy cleanup is
separately scoped because the pre-existing corpus has a broad backlog unrelated
to issue #505. Codex runtime assets remain managed (they must not be installed
in customer repositories) but opt into dogfood parity so template edits cannot drift.

**Figure-it-out:**

- [x] Phase 1: Frame the choice as lint-clean templates versus a generated host ignore.
- [x] Phase 2: Compare upstream validation, a host ignore, and both together.
- [x] Phase 3a: Examine ESLint rule semantics, package distribution, and template/reconciliation ownership.
- [x] Phase 3b: Validate the two rules with current ESLint documentation and inspect Safeword's published `templates` contract.
- [x] Phase 4: Commit to upstream lint validation and minimal source fixes.
- [x] PR-review follow-up: expand the fixture to all schema-declared distributed
  TypeScript templates, because statusline and BDD files are customer-facing and
  the former already exposed the same unchecked-index defect.
- [x] PR-review follow-up: preserve Codex runtime adapters as managed files while
  opting them into parity; moving them to owned files would change installation semantics.
- [x] PR-review follow-up: remove the narrow exported Claude-session convenience
  helper; the existing pure resolver already owns precedence and two explicit
  environment projections keep the shipped public surface smaller.

## Done When:

- [x] The literal BOM and dead-store initializations no longer create host-lint failures.
- [x] A release test checks every shipped TypeScript hook with the supported baseline.
- [x] A release test loads every shipped hook through the typed host preset and fails on fatal parser/config diagnostics.
- [x] A release test strictly typechecks the installed-shape hook tree with package-owned `@types/bun` support.

## Test Definitions:

- [x] RED — The baseline reported five current violations across the shipped hook tree.
- [x] GREEN — The release test reports no errors after the minimal template fixes.
- [x] RED — The installed-shape strict typecheck exposed 22 real template diagnostics; the minimal fixes preserve each hook's fail-open behavior.
- [x] GREEN — The installed fixture typechecks all physical hook templates without customer dependencies.
- [x] REFACTOR — The test has one owner, discovers the shipped hook tree instead of maintaining a file list, and centralizes Claude session resolution for the two retro filing hooks.
  - [x] RED — The schema-driven fixture caught the statusline unchecked-index error and includes the BDD step templates.
  - [x] GREEN — The fixture typechecks every schema-declared TypeScript template in its real destination path and the Codex runtime mirrors have parity coverage.

## Work Log

- 2026-07-28T00:00:00Z Started: Triaged GitHub issue #505 and created this scoped task record.
- 2026-07-28T00:00:00Z Figure-it-out: chose host-lint-clean templates plus upstream release validation; a host ignore would conceal defects in shipped code and leave customers without lint coverage.
- 2026-07-28T07:22:02Z RED/GREEN: added a release-lane ESLint gate for the shipped hook tree; it found five current errors. Replaced the literal BOM and removed four dead-store initializations without changing fallback behavior.
- 2026-07-28T07:22:02Z Verified: focused gate, package typecheck, root lint, formatting, and the release suite passed (23 tests). The first full release attempt had one unrelated five-second timing timeout in `pre-tool-git-bare-fix`; its isolated rerun and the clean full rerun passed.
- 2026-07-28T14:38:21Z Quality review closed a coverage gap: added a package-owned `@types/bun` installed-fixture typecheck and fixed 22 strict diagnostics across the physical hook tree. The typed host preset now also loads that fixture and fails on fatal parser/config errors; full-preset policy diagnostics remain explicitly out of scope because the existing corpus has a separate broad backlog.
- 2026-07-28T14:38:21Z Refactor/audit: centralized Claude session environment resolution for the two retro filing hooks and synchronized all changed hook templates to dogfood copies.
- 2026-07-28T14:59:03Z Final verification: release validation (25 tests), direct release-test lint, root lint, build, Gherkin acceptance, parity (195 pairs / 8 contracts), `bun audit`, and two independent quality reviews passed. Reverted the unrelated root patch upgrades found during audit; the required CLI-local Bun types remain. The complete Vitest suite runner hung after workers exited under isolated locks, recorded as a local evidence limitation in `verify.md`.
- 2026-07-29T00:50:00Z Reopened for PR review: nine actionable findings identified. The release fixture omitted schema-declared statusline and BDD TypeScript templates, and Codex runtime assets were managed-but-not-paired. The follow-up keeps each ownership contract intact while extending validation and parity.
- 2026-07-29T01:00:00Z Review follow-up GREEN: strict typechecking now covers 106 schema-declared TypeScript templates in real destination paths, including statusline and BDD steps. The new Codex parity opt-in surfaced and healed one additional stale runtime mirror. Focused release tests, parity tests, direct lint, formatting, parity (200 pairs / 8 contracts), and an independent fresh review passed.

## Refactor Ledger

Scout findings, ordered leaf-first. Each entry is one behavior-preserving change
with its own test and commit.

- [ ] P1 — Eliminate the duplicate parity-pair membership traversal in
  `scripts/parity-check.ts`; the CLI count must derive from `runParity` so it
  cannot drift from check/sync coverage.
- [ ] P2 — Rename the broadened release test and its temporary-fixture prefix
  from “hooks” to “templates”.
- [ ] P3 — Split the release fixture builder into named materialization and
  tsconfig-writing helpers without changing fixture lifetime or contents.
- [ ] Struck — Do not extract the two Claude environment projections: the
  exported helper was deliberately removed during review, so reintroducing an
  abstraction would recreate a rejected shipped API.
- [ ] Struck — Do not merge baseline and fatal-diagnostic formatting: their
  distinct predicates make the test policy legible.
- [ ] Struck — Keep `as unknown as` for the regex tuple: direct conversion is
  rejected by the strict fixture compiler.
