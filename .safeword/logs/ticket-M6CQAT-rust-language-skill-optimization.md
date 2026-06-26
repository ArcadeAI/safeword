---
ticket: M6CQAT
slug: rust-language-skill-optimization
created: 2026-06-25T05:41:08Z
---

# Work Log: Rust Language Skill Optimization

## 2026-06-25

- Created as the Rust-first child of `ARPCQA` / GitHub issue #430.
- Read the ticket-system, skill-authoring, schema-registration, and local testing
  guidance. The global testing-methodology path referenced by AGENTS was missing,
  so `.safeword/guides/testing-guide.md` was used.
- Inspected the existing Rust pack. It detects `Cargo.toml` and installs Clippy
  and rustfmt config only; it does not install language-specific agent behavior.
- Inspected `experiments/gepa-review-spec/`. Its dataset/task/evaluator/harness
  seams are reusable as a pattern, but Rust needs sandboxed repo checkout,
  patch application, and executable command scoring instead of static fixture
  set-matching.
- Captured the blocking quality gates from the plan review: sandbox untrusted
  third-party repo execution, macro-average by repository and model family, and
  block memorized or eval-aware optimizer output before template changes.
- Added intake artifacts: `spec.md`, `dimensions.md`, `user-stories.md`, and
  `test-definitions.md`. The ticket is now in `define-behavior`.
- Quality-review hardening pass tightened the sandbox contract: task metadata
  must pin Docker image identity by digest, reject Docker socket and privileged
  mode, define mount policy, and require non-root/rootless or user-namespace
  isolation.
- Implemented the first Rust experiment TDD slice. RED: `bun run --cwd
  experiments/gepa-language-skills/rust test` failed because `../src/dataset` was
  missing. GREEN: added the isolated experiment package/config and
  `src/dataset.ts`; the same command passed 4 tests. Formatting and markdownlint
  passed; ESLint reports `experiments/` files are intentionally ignored.
- Closed the quality-review sandbox gap. RED: a regression test proved generic
  local command/version runners were accepted. GREEN: the validator now rejects
  non-Docker runners and requires a digest-pinned Docker sandbox image; the Rust
  experiment suite passed 5 tests.
- Implemented the evaluator scoring slice. RED: evaluator tests failed because
  `../src/evaluator` was missing. GREEN: added `scoreRustTaskRun` and
  `feedbackForGepa`; required oracle failures hard-fail candidates, evaluation
  results retain side information, and optimizer feedback redacts split/eval
  leakage. The Rust experiment suite passed 8 tests.
- Implemented the transfer gate slice. RED: transfer tests failed because
  `../src/transfer` was missing. GREEN: added `aggregateRustScores`,
  `evaluateHeldoutGate`, and `reviewCandidateSkill`; scores macro-average by
  repository/model, held-out regression on either target model blocks the
  candidate, and repo/eval-specific skill text is rejected. The Rust experiment
  suite passed 12 tests.
- Added an isolated experiment `tsconfig.json` and `typecheck` script that reuse
  the existing CLI TypeScript binary without adding workspace dependencies. The
  experiment source typecheck passed.
- Implemented the pilot manifest and sandbox executor planning slice. RED:
  manifest/executor tests failed because the manifest loader and
  `../src/executor` were missing. GREEN: `tasks/pilot.json` covers the seven Rust
  pilot repositories at pinned refs, and `buildRustSandboxRunPlan` emits
  checkout, worktree copy, patch apply, and constrained Docker oracle steps. The
  Rust experiment suite passed 15 tests and typecheck passed.
- Quality-review fix for the sandbox runner/CLI slice: removed the host
  `timeout` command dependency from Docker argv, moved timeout enforcement into
  `createNodeCommandRunner`, mapped `prefetch-only` policy to Docker
  `--network none` for oracle execution, rejected path-traversing run ids, and
  rejected writable non-scratch host mounts. The Rust experiment suite passed 25
  tests and typecheck passed.
