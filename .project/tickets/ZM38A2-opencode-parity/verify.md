# Verify: ZM38A2 OpenCode parity

Verified locally on 2026-08-27. Exact-head GitHub CI is required before merge.

## Delivery evidence

- Local CLI suite: 8,597 passed and 13 skipped across 533 files.
- Local full acceptance: 1,483 passed and 3 skipped; 68,144 steps passed and 4
  skipped.
- OpenCode BDD proof: 587 scenarios and 10,954 steps passed.
- Repository build, TypeScript/Astro checks, documentation contracts,
  dependency audits, schema drift, domain documentation, and diff-scoped
  architecture audit passed.
- Release contract suite: 40 passed across 10 files. CLI, Claude plugin,
  generated workflow, package publication, and authored-diff formatting checks
  passed.
- Independent whole-ticket quality review approved the final implementation
  after its lifecycle, conformance, recovery, and portability findings were
  resolved. The refactor review found no further behavior-preserving
  simplification worth adding.
- The local aggregate verifier's only nonzero lane was root `mypy`, caused by
  duplicate module names in unchanged `experiments/python-skill-eval/control`
  fixtures also present on `origin/main`.

**PR Scope:** The branch diff against `origin/main` matches ZM38A2: adapter
standardization, OpenCode catalogue/profile/conformance/status delivery,
compatibility tests, CI wiring, and public documentation. No unrelated product
changes are included; no pull request is currently open.

## Done-when evidence

- Explicit OpenCode selection installs the native catalogue and versioned
  profile plugin while omitted selection preserves the Claude-plus-Codex
  default.
- A real credential-free OpenCode 1.18.23 process discovered a Safeword
  command, agent, and canonical skill; the forbidden sentinel produced no side
  effect, while the disarmed control did.
- Status reports installation, activation, lifecycle capability, and
  conformance independently with deterministic remediation.
- Reconciliation tests cover install, upgrade, mixed-host use, conflicts,
  uninstall, shared assets, and user-owned OpenCode content.
- Adapter contract tests cover Claude Code, Codex, OpenCode, and Cursor.

## Evidence integrity waiver

Alex explicitly authorized this waiver on 2026-08-27 after reviewing the gap:
only 36 of 99 scenarios had complete historical RED/GREEN/REFACTOR commit
records, leaving 63 scenarios and 181 individual entries without reconstructable
step evidence. The ledger marks those entries `skip` and points here; it does
not invent SHAs or claim the missing history occurred.

This waiver is limited to historical per-step commit linkage. It does not waive
behavior, conformance, regression, review, or CI verification. Future feature
work must record each step when it occurs.

## Audit

Diff-scoped architecture audit found no dependency violations or configuration
drift. The whole-ticket quality review found no arbitrary waits, weak changed
assertions, mock-only behavior, missing boundary coverage, dead code, or
cross-scenario refactor worth adding. Audit passed for the delivered change.
