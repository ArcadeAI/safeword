# Preserve unfinished edits across supported languages — verification

Implementation checkpoint: 7b31ad97b on codex/preserve-language-edits. Delivery
scope is the change above e40f35db01396677042079c698ee9f2f671b4ae3; the existing
JS/TS and eval work is stack ancestry. This follow-up has not been published.

## Verify Checklist

**Test Suite:** ✓ 12095/12095 tests pass — CLI 11744, relay 198, collector 153; 13 existing skips. The plan's repeat CLI and collector runs also passed. Go experiment compiled with no test files. Focused validation separately passed 246 tests across twelve files.
**Gherkin:** ✅ Acceptance lane passes — 599/599 scenarios and 11786/11786 steps; 52/52 proof tests also pass.
**Build:** ✅ Success — complete generated plan passed, including CLI, relay, collector and documentation site.
**Lint:** ✅ Clean — closing root ESLint and Gherkin validation passed.
**Typecheck:** ✅ Clean — complete generated plan passed, including package TypeScript, Astro (zero errors/warnings/hints) and five Python source files.
**Scenarios:** All 0 scenarios marked complete — bug task uses the inline regression plan, with no scenario ledger or new feature behavior.
**Refactor:** ✅ Completed — extracted Go package checking from configuration and temporary-file lifetime handling to satisfy existing complexity limits; no further structural change warranted.
**PR Scope:** ✅ Diff matches ticket scope above the recorded delivery base; generated mirrors and documentation support the same check-only contract. Earlier JS/TS and eval work remains separately tracked stack ancestry.
**Dep Drift:** ⚠️ Two pre-existing website dependencies are not named individually in ARCHITECTURE.md: astro-mermaid and satteri. No dependency manifest or lockfile changed in this delivery; ESLint plugins are covered as tooling and by the existing plugin family entry.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — extends the existing fix:false option through each language branch and native checker modes.
**Experience:** ✅ No new friction — automatic checks require no additional user action; explicit fixes remain available.
**Surface Evidence:** ✅ 2/2 shared lint entrypoints have recorded process-boundary proof; the existing Codex adapter is covered by the full suite. Language-tool limitations are described below.
**Evidence limits:** ⚠️ SQLFluff is not installed locally; SQL behavior is proven at the external-process boundary. Native profile upgrade failed as recorded below. Local verification passed; the user accepted the documented implementation-review exception. No new-branch CI or published release is claimed.

Audit passed with delivery base e40f35db0: dependency-cruiser checked 529 modules
and 910 dependencies with no violations; learning and complete domain audits
exited successfully. Whole-repository dead-code, duplication and dependency
upgrade discovery were intentionally outside the diff-scoped audit.

## Behavioral evidence and limits

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude and Cursor post-edit hooks | post-edit-language-preservation and post-edit-other-languages tests, destructive external-tool doubles | Exact edited/sibling bytes retained and distinct positive diagnostics; original writers failed the RED matrix |
| Codex native adapter | Existing commands/codex-hook.test.ts cases in the passing full suite; collectPostToolLintContexts source inspection | Native edits dispatch the same packaged post-tool-lint.ts; Go diagnostic and warning bounds retained |
| Python/Ruff | Real Ruff 0.16.5 with configured fix=true and fix-only=true | Pending import and unrelated formatting preserved; F401 and formatting feedback retained |
| Go package checking | Real Go context tests with issues.fix=true and sibling source | Explicit --fix=false preserves both files; formatting diff and lint findings retained |
| Rust package checking | Real Cargo/Clippy and rustfmt manual check | Edited/sibling bytes preserved; exit-zero warnings and formatting diffs retained |
| Generic formatting and shell | Real installed Prettier JSON and unsupported-shell checks | JSON unchanged with formatting feedback; unsupported shell stays quiet without suppressing ShellCheck findings |
| SQL/dbt and host Prettier | External-process boundary regressions | SQL fix opt-in cannot enable writes in check mode; both checker outputs retained; no real SQLFluff-version claim |
| Explicit fix helpers | Existing lint-config-fallback and lint-sql-branch tests; explicit Rust destructive characterization | Default writer commands retained; these are distinct from direct formatter/configuration golden paths |

Walked a developer from an unfinished source edit through the automatic hook;
worst step = receiving diagnostics for temporarily invalid code; new steps vs
before = 0. Exact pending-import/source preservation and useful feedback held.

