---
id: M6CQAT
slug: rust-language-skill-optimization
type: feature
parent: ARPCQA
phase: implement
status: in_progress
created: 2026-06-25T05:35:12.388Z
last_modified: 2026-06-26T02:49:25Z
external_issue: https://github.com/ArcadeAI/safeword/issues/430
scope:
  - Rust-first slice of ARPCQA. Prove the optimization and evaluation loop for a
    language-general Rust skill before building the Go slice.
  - Create an isolated `experiments/gepa-language-skills/rust/` harness modeled on
    `experiments/gepa-review-spec/`, without adding GEPA or experiment-only
    dependencies to `packages/cli`.
  - Build a Rust pilot dataset from `repo-corpus.md` with whole-repository
    train, validation, and final held-out splits.
  - Require sandboxed execution for every third-party repo task. No secrets, no
    Docker daemon socket, no privileged mode, digest-pinned Docker image identity,
    non-root/rootless or user-namespace isolation, bounded time, bounded
    resources, read-only host mounts except scratch space, and explicit network
    policy.
  - Use executable coding-task oracles as the primary signal: `cargo test`,
    `cargo check`, `cargo clippy`, benchmarks, or deterministic repo verifiers.
  - Score no-skill, human seed skill, and optimized skill on both Claude Opus and
    GPT/Codex, with visible per-model and per-repository results.
  - Human-distill useful optimizer output into a general `rust` skill only after
    the held-out gates pass.
out_of_scope:
  - Go skill work. Go follows after this Rust slice proves the harness shape.
  - Full 30-repo Rust scale before the pilot evaluator proves trustworthy.
  - Shipping raw GEPA output, repo-specific tricks, or eval-aware text.
  - Installing the Rust skill through the language pack before held-out
    improvement, anti-gaming review, and model-transfer gates pass.
  - Continuous optimization infrastructure or remote hosted eval service.
done_when:
  - The Rust pilot has explicit train, validation, and final held-out splits by
    whole repository; no repository appears in more than one split.
  - Every Rust task declares a digest-pinned Docker sandbox image, checkout
    ref, allowed commands, timeout, resource limits, network policy, mount
    policy, no Docker socket/privileged mode, non-root/rootless or user-namespace
    policy, and executable oracle.
  - The evaluator records rich side information: task prompt, model family,
    candidate skill id, agent trace, patch summary, test/build/lint output,
    timings, diagnostics, and score breakdown.
  - Correctness is a hard floor. A candidate with failing required oracles cannot
    pass because of smaller diffs, shorter time, or cleaner style.
  - Aggregate scoring macro-averages by repository and model family, and exposes
    Rust held-out results separately for Claude Opus and GPT/Codex.
  - The gate rejects a candidate that regresses either target model family on
    final held-out repositories.
  - Feedback given to GEPA avoids split names, expected defect counts, fixture
    regularity, optimizer jargon, and other eval-shape leakage.
  - Candidate review blocks repo memorization, sandbox-escape suggestions,
    hard-coded corpus commands, and language-irrelevant text.
  - `packages/cli/templates/skills/rust/SKILL.md` is created only from
    human-distilled, language-general rules and is revalidated against held-out
    Rust tasks before product wiring.
  - Rust language-pack installation tests prove Rust projects receive the `rust`
    skill while non-Rust projects do not.
---

# Optimize the Rust language skill with held-out repositories

**Goal:** Prove a Rust language skill can improve coding-agent behavior across
held-out Rust repositories, then distill the safe general rules into safeword's
language-pack surface.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Parent