- Implemented the dependency prefetch/live execution slice. RED: prefetch tests
  failed because no dependency prefetch step existed, the pilot manifest still
  used `network: none`, and Cargo cache env vars were absent. GREEN:
  `network: prefetch-only` inserts a pre-patch `cargo fetch --locked` Docker
  step with network, while oracle Docker runs afterward with `--network none`;
  both prefetch and oracle invocations receive the sandbox timeout, and the pilot
  manifest now uses `prefetch-only` for all seven tasks. The Rust experiment
  suite passed 27 tests and typecheck passed.
- Implemented no-patch baseline support. RED: baseline tests failed because the
  executor always emitted `apply-patch`, the runner invoked `git apply
  undefined`, and the CLI rejected missing `--patch-file`. GREEN: executor plans
  now record either patch file or no patch; `no-skill` CLI runs may omit
  `--patch-file`, while named candidate skill runs still require a patch. The
  Rust experiment suite passed 31 tests and typecheck passed.
- Implemented the sandbox runner/artifact slice. RED: runner tests failed
  because `../src/runner` was missing. GREEN: `executeRustSandboxRun` executes
  checkout, worktree copy, patch application, and Docker oracle invocations
  through an injected command runner, then returns scored run artifacts.
  `appendRustRunArtifact` writes replayable JSONL records. The Rust experiment
  suite passed 17 tests and typecheck passed.
- Implemented the Node process runner and CLI slice. RED: CLI/process-runner
  tests failed because `../src/cli` and `../src/process-runner` were missing.
  GREEN: `createNodeCommandRunner` captures stdout, stderr, exit code, and
  duration from spawned commands; `runRustExperimentCli` defaults to dry-run,
  requires `--live` for real process execution, selects one pilot task, and
  writes JSONL artifacts. The Rust experiment suite passed 21 tests, typecheck
  passed, and the `run:pilot -- --dry-run` package script wrote one artifact
  line.
- Live-smoke hardening for the `fd` no-skill baseline. RED sequence: live Docker
  first failed because digest-only `rust@sha256:...` plus login Bash hid `cargo`;
  then full `fd` tests exposed macOS bind-mount filesystem semantics; then
  tmpfs scratch needed non-root writability, user-owned repo copy target, and
  `exec` mount options. GREEN: `bun run --cwd
  experiments/gepa-language-skills/rust run:pilot -- --live --task-id
  fd-cli-filesystem-bugfix --run-id live-fd-baseline --candidate-skill-id
  no-skill ...` passed with `cargo test --locked`, prefetch network allowed only
  before oracle, oracle Docker `--network none`, non-root user, read-only root
  filesystem, read-only repo mount, separate generated Cargo cache, and
  executable Linux tmpfs scratch.
- Final verification for this slice: Rust experiment suite passed 32 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for M6CQAT docs/log, ESLint passed, and the live no-skill `fd` baseline
  passed.
- Ran live no-skill baselines for the rest of the pilot. Initial results:
  `clap` and `ripgrep` passed; Tokio failed because the no-lock workspace tried
  to resolve crates.io during the offline oracle phase; Rustls failed because
  full workspace tests pulled in a libclang-dependent crate; Cargo full
  workspace timed out and exposed the need for Docker cidfile cleanup. GREEN:
  added Docker `--cidfile` cleanup on timeout, lock-aware prefetch, and
  repo-bounded oracles. Final live baseline results: `fd`, `clap`, `tokio`,
  `ripgrep`, `rustls`, `cargo`, and `rust-analyzer` all pass no-skill live
  baselines. Current bounded oracles: Tokio `cargo test --workspace --offline`,
  Rustls `cargo test -p rustls --locked`, Cargo
  `cargo test -p cargo --lib --locked`, and rust-analyzer
  `cargo test -p ide -p hir -p hir-def -p hir-ty --locked`.
- Final verification for this slice: Rust experiment suite passed 34 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for M6CQAT docs/log, ESLint passed, and no `rust:1.96` experiment
  containers were left running.
- Added the human-seed Rust candidate skill artifact and review path. RED:
  candidate tests failed because no loader or seed skill artifact existed.
  GREEN: `candidates/human-seed-rust/SKILL.md` is language-general experiment
  guidance, `src/candidate.ts` validates skill frontmatter and folder/name
  consistency, the CLI accepts `--candidate-skill-file`, rejects id mismatches
  or anti-memorization blockers, and artifacts record accepted candidate skill
  metadata. Verification: Rust experiment suite passed 39 tests, typecheck
  passed, and a package-level human-seed CLI dry-run wrote candidate metadata
  into the artifact.