OpenCode's existing tool.execute.after handler records lifecycle activity only;
it has no automatic lint/formatter writer to change in this delivery. No host
capability was added or parity claimed beyond the existing shared dispatch.

There is no ticket or parent Killer Demo. No new live model eval was needed:
deterministic hook/process checks prove this contract more cheaply. Independent
review calls are separate model usage, not free or included in the earlier eval
cost reported for the ancestor ticket.

The Python sensitivity probe rejects isolated hook copies that omit either lint
or format checking while accepting the unchanged implementation. Production
template hash remained fe611e9e7514790df226e63e4b391ae49b50df2c519dd8fd362afe2cda67aedc.
Its result is .project/tmp/9C4YFN/python-sensitivity.json. Tool modes preserve
source through Safeword's lint/format invocations; this is not a sandbox for
arbitrary project build scripts or third-party tool internals.

## Independent review and closure policy

Complete authored-source review c499adda-f427-4dee-ab06-31518652a24a approved
after distinct Python lint/format witnesses addressed review db687e4e's finding.
Latest six integration-file review d98613d5-d4ad-4f41-8040-dfa54672f8c6 also
approved. Sibling preservation belongs to the dedicated hook/context tests,
rather than being duplicated in every golden path. The shared assertion helper
was inspected directly: it checks process status, reports tool infrastructure
failures and returns stdout plus stderr. Redundant fallback signal/status
assertions remain; their old ordering comment does not affect proof strength.
The virtual-root Rust test now requires both Clippy and rustfmt availability.

The implementation phase guard requires one receipt covering the entire branch
since main, including ancestor tickets. There are currently 67 required files,
while review packets accept at most 64. Actual 66-file and final 67-file
dispatches were rejected in preflight with REVIEW_PACKET_INVALID and
recovery.requires_human=true; the final output is
.project/tmp/9C4YFN/phase-review-capacity-67.json. Separate approvals do not satisfy
that single-receipt guard. No gate was disabled or receipt forged. On
2026-11-14T23:32:41Z the user replied "accept" to using the completed separate
reviews for local closure. The supported write-review-stamp helper recorded
that explicit implementation-phase exception with --skip and the actual review
IDs. The ticket then advanced to verify; other phase gates remain applicable.

Two earlier full verification attempts were interrupted after exposing old
write expectations and are not green evidence. The later six-file regression
attempt passed 165/166: its one failure matched a word boundary against escaped
Rust JSON output. The assertion now parses additionalContext before matching
the actual error, preserving the requirement for positive syntax feedback.
The corrected canonical rerun passed 166/166. The complete verification plan
subsequently exited zero from frozen production and test sources.

The first full workspace pass completed successfully: CLI 11,744 passed with
12 existing skips across 729 files; relay 198 passed with one existing skip;
collector 153 passed. That is 12,095 passing tests and 13 existing skips.
The authoritative verification plan's repeat CLI and collector passes also
succeeded with identical counts. Acceptance passed all 599 scenarios and
11786 steps; all 52 proof tests passed. Builds and typechecks passed for every
detected project. No source or test code changed between these observations.

Supply-chain lanes exited zero: Bun checked 1173 packages without findings;
uv checked 39 packages without known vulnerabilities/adverse statuses;
pip-audit reported no known vulnerabilities. Go's symbol scan found zero
reachable vulnerabilities; it also reported one advisory in imported packages
and fourteen in required modules whose vulnerable symbols are not called.
These are not a claim of zero transitive advisories. No dependency changed.
The website build retained non-blocking chunk-size, empty i18n collection and
duplicate 404-route warnings; Astro typechecking had zero warnings.

Raw complete verification: .project/tmp/9C4YFN/verify-complete.log (exit zero).
Other retained evidence includes targeted-80.log, integration-166.log,
integration-review.json, python-sensitivity.json and phase-files.json in the
same directory. Mirrors and all five generated surfaces were officially
regenerated and checked before the source checkpoint; subsequent edits only
changed tests and ticket evidence. Six changed test files also passed a
read-only Prettier check without alteration.

The required bootstrap retry (`bunx --bun safeword@latest codex install`) failed
with a reported loaded-plugin 1.2.0 versus required 1.1.0 mismatch and left
project hooks unchanged. Repository checks use the local CLI source and pinned
development launcher; this evidence does not claim a native profile upgrade.