Child of [ARPCQA](../ARPCQA-go-rust-repo-corpus/ticket.md), mirrored in
[GitHub issue #430](https://github.com/ArcadeAI/safeword/issues/430).

## Rust-First Decision

Start with Rust because the Rust corpus has enough variation to exercise the
hard parts of language-general skill optimization: ownership and borrowing,
async runtimes, macros, crate workspaces, error handling, unsafe boundaries,
CLI ergonomics, and library compatibility.

The first deliverable is the evaluator, not the final skill. The mainline
`experiments/gepa-review-spec/` spike showed that a candidate can game an eval
while looking good numerically. This slice therefore treats GEPA output as
proposal material and makes sandboxed held-out evaluation plus human review the
blocking gate.

## Pilot Repository Mix

Use a small pilot before the full 30-repo Rust corpus. Keep the split by whole
repository and pick tasks that can run in a bounded sandbox.

- **Train candidates:** `sharkdp/fd`, `clap-rs/clap`, `tokio-rs/tokio`
- **Validation selection:** `BurntSushi/ripgrep`, `rustls/rustls`
- **Final held-out:** `rust-lang/cargo`, `rust-lang/rust-analyzer`

The exact task count can start small, but every task must be executable and
must preserve the whole-repository split.

## Work Log

- 2026-06-25T05:35:12.388Z Started: Created ticket M6CQAT.
- 2026-06-25T05:35:32Z Intake: Made this the Rust-first child of ARPCQA/#430.
  Scope starts with the isolated experiment and evaluator gates, not product
  language-pack wiring. Captured quality-review findings as blocking
  requirements: sandbox every third-party repo task, macro-average by model and
  repository, and reject eval-aware or memorized optimizer output.
- 2026-06-25T05:41:08Z Define-behavior: Added JTBD, dimensions, user stories,
  and RED test definitions for the Rust-first experiment/eval slice.
- 2026-06-25T05:43:36Z Quality-review: tightened the sandbox contract to require
  digest-pinned Docker image identity, no Docker daemon socket, no privileged
  mode, restricted mounts, and non-root/rootless or user-namespace isolation.
- 2026-06-25T05:53:15Z Implement: Started the first TDD slice for the isolated
  Rust experiment scaffold and dataset metadata validation.
- 2026-06-25T05:58:05Z Implement: First Rust experiment TDD slice is green.
  Added `experiments/gepa-language-skills/rust/` with isolated package/config,
  dataset validation, split leakage checks, and sandbox/oracle metadata tests.
  Verification: RED import failure first, then 4 Vitest tests passed; Prettier
  and markdownlint passed. ESLint intentionally ignores `experiments/`.
- 2026-06-25T06:06:06Z Quality-review fix: added a regression test proving a
  bare local command/version runner was accepted, then narrowed the first
  harness to digest-pinned Docker runners only. Verification: Rust experiment
  suite passed 5 tests.
- 2026-06-25T06:08:48Z Implement: Added the first evaluator slice. RED:
  evaluator tests failed because `../src/evaluator` did not exist. GREEN:
  `scoreRustTaskRun` enforces required oracle failure as a hard floor, records
  side information for GEPA-style reflection, and `feedbackForGepa` redacts
  split/eval-shape leakage. Verification: Rust experiment suite passed 8 tests.
- 2026-06-25T06:15:12Z Implement: Added the transfer gate slice. RED:
  transfer tests failed because `../src/transfer` did not exist. GREEN:
  `aggregateRustScores` macro-averages by repository/model, `evaluateHeldoutGate`
  rejects held-out regressions on either Claude Opus or GPT/Codex, and
  `reviewCandidateSkill` blocks repo memorization and eval-aware text.
  Verification: Rust experiment suite passed 12 tests.
- 2026-06-25T06:20:15Z Verify: Added an isolated experiment `tsconfig.json`
  and `typecheck` script that reuse the existing CLI TypeScript binary without
  adding workspace dependencies. Verification: Rust experiment typecheck passed.
- 2026-06-25T06:38:02Z Implement: Added the pilot manifest and sandbox executor
  planning slice. RED: manifest/executor tests failed because the manifest
  loader and `../src/executor` did not exist. GREEN: `tasks/pilot.json` now
  covers the seven Rust pilot repositories at pinned refs, and
  `buildRustSandboxRunPlan` emits checkout, worktree copy, patch apply, and
  constrained Docker oracle steps. Verification: Rust experiment suite passed
  15 tests and typecheck passed.
- 2026-06-25T15:03:42Z Implement: Added the sandbox runner/artifact slice.
  RED: runner tests failed because `../src/runner` did not exist. GREEN:
  `executeRustSandboxRun` executes checkout, worktree copy, patch application,
  and Docker oracle invocations through an injected command runner, then returns
  scored run artifacts. `appendRustRunArtifact` writes replayable JSONL records.
  Verification: Rust experiment suite passed 17 tests and typecheck passed.
- 2026-06-25T15:13:32Z Implement: Added the Node process runner and CLI slice.
  RED: CLI/process-runner tests failed because `../src/cli` and
  `../src/process-runner` did not exist. GREEN: `createNodeCommandRunner`
  captures stdout, stderr, exit code, and duration from spawned commands;
  `runRustExperimentCli` defaults to dry-run, requires `--live` for real process
  execution, selects one pilot task, and writes JSONL artifacts. Verification:
  Rust experiment suite passed 21 tests, typecheck passed, and `bun run --cwd
  experiments/gepa-language-skills/rust run:pilot -- --dry-run ...` wrote one
  artifact line.
- 2026-06-25T20:25:19Z Quality-review fix: removed the host `timeout` command
  dependency from Docker argv, moved timeout enforcement into
  `createNodeCommandRunner`, mapped `prefetch-only` policy to Docker
  `--network none` for oracle execution, rejected path-traversing run ids, and
  rejected writable non-scratch host mounts. Verification: Rust experiment suite
  passed 25 tests and typecheck passed.
- 2026-06-25T20:31:53Z Implement: Added the dependency prefetch/live execution
  slice. RED: prefetch tests failed because no dependency prefetch step existed,
  the pilot manifest still used `network: none`, and Cargo cache env vars were
  absent. GREEN: `network: prefetch-only` now inserts a pre-patch
  `cargo fetch --locked` Docker step with network, while oracle Docker runs
  afterward with `--network none`; both prefetch and oracle invocations receive
  the sandbox timeout, and the pilot manifest now uses `prefetch-only` for all
  seven tasks. Verification: Rust experiment suite passed 27 tests and typecheck
  passed.
- 2026-06-25T20:49:00Z Implement: Added no-patch baseline support. RED:
  baseline tests failed because the executor always emitted `apply-patch`, the
  runner invoked `git apply undefined`, and the CLI rejected missing
  `--patch-file`. GREEN: executor plans now record either patch file or no
  patch; `no-skill` CLI runs may omit `--patch-file`, while named candidate
  skill runs still require a patch. Verification: Rust experiment suite passed
  31 tests and typecheck passed.
- 2026-06-25T21:09:44Z Live-smoke hardening: ran the no-skill `fd` baseline in
  live Docker mode and fixed the runner issues it exposed. Docker images must
  now use tagged digest refs, the container script uses non-login Bash, the
  patched repo is mounted read-only and copied into executable Linux tmpfs, and
  Cargo cache/target data live in a separate generated cache mount. Verification:
  live `fd` baseline passed with `cargo test --locked`, oracle Docker
  `--network none`, non-root user, read-only root filesystem, and no privileged
  or Docker-socket access.
- 2026-06-25T21:12:08Z Verify: Rust experiment suite passed 32 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for the M6CQAT docs/log, ESLint passed, and the live no-skill `fd`
  baseline passed.
- 2026-06-25T22:34:08Z Implement: Ran live no-skill baselines across the
  remaining pilot repos and hardened the manifest/runner from the results.
  `clap`, `ripgrep`, `rustls`, `cargo`, `rust-analyzer`, and `tokio` now pass
  live baseline oracles. Fixes included Docker cidfile cleanup on timeout,
  lock-aware dependency prefetch, Tokio's offline oracle, Rustls package-scoped
  oracle, Cargo library-scoped oracle, and rust-analyzer IDE/HIR package-scoped
  oracle.
- 2026-06-25T22:35:54Z Verify: Rust experiment suite passed 34 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for M6CQAT docs/log, ESLint passed, and no `rust:1.96` experiment
  containers were left running.
- 2026-06-25T23:06:50Z Implement: Added the human-seed Rust candidate skill
  artifact and review path. `candidates/human-seed-rust/SKILL.md` is
  language-general experiment guidance only; `src/candidate.ts` loads and
  validates candidate skill files, the CLI accepts `--candidate-skill-file`,
  rejects candidate id mismatches or review blockers, and run artifacts record
  accepted candidate metadata. Verification: Rust experiment suite passed 39
  tests, typecheck passed, and a human-seed CLI dry-run smoke wrote candidate
  metadata into the artifact.
- 2026-06-25T23:08:42Z Verify: Rust experiment suite passed 39 tests,
  experiment typecheck passed, targeted Prettier check passed, markdownlint
  passed for M6CQAT docs/log and candidate skill markdown, ESLint passed, and no
  `rust:1.96` experiment containers were left running.
- 2026-06-25T23:16:10Z Implement: Added the reviewed-candidate matrix runner.
  `src/matrix.ts` reviews the candidate skill once, preflights per-task patch
  coverage from a patch directory, reuses the sandbox runner for selected pilot
  tasks, appends one JSONL artifact per task, and exits non-zero if any task is
  rejected. Added `run:matrix` and matrix tests for multi-task dry runs, missing
  patch preflight, and candidate id mismatch.
- 2026-06-25T23:16:10Z Verify: Rust experiment suite passed 42 tests,
  experiment typecheck passed, targeted Prettier passed, and a package-level
  `run:matrix -- --dry-run` smoke accepted `fd-cli-filesystem-bugfix` with the
  human seed candidate metadata. Root ESLint continues to ignore
  `experiments/`; forcing `--no-ignore` applies repo-wide rules outside this
  experiment's tsconfig and is not a valid experiment lint check.
- 2026-06-25T23:31:23Z Implement: Hardened matrix patch preflight. The matrix
  runner now rejects empty or non-unified-diff patch files before constructing a
  dry-run or live command runner, so placeholder patch files cannot be counted
  as candidate work.
- 2026-06-25T23:31:23Z Verify: Matrix test RED first, then Rust experiment
  suite passed 43 tests, experiment typecheck passed, targeted Prettier passed,
  and a package-level `run:matrix -- --dry-run` smoke accepted
  `fd-cli-filesystem-bugfix` using a minimal diff-shaped patch.
- 2026-06-25T23:38:04Z Implement: Added the matrix comparison reporter.
  `src/report.ts` reads baseline and candidate Rust run artifact JSONL, validates
  artifact shape, macro-averages both sides, emits per-repository/model deltas,
  and evaluates the held-out gate over selected model families. Added
  `compare:matrix` for package-level reporting.
- 2026-06-25T23:38:04Z Verify: Reporter test RED first, then Rust experiment
  suite passed 47 tests, experiment typecheck passed, targeted Prettier passed,
  and a package-level `compare:matrix` smoke wrote an accepted comparison report
  from synthetic baseline/candidate artifacts.
- 2026-06-25T23:52:45Z Maintenance: Fast-forwarded the detached worktree from
  `b0b0212458cf35faedfed6aff107bb1bd53bdbb7` to current `origin/main`
  `09d989654446ff1af322d7f73dc0f50369d8f8f6` before applying the review fixes.
- 2026-06-25T23:59:14Z Figure-it-out: chose a per-run Docker-managed Cargo
  cache volume over tmpfs or a writable host cache bind. Cargo cache must persist
  between prefetch and offline oracle containers, while Docker-managed volumes
  avoid exposing a writable host path.
- 2026-06-25T23:59:14Z Implement: Addressed quality-review findings. Runner
  process invocations now all receive sandbox timeouts; executor plans create,
  mount, and clean up a per-run Docker cache volume; held-out gates reject
  missing model/repository coverage; candidate review blocks sandbox escape
  suggestions and non-Rust command guidance.
- 2026-06-25T23:59:14Z Verify: Review-fix tests were RED first, then Rust
  experiment suite passed 51 tests, experiment typecheck passed, targeted
  Prettier passed, and package-level `run:matrix` and `compare:matrix` smokes
  passed.
- 2026-06-26T00:43:10Z Implement: Added the Rust optimizer loop scaffold.
  `src/optimize.ts` loads failed Rust run artifacts, passes sanitized feedback
  and the base skill text to an injectable mutation adapter, writes proposed
  candidate skills under a candidate-id directory, reviews them with the
  existing Rust candidate gate, and persists accepted, rejected, or skipped
  optimization reports. Added the `optimize:skill` fake-adapter package script.
- 2026-06-26T00:43:10Z Verify: Optimizer tests were RED first, then targeted
  optimizer tests passed, the Rust experiment suite passed 56 tests, experiment
  typecheck passed, and a package-level `optimize:skill -- --fake-adapter` smoke
  produced an accepted candidate from a failed live artifact.
- 2026-06-26T00:50:55Z Quality-review/refactor follow-up: Confirmed the named
  quality-review and refactor passes had not been run before the scaffold
  commit, then ran them. Added a malformed-artifact regression and tightened the
  optimizer JSONL boundary so records missing feedback-required fields are
  rejected with file/line context before sanitized feedback generation.
- 2026-06-26T00:51:58Z Verify: Rust experiment suite passed 57 tests,
  experiment typecheck passed, targeted Prettier and markdownlint passed,
  `git diff --check` passed, and package-level
  `optimize:skill -- --fake-adapter` still produced an accepted candidate.
- 2026-06-26T01:25:14Z Implement: Added provider-backed Rust optimizer
  adapters. `src/model-adapters.ts` now supports OpenAI Responses and
  Anthropic Messages via direct `fetch`, injectable env/fetch for tests, JSON
  response parsing, provider API-key checks, sanitized prompt construction, and
  provider HTTP error reporting. `optimize:skill` now accepts `--provider
  openai|anthropic`, optional `--model`, and optional `--max-tokens`.
- 2026-06-26T01:25:14Z Quality-review/refactor: Checked current OpenAI and
  Anthropic API docs. The review found Anthropic Opus 4.8 should not receive
  non-default sampling parameters, so the adapter now omits `temperature`.
  Refactor extracted shared provider JSON/error handling across both adapters.
- 2026-06-26T01:25:14Z Verify: Provider tests were RED first, then targeted
  adapter/optimizer tests passed, the Rust experiment suite passed 62 tests,
  experiment typecheck passed, and targeted Prettier passed. Root ESLint still
  ignores `experiments/` by project configuration.
- 2026-06-26T01:53:15Z Provider smoke: Ran the real provider-backed optimizer
  against a disposable failed Rust artifact under `/tmp`. OpenAI
  `gpt-5.1-codex-max` wrote
  `/tmp/safeword-rust-provider-smoke/openai/provider-openai-smoke-rust-v1/`
  and Anthropic `claude-opus-4-8` wrote
  `/tmp/safeword-rust-provider-smoke/anthropic/provider-anthropic-smoke-rust-v1/`.
  Both candidates passed `reviewCandidateSkill` with no blockers, and a grep
  check found no repo ids, task ids, split names, optimizer vocabulary, sandbox
  bypass guidance, or non-Rust guidance in the generated skill bodies.
- 2026-06-26T01:53:15Z Decision: Kept provider-smoke candidates out of the
  repository for now. Anthropic's candidate produced the most actionable
  borrow-checker section for the failed `E0382`-style artifact, while OpenAI's
  candidate stayed closer to the human seed. The next step is human
  distillation into an experiment candidate before matrix evaluation.
- 2026-06-26T02:49:25Z Implement: Human-distilled the provider-smoke outputs
  into `candidates/distilled-rust-ownership-v1/SKILL.md`, preserving the
  actionable borrow-checker guidance without copying raw provider output or
  introducing repo-specific/eval-aware text. Added a candidate review test for
  the distilled skill.
- 2026-06-26T02:49:25Z Verify: Candidate test was RED first, then the
  distilled candidate passed `reviewRustCandidateSkill`. Rust experiment suite
  passed 64 tests, experiment typecheck passed, and targeted Prettier plus
  markdownlint passed.