- Final verification for this slice: Rust experiment suite passed 39 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for M6CQAT docs/log and candidate skill markdown, ESLint passed, and no
  `rust:1.96` experiment containers were left running.
- Added the reviewed-candidate matrix runner. RED: matrix tests initially failed
  because they used a stale task id instead of the current pilot manifest ids.
  GREEN: `src/matrix.ts` reviews the human seed candidate skill once, preflights
  that each selected task has `<task-id>.patch` in the patch directory, reuses
  the sandbox runner for each task, appends one JSONL artifact per task, and
  exits non-zero if any task is rejected. Added the package-level `run:matrix`
  script and tests for multi-task dry runs, missing-patch preflight, and
  candidate id mismatch.
- Final verification for this slice: Rust experiment suite passed 42 tests,
  experiment typecheck passed, targeted Prettier passed, and a package-level
  `run:matrix -- --dry-run` smoke accepted `fd-cli-filesystem-bugfix` with the
  human seed candidate metadata. Root ESLint continues to ignore `experiments/`;
  forcing `--no-ignore` applies repo-wide rules outside this experiment's
  tsconfig and is not a valid experiment lint check.
- Hardened matrix patch preflight. RED: an empty task patch reached command
  runner construction. GREEN: matrix patch collection now reads each selected
  patch file and rejects empty or non-unified-diff content before creating a dry
  or live runner, so placeholder patches cannot count as candidate work.
- Final verification for this slice: Rust experiment suite passed 43 tests,
  experiment typecheck passed, targeted Prettier passed, and a package-level
  `run:matrix -- --dry-run` smoke accepted `fd-cli-filesystem-bugfix` using a
  minimal diff-shaped patch.
- Added the matrix comparison reporter. RED: reporter tests failed because
  `../src/report` did not exist. GREEN: `src/report.ts` reads baseline and
  candidate Rust run artifact JSONL, validates artifact shape, macro-averages
  both sides, emits per-repository/model deltas, and evaluates the held-out gate
  over selected model families. Added the package-level `compare:matrix`
  command.
- Final verification for this slice: Rust experiment suite passed 47 tests,
  experiment typecheck passed, targeted Prettier passed, and a package-level
  `compare:matrix` smoke wrote an accepted comparison report from synthetic
  baseline/candidate artifacts.
- Fast-forwarded the detached worktree from
  `b0b0212458cf35faedfed6aff107bb1bd53bdbb7` to current `origin/main`
  `09d989654446ff1af322d7f73dc0f50369d8f8f6` before applying review fixes.
- Used figure-it-out for the Cargo cache storage choice. Decision: use a
  per-run Docker-managed volume, not tmpfs or a writable host bind, because
  `cargo fetch` must populate cache state that survives into a later offline
  oracle container.
- Addressed the quality-review findings. RED: tests failed for unbounded setup
  invocations, writable host cache bind behavior, missing held-out coverage, and
  incomplete candidate review blockers. GREEN: all runner invocations now carry
  sandbox timeouts; executor plans create, mount, and clean up a per-run Docker
  cache volume; held-out gates reject missing model/repository coverage; and
  candidate review blocks sandbox escape plus non-Rust command guidance.
- Final verification for this slice: Rust experiment suite passed 51 tests,
  experiment typecheck passed, targeted Prettier passed, and package-level
  `run:matrix` and `compare:matrix` smokes passed.
- Added the Rust optimizer loop scaffold. RED: optimizer tests failed because
  `../src/optimize` did not exist. GREEN: `src/optimize.ts` now loads failed run
  artifacts, sends sanitized feedback plus base skill text to an injectable
  mutation adapter, writes proposed candidate skills, runs the existing Rust
  candidate review gate, persists rejected proposals for audit, and writes a
  skip report when no failed artifacts are available. Added the package-level
  `optimize:skill` fake-adapter entrypoint.
- Final verification for this slice: targeted optimizer tests passed, Rust
  experiment suite passed 56 tests, experiment typecheck passed, and a
  package-level `optimize:skill -- --fake-adapter` smoke produced an accepted
  candidate from a failed live artifact.
