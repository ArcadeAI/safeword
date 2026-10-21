# Audit and refactor follow-up

## Full refactor pass (2026-10-21)

Baseline: 17bfde5fd; runtime/test source at 536dd1fe7 passed every job in
remote run 39686478082. Two fresh read-only scouts covered config/command
ownership and hook/process/test boundaries. No candidates were truncated.

Leaf-first execution ledger:

- [x] Protect configuration-format precedence and malformed helper responses
  with eight characterization cases before moving code. Direct API/process
  probes passed all eight on the baseline. ESLint passed. The Vitest attempt
  was lock-limited and started no tests; final CI must execute the expanded suites.
- [ ] Precompute immutable config filename precedence once, preserving the
  shared filename source and every directory-search rule.
- [ ] Rename the caller-directory config variable to distinguish it from the
  project root. This distinction directly underlies the reported bugs.
- [ ] Name the version capability probe as a predicate; preserve its checks,
  errors and oldest-version behavior.
- [ ] Extract helper invocation and JSON validation into one local function;
  retain containment, availability/version checks and warning deduplication at
  the caller. No new shipping or schema-managed file.
- [x] Decline a normalizer registry, generic subprocess abstraction, repository-
  wide containment helper and further executor split: no duplicated contract
  warrants those interfaces.
- [x] Decline shared truncation delivery and cross-suite fixture abstractions:
  installed-template/CLI shipping boundaries and fake/real tool environments
  differ intentionally. The common mechanism would be larger than the duplication.
- [x] Exclude signal-listener, exact stream-cap and aggregate-context behavior
  changes from this behavior-preserving pass; existing limitations remain explicit.
- [ ] Re-run the diff audit, then the independent quality-review coordinator;
  resolve every error, record optional suggestions, and verify the final source.

Each refactoring is a separate change, proof and scoped commit. The local
Vitest lock currently belongs to worktree 3811; do not change its lock or process.

## Earlier refactor pass

User authorized remote verification, audit and refactoring after the initial
delivery. Remote CI run 39649296690 tests commit 4795aefdb.

Two independent read-only scouts covered configuration parsing, process
lifetime, orchestration, tests and host collaborators. No Vitest process was
started by either scout. Findings are ordered leaf-first; mutations will be
serial and independently tested/committed.

- [x] Fix the audit finding separately from refactoring: warning-only output
  bypassed the 16 KiB cap before Codex wrapped it in additionalContext. Cap that
  fallback at the Codex conversion boundary; preserve the shared hook's current
  structured-output cap. A real Codex probe reproduced 30039 bytes before the
  fix and 16381 bytes afterward. Both boundary regression cases pass.
- [x] Extract YAML parsing from parseConfig, preserving its merge settings,
  legacy-octal rejection, alias bound and subsequent validation unchanged.
  Eighteen real-linter policy checks passed across both versions after this
  extraction; ESLint and typecheck passed. Generated plugin carriers refreshed.
- [x] Name stdout/stderr character limits. Preserved current chunk accumulation,
  truncation notices and measured units exactly. Three source-hook regressions
  passed after the change; ESLint passed. Generated carriers refreshed.
- [x] Decline further executor extraction: passing five pieces of execution
  context to a new helper adds an interface without removing duplicated intent.
  The current configuration, process and command ownership is already clear.
- [x] Decline a generic subprocess framework or class: the local signal and
  child ownership remains easier to follow.
- [x] Preserve design.md as the historical reviewed proposal. Current status,
  implementation evidence and compatibility correction are separate records;
  editing that snapshot would obscure the review history.

Protection: existing configuration/lifecycle/real-linter suites, plus the
reproducible final manual probes. The local Vitest lock remains occupied by
another worktree; remote runs provide automated verification. No dependency
upgrades or customer policy changes belong to these refactors.

The first remote run found three validation gaps: the hidden-helper inventory
needed hook go-lint, the Go golden-path hook fixtures needed the built CLI under
test, and the generated module inventory needed the new go-lint module. Those
are corrected. Its Linux v2.13.2 binary cannot decode Go 1.27 export data; the
matrix now pairs that linter with the repository's Go 1.25 baseline. The v2.0.0
remote lane passed all 30 tests. Five targeted checks for inventory, warning
feedback and golden-path formatting passed locally after the corrections.
