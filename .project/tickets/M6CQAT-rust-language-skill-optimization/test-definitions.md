# Test Definitions: Rust language skill optimization

Feature source: [user-stories.md](./user-stories.md)

These definitions are intentionally RED until the Rust experiment and product
wiring exist. The first implementation slice should create the isolated
experiment scaffold and dataset/evaluator tests before authoring the final skill.

## Rule: The Rust optimization experiment is isolated and leak-resistant

### Scenario: Experiment dependencies stay out of the shipped CLI

- [x] RED 2026-06-25T05:54:56Z — new experiment suite failed before
      implementation because `../src/dataset` did not exist.
- [x] GREEN 2026-06-25T05:56:32Z — Rust experiment suite passed, including the
      CLI dependency isolation guard.
- [x] REFACTOR 2026-06-25T05:58:05Z — no extraction needed; formatting check
      stayed clean.

Given the Rust GEPA experiment needs optimizer/runtime dependencies  
When the experiment scaffold is installed under `experiments/gepa-language-skills/rust/`  
Then experiment dependencies are declared only under that experiment  
And `packages/cli/package.json` is unchanged by GEPA-only packages

### Scenario: Repository splits reject leakage

- [x] RED 2026-06-25T05:54:56Z — dataset module missing.
- [x] GREEN 2026-06-25T05:56:32Z — validator accepts disjoint repository splits
      and rejects a repository reused across train/heldout.
- [x] REFACTOR 2026-06-25T05:58:05Z — no extraction needed; formatting check
      stayed clean.

Given the Rust pilot dataset contains train, validation, and held-out tasks  
When the dataset loader reads the manifest  
Then no repository id appears in more than one split  
And the loader fails if a held-out repository appears in train or validation

### Scenario: Task metadata requires a sandboxed executable oracle

- [x] RED 2026-06-25T05:54:56Z — dataset module missing.
- [x] GREEN 2026-06-25T05:56:32Z — validator rejects missing/unsafe sandbox
      metadata, tag-only Docker images, Docker socket access, privileged mode,
      and missing oracle commands.
- [x] REFACTOR 2026-06-25T05:58:05Z — no extraction needed; formatting check
      stayed clean.
- [x] RED 2026-06-25T06:05:38Z — quality-review regression failed because
      generic local command/version runners were accepted as safe.
- [x] GREEN 2026-06-25T06:06:06Z — validator now rejects non-Docker runners and
      requires a digest-pinned Docker sandbox image.
- [x] REFACTOR 2026-06-25T06:08:48Z — no extraction needed; runner contract was
      narrowed without adding extra abstraction.
- [x] RED 2026-06-25T20:24:55Z — quality-review regression failed because a
      writable `cache` host mount was accepted.
- [x] GREEN 2026-06-25T20:25:14Z — validator now rejects every writable
      non-scratch mount.
- [x] REFACTOR 2026-06-25T20:25:19Z — mount policy matches the ticket: host
      mounts are read-only except scratch space.

Given a Rust pilot task is missing digest-pinned Docker sandbox image, checkout
ref, timeout, resource limits, network policy, mount policy,
non-root/rootless or user-namespace policy, allowed commands, or executable oracle  
When the dataset loader validates the task  
Then the task is rejected with a specific diagnostic
And a task that permits Docker socket access or privileged mode is rejected

## Rule: The sandbox executor prepares real Rust task runs safely

### Scenario: Pilot manifest loads the seven-repository Rust split

- [x] RED 2026-06-25T06:35:42Z — manifest test failed because
      `loadRustTaskManifest` did not exist.
- [x] GREEN 2026-06-25T06:37:52Z — checked in `tasks/pilot.json` with seven
      pinned repository refs and validated whole-repository splits.
- [x] REFACTOR 2026-06-25T06:38:02Z — manifest loader stays a thin JSON parse
      plus existing validator call.

Given the Rust pilot manifest is checked into the experiment  
When the manifest loader reads it  
Then it contains train, validation, and held-out tasks for the seven pilot
repositories  
And every repository is pinned by commit SHA and appears in exactly one split

### Scenario: Executor plans checkout, patch, and sandbox steps

- [x] RED 2026-06-25T06:35:42Z — executor test failed because
      `../src/executor` did not exist.
- [x] GREEN 2026-06-25T06:37:52Z — `buildRustSandboxRunPlan` now emits checkout,
      copy-worktree, apply-patch, and Docker oracle execution steps.
- [x] REFACTOR 2026-06-25T06:38:02Z — executor remains a planning layer; no
      process execution is hidden inside tests.

Given a validated Rust pilot task and a candidate patch file  
When the sandbox executor builds the run plan  
Then the plan checks out the pinned repository ref into scratch space  
And applies the candidate patch before running executable oracles

### Scenario: Executor plan forbids unsafe Docker execution

- [x] RED 2026-06-25T06:35:42Z — executor module missing.
- [x] GREEN 2026-06-25T06:37:52Z — Docker argv includes timeout, CPU/memory
      limits, non-root user, read-only root filesystem, no network, no-new-
      privileges, read-only repo mount, and writable scratch mount.
- [x] REFACTOR 2026-06-25T06:38:02Z — Docker socket and privileged mode remain
      impossible in the generated argv.
- [x] RED 2026-06-25T20:21:29Z — quality-review regressions failed because the
      plan relied on a host `timeout` command, passed `prefetch-only` through as
      a Docker network mode, and allowed path-traversing run ids.
- [x] GREEN 2026-06-25T20:22:35Z — Docker argv now starts at `docker run`,
      `prefetch-only` records policy but runs oracle Docker with `--network
      none`, and unsafe run ids are rejected.
- [x] REFACTOR 2026-06-25T20:23:06Z — timeout is enforced by the command runner;
      the network mapper fails closed for future policy values.

Given a Rust task with digest-pinned Docker image and network policy `none`  
When the sandbox executor builds the Docker command  
Then the command includes CPU, memory, timeout, non-root user, read-only repo
mount, writable scratch mount, no network, no privileged flag, and no Docker
socket mount

### Scenario: Cargo cache uses Docker-managed storage

- [x] RED 2026-06-25T23:56:17Z — quality-review regression tests failed
      because the Docker command still used a writable host bind mount for
      `/workspace/cache` and no cache volume lifecycle existed.
- [x] GREEN 2026-06-25T23:58:10Z — the executor now creates a per-run
      Docker-managed cache volume, mounts it at `/workspace/cache` for prefetch
      and oracle containers, and plans cleanup after the oracle run.
- [x] REFACTOR 2026-06-25T23:59:14Z — figure-it-out decision kept Cargo cache
      persistence across containers while avoiding writable host cache binds.

Given a Rust task that needs dependency prefetch before an offline oracle  
When the sandbox executor builds the run plan  
Then Cargo cache state is stored in a per-run Docker-managed volume  
And the plan creates and removes that volume  
And the Docker command does not mount the generated host cache path as writable

### Scenario: Dependency prefetch runs before patching and offline oracle

- [x] RED 2026-06-25T20:29:32Z — prefetch tests failed because no dependency
      prefetch step existed, the pilot manifest still used `network: none`, and
      Cargo cache env vars were not set.
- [x] GREEN 2026-06-25T20:31:42Z — `network: prefetch-only` now adds a
      pre-patch `cargo fetch --locked` Docker step with network, while oracle
      Docker still runs with `--network none`.
- [x] REFACTOR 2026-06-25T20:31:53Z — pilot manifest now uses `prefetch-only`
      for all seven tasks; no network access is available after patch apply.

Given a Rust task with network policy `prefetch-only`  
When the sandbox executor builds and runs the plan  
Then dependency fetch runs before candidate patch application  
And the required oracle runs afterward with Docker network disabled

### Scenario: No-skill baseline runs without a patch file

- [x] RED 2026-06-25T20:48:09Z — baseline tests failed because the executor
      always emitted `apply-patch`, the runner invoked `git apply undefined`,
      and the CLI rejected missing `--patch-file`.
- [x] GREEN 2026-06-25T20:48:51Z — executor plans now record either patch file
      or no patch, `no-skill` CLI runs may omit `--patch-file`, and named
      candidate skill runs still require a patch.
- [x] REFACTOR 2026-06-25T20:49:00Z — no-patch behavior is represented in the
      artifact plan instead of inferred from missing setup commands.

Given a no-skill Rust baseline run  
When the experiment CLI runs without `--patch-file`  
Then the plan omits patch application and still writes a replayable artifact  
And named candidate skill runs without a patch file are rejected

### Scenario: Live Docker smoke runs the no-skill baseline hermetically

- [x] RED 2026-06-25T20:59:19Z — live `fd` baseline failed during dependency
      prefetch because the digest-only `rust@sha256:...` image ref plus login
      Bash hid `cargo` from `PATH`.
- [x] RED 2026-06-25T21:01:30Z — live `fd` baseline reached the oracle, but full
      integration tests failed because the host bind mount leaked macOS
      filesystem semantics into the Linux container.
- [x] RED 2026-06-25T21:07:40Z — tmpfs scratch isolated filesystem semantics but
      still failed executable-bit tests because Docker's default tmpfs mount was
      `noexec`.
- [x] GREEN 2026-06-25T21:09:44Z — live no-skill `fd` baseline passed
      `cargo test --locked` with dependency prefetch, offline oracle execution,
      tagged digest image, non-login Bash, read-only repo mount, generated Cargo
      cache, executable tmpfs scratch, non-root user, and read-only root
      filesystem.
- [x] REFACTOR 2026-06-25T21:09:44Z — executor tests now assert tagged digest
      refs, cache preparation, non-login Bash, read-only worktree mount,
      executable tmpfs scratch, and copy-then-run behavior.

Given a no-skill Rust baseline task in `--live` mode  
When the runner executes the task in Docker  
Then dependency prefetch may use network before patch application  
And the required oracle runs with Docker network disabled from a Linux scratch
worktree  
And the artifact records an acceptable result only when the required oracle
passes

### Scenario: Every runner subprocess is bounded by timeout

- [x] RED 2026-06-25T23:56:17Z — quality-review regression tests failed because
      checkout, worktree copy, patch application, and cache setup invocations
      had no `timeoutSeconds`.
- [x] GREEN 2026-06-25T23:58:10Z — the runner now passes the sandbox timeout to
      every process invocation, including checkout/copy/apply/cache lifecycle,
      dependency prefetch, Docker oracle, and cleanup.
- [x] REFACTOR 2026-06-25T23:59:14Z — timeout handling stays centralized in the
      existing command runner instead of reintroducing platform-specific shell
      timeout wrappers.

Given a Rust sandbox run plan  
When the runner invokes checkout, copy, cache setup, patch application,
dependency prefetch, oracle execution, or cleanup  
Then every invocation includes a bounded timeout from the task sandbox policy

### Scenario: All pilot repositories have viable no-skill live baselines

- [x] RED 2026-06-25T21:58:00Z — remaining pilot baseline batch found three
      invalid generic oracles: Tokio failed because the no-lock workspace tried
      to resolve crates.io during the offline oracle phase, Rustls full
      workspace pulled in a libclang-dependent crate, and Cargo full workspace
      exceeded the sandbox timeout.
- [x] RED 2026-06-25T22:18:00Z — Docker timeout cleanup needed cidfiles because
      terminating the Docker CLI process could leave the container running.
- [x] GREEN 2026-06-25T22:34:08Z — live no-skill baselines passed for all seven
      pilot repos: `fd`, `clap`, `tokio`, `ripgrep`, `rustls`, `cargo`, and
      `rust-analyzer`.
- [x] REFACTOR 2026-06-25T22:34:08Z — manifest oracles are now repo-bounded:
      Tokio uses offline workspace tests after prefetch, Rustls tests the
      `rustls` package, Cargo tests the `cargo` library package, and
      rust-analyzer tests the IDE/HIR package set.

Given the seven-repository Rust pilot manifest  
When each task runs as a no-skill live baseline  
Then every baseline writes an acceptable artifact  
And any repo-specific oracle narrowing is explicit in the manifest rather than
hidden in the runner

### Scenario: Runner executes the plan through an injectable command runner

- [x] RED 2026-06-25T15:02:40Z — runner tests failed because `../src/runner`
      did not exist.
- [x] GREEN 2026-06-25T15:03:33Z — `executeRustSandboxRun` runs checkout,
      worktree copy, patch application, and Docker oracle invocations through an
      injected command runner.
- [x] REFACTOR 2026-06-25T15:03:42Z — runner returns artifacts instead of
      hiding process state in side effects.

Given a sandbox run plan and a command runner abstraction  
When the runner executes the plan  
Then checkout, worktree copy, patch application, and Docker oracle commands run
in order  
And Docker output is converted into evaluator command results

### Scenario: Runner appends replayable JSONL artifacts

- [x] RED 2026-06-25T15:02:40Z — runner module missing.
- [x] GREEN 2026-06-25T15:03:33Z — `appendRustRunArtifact` writes one JSONL
      record with plan, command output, side information, and evaluation score.
- [x] REFACTOR 2026-06-25T15:03:42Z — artifact writing creates parent
      directories and keeps the artifact schema explicit.

Given a completed Rust sandbox run  
When the runner writes the artifact log  
Then one JSON line records task id, repository id, split, model family,
candidate skill id, plan, command output, side information, and score

### Scenario: CLI can dry-run one pilot task into an artifact

- [x] RED 2026-06-25T15:11:37Z — CLI tests failed because `../src/cli` and
      `../src/process-runner` did not exist.
- [x] GREEN 2026-06-25T15:13:10Z — `runRustExperimentCli` dry-runs one selected
      pilot task and writes a JSONL artifact without live process execution.
- [x] REFACTOR 2026-06-25T15:13:32Z — package `run:pilot` script calls the same
      CLI module; dry-run package invocation wrote one artifact line.

Given the Rust pilot manifest and a candidate patch path  
When the experiment CLI runs in dry-run mode for one task  
Then it writes a JSONL artifact without invoking live process execution  
And the artifact contains the selected task, model family, candidate skill id,
plan, command results, and evaluation score

### Scenario: CLI live mode uses the Node process runner explicitly

- [x] RED 2026-06-25T15:11:37Z — process-runner module missing.
- [x] GREEN 2026-06-25T15:13:10Z — `createNodeCommandRunner` captures stdout,
      stderr, exit code, and duration from spawned commands; `--live` selects
      the live runner factory explicitly.
- [x] REFACTOR 2026-06-25T15:13:32Z — dry-run remains the default; live execution
      requires `--live`.
- [x] RED 2026-06-25T20:21:29Z — timeout regression test hung because spawned
      commands ignored `timeoutSeconds`.
- [x] GREEN 2026-06-25T20:22:35Z — `createNodeCommandRunner` now terminates
      timed-out commands and returns exit code `124`.
- [x] REFACTOR 2026-06-25T20:23:06Z — timeout stays in the invocation contract
      instead of relying on platform-specific shell tools.

Given the Rust pilot manifest and `--live` mode  
When the experiment CLI runs for one task  
Then it uses the Node process runner instead of the dry-run runner  
And live mode still writes the same artifact schema

## Rule: The evaluator scores real Rust execution before secondary metrics

### Scenario: Required oracle failure blocks an otherwise clean candidate

- [x] RED 2026-06-25T06:07:32Z — evaluator tests failed because
      `../src/evaluator` did not exist.
- [x] GREEN 2026-06-25T06:08:35Z — `scoreRustTaskRun` sets score `0`,
      `acceptable: false`, and a required-oracle failure reason when
      `cargo test --locked` fails despite strong secondary metrics.
- [x] REFACTOR 2026-06-25T06:08:48Z — kept execution out of scope; evaluator
      scores captured command results only.

Given a candidate has a small diff and quick runtime  
And its required `cargo test`, `cargo check`, `cargo clippy`, benchmark, or
deterministic verifier fails  
When the evaluator scores the task  
Then the candidate fails the correctness floor  
And secondary metrics cannot make it acceptable

### Scenario: Evaluation records rich side information

- [x] RED 2026-06-25T06:07:32Z — evaluator module missing.
- [x] GREEN 2026-06-25T06:08:35Z — evaluation result records task prompt,
      model family, candidate skill id, agent trace, patch summary, command
      output, exit status, timings, diagnostics, and score breakdown.
- [x] REFACTOR 2026-06-25T06:08:48Z — side information is stored separately from
      sanitized optimizer feedback.

Given a candidate is evaluated against a Rust task  
When the evaluator finishes  
Then the result records task prompt, model family, candidate id, agent trace,
patch summary, command output, exit statuses, timings, diagnostics, and score
breakdown

### Scenario: Feedback omits exploitable eval structure

- [x] RED 2026-06-25T06:07:32Z — evaluator module missing.
- [x] GREEN 2026-06-25T06:08:35Z — `feedbackForGepa` preserves command failure
      diagnostics while redacting split names, expected defect counts, fixture
      regularity, and optimizer-only vocabulary.
- [x] REFACTOR 2026-06-25T06:08:48Z — feedback generation remains deterministic
      and independent of GEPA runtime dependencies.

Given the evaluator emits feedback for GEPA  
When the feedback is serialized  
Then it includes actionable diagnostics from the task result  
And it omits split names, expected defect counts, fixture regularity, and
optimizer-only vocabulary

## Rule: Rust candidates must transfer across repositories and models

### Scenario: Aggregation macro-averages by repository and model

- [x] RED 2026-06-25T06:13:18Z — transfer tests failed because
      `../src/transfer` did not exist.
- [x] GREEN 2026-06-25T06:14:36Z — `aggregateRustScores` groups scores by
      repository and model family before computing the headline macro-average.
- [x] REFACTOR 2026-06-25T06:15:12Z — exposed raw task average separately so
      callers can see when it differs from macro-average.

Given task-level scores from multiple Rust repositories and both target model
families  
When aggregate scoring runs  
Then scores are grouped by repository and model family  
And the final headline is a macro-average over those groups, not a raw task
count average

### Scenario: Held-out regression on either model family blocks shipping

- [x] RED 2026-06-25T06:13:18Z — transfer module missing.
- [x] GREEN 2026-06-25T06:14:36Z — `evaluateHeldoutGate` rejects a candidate
      that regresses Claude Opus held-out results even when GPT/Codex improves
      and the held-out aggregate rises.
- [x] REFACTOR 2026-06-25T06:15:12Z — gate compares held-out scores by target
      model family and ignores train scores.
- [x] RED 2026-06-25T23:56:17Z — quality-review regression tests failed because
      the gate could accept when a requested model family or held-out
      repository/model pair was absent from the candidate artifacts.
- [x] GREEN 2026-06-25T23:58:10Z — the held-out gate now rejects missing
      baseline or candidate coverage for each requested model family and each
      held-out repository/model pair.
- [x] REFACTOR 2026-06-25T23:59:14Z — missing coverage is reported separately
      from score regressions so comparison reports explain both failure modes.

Given an optimized candidate improves the aggregate score  
And it regresses held-out GPT/Codex or Claude Opus results versus the accepted
baseline  
When the shipping gate runs  
Then the candidate is rejected
And candidates missing required held-out model or repository coverage are
rejected

### Scenario: Candidate review blocks memorized or eval-aware text

- [x] RED 2026-06-25T06:13:18Z — transfer module missing.
- [x] GREEN 2026-06-25T06:14:36Z — `reviewCandidateSkill` blocks pilot
      repository names, hard-coded corpus commands, split names, expected defect
      counts, fixture regularity, and optimizer vocabulary.
- [x] REFACTOR 2026-06-25T06:15:12Z — language-general Rust guidance remains
      accepted; only eval/corpus-specific text is blocked.
- [x] RED 2026-06-25T23:56:17Z — quality-review regression tests failed because
      sandbox escape guidance and non-Rust commands were accepted.
- [x] GREEN 2026-06-25T23:58:10Z — candidate review now blocks privileged
      Docker/socket/network bypass suggestions and common Go, npm, pip, and
      pytest guidance in Rust candidate skills.
- [x] REFACTOR 2026-06-25T23:59:14Z — blocker labels stay explicit so failed
      reviews are actionable.

Given a candidate skill references pilot repository names, hard-coded corpus
commands, split names, or eval-specific terms  
When candidate review runs  
Then the candidate is blocked from template installation  
And any useful language-general guidance must be human-distilled first
And sandbox-escape or non-Rust guidance is blocked

### Scenario: Human seed Rust skill is reviewable before live candidate runs

- [x] RED 2026-06-25T23:03:00Z — candidate skill tests failed because no
      candidate skill loader or human seed Rust skill artifact existed.
- [x] GREEN 2026-06-25T23:06:21Z — the experiment now loads
      `candidates/human-seed-rust/SKILL.md`, verifies required skill
      frontmatter, runs the existing anti-memorization review against the full
      skill text, and records accepted candidate metadata in CLI artifacts.
- [x] REFACTOR 2026-06-25T23:06:50Z — the human seed skill stays under
      `experiments/` and is not wired into product language packs before
      held-out gates pass.

Given the human seed Rust skill artifact  
When the experiment reviews it before a candidate run  
Then the skill is accepted only if it has valid frontmatter and no
repo-specific or eval-aware text  
And run artifacts record the candidate skill id, file path, and description

### Scenario: Candidate matrix runs reviewed patches across pilot tasks

- [x] RED 2026-06-25T23:14:34Z — matrix tests failed because the selected task
      ids and patch coverage expectations were not wired to the current pilot
      manifest.
- [x] GREEN 2026-06-25T23:15:12Z — `runRustMatrixCli` dry-runs selected pilot
      tasks from a patch directory, records one artifact per task with human
      seed candidate metadata, and rejects missing patches before creating a
      command runner.
- [x] REFACTOR 2026-06-25T23:16:10Z — exposed the package-level `run:matrix`
      entrypoint and verified a one-task dry-run smoke through Bun.

Given a reviewed Rust candidate skill and a directory of candidate patches  
When the matrix runner executes selected pilot tasks  
Then each task uses `<task-id>.patch` from the patch directory  
And the runner writes one JSONL artifact per task with candidate metadata  
And missing task patches fail before live commands can run

### Scenario: Candidate patch preflight rejects empty patches

- [x] RED 2026-06-25T23:30:37Z — the matrix test failed because an empty patch
      file reached command-runner construction instead of being rejected during
      preflight.
- [x] GREEN 2026-06-25T23:31:07Z — matrix patch collection now reads each
      selected patch and requires non-empty unified diff content before command
      runner creation.
- [x] REFACTOR 2026-06-25T23:31:23Z — existing matrix dry-run fixtures now use
      minimal diff-shaped patches, and the package-level smoke does the same.

Given a reviewed Rust candidate skill and a patch directory  
When a selected task patch is empty or not shaped like a unified diff  
Then the matrix runner rejects the run during preflight  
And no live or dry-run command runner is created

### Scenario: Matrix comparison reports candidate deltas and held-out gate

- [x] RED 2026-06-25T23:36:14Z — reporter tests failed because `../src/report`
      did not exist.
- [x] GREEN 2026-06-25T23:37:32Z — the reporter now reads baseline and
      candidate JSONL artifacts, validates the Rust run artifact schema,
      macro-averages both sets, emits per-repository/model deltas, and runs the
      held-out gate over selected model families.
- [x] REFACTOR 2026-06-25T23:38:04Z — added the package-level
      `compare:matrix` entrypoint and verified it with synthetic artifact JSONL.

Given baseline and candidate Rust run artifact JSONL files  
When the comparison reporter runs  
Then it emits aggregate baseline and candidate scores  
And it emits per-repository and per-model deltas  
And it reports whether the held-out gate accepts or rejects the candidate

## Rule: The optimizer loop proposes auditable Rust skill candidates

### Scenario: Fake adapter writes a reviewed candidate from failed artifacts

- [x] RED 2026-06-26T00:37:33Z — optimizer tests failed because
      `../src/optimize` did not exist.
- [x] GREEN 2026-06-26T00:39:56Z — `optimizeRustSkillCandidate` now loads
      failed run artifacts, sends sanitized feedback plus base skill text to an
      adapter, writes the proposed candidate skill, reviews it, and persists an
      optimization report.
- [x] REFACTOR 2026-06-26T00:41:18Z — exposed the package-level
      `optimize:skill` fake-adapter entrypoint and smoke-tested it against a
      failed live artifact.

Given failed Rust run artifacts and the current candidate skill text
When the Rust optimizer loop runs with a fake model adapter
Then it sends sanitized failure feedback and the base skill text to the adapter
And it writes a new candidate skill under a candidate-id directory
And it records a replayable optimization report with the adapter rationale,
failure count, model families, and review result

### Scenario: Optimizer persists rejected candidate reviews

- [x] RED 2026-06-26T00:37:33Z — optimizer tests failed because no optimizer
      candidate review/persistence path existed.
- [x] GREEN 2026-06-26T00:39:56Z — rejected adapter proposals are still written
      to disk and their review blockers are recorded in the optimization
      report.
- [x] REFACTOR 2026-06-26T00:41:18Z — reused the existing Rust candidate review
      gate so optimizer output cannot bypass anti-memorization checks.

Given the adapter proposes eval-aware or repository-specific Rust guidance
When the Rust optimizer loop reviews the proposed skill
Then the candidate is rejected
And the proposed skill plus blocker reasons are still persisted for audit

### Scenario: Optimizer skips candidate generation without failures

- [x] RED 2026-06-26T00:37:33Z — optimizer tests failed because no skip path
      existed for all-acceptable artifacts.
- [x] GREEN 2026-06-26T00:39:56Z — all-acceptable input artifacts now skip the
      mutation adapter and write an audit report with `skippedReason: no failed
      runs`.
- [x] REFACTOR 2026-06-26T00:41:18Z — skip handling shares the same report schema
      as accepted and rejected optimizer proposals.

Given all input Rust artifacts are acceptable
When the Rust optimizer loop runs
Then it does not call the mutation adapter
And it writes a skip report explaining that no failed runs were available

### Scenario: Optimizer rejects malformed run artifacts before feedback generation

- [x] RED 2026-06-26T00:50:14Z — quality-review regression failed because a
      malformed artifact reached `feedbackForGepa` and threw
      `evaluation.commandResults is not iterable`.
- [x] GREEN 2026-06-26T00:50:48Z — optimizer artifact validation now rejects
      records missing the command results or side information needed for
      sanitized feedback.
- [x] REFACTOR 2026-06-26T00:50:55Z — JSONL parse errors now include file and
      line context, matching the comparison reporter boundary.

Given an optimizer input JSONL file contains a malformed Rust run artifact
When the Rust optimizer loop loads the file
Then the malformed record is rejected with file and line context
And sanitized feedback generation is not invoked for that record

### Scenario: Provider adapters build sanitized model requests

- [x] RED 2026-06-26T01:18:48Z — provider tests failed because
      `../src/model-adapters` did not exist and the optimizer CLI rejected
      `--provider`.
- [x] GREEN 2026-06-26T01:21:01Z — OpenAI and Anthropic provider adapters now
      build sanitized requests, parse provider JSON responses, require explicit
      API keys, and the CLI can run `--provider openai` without SDK
      dependencies.
- [x] RED 2026-06-26T01:22:05Z — quality-review against current Anthropic docs
      found the Opus 4.8 request still set `temperature: 0`, even though Opus
      4.7+ rejects non-default sampling parameters.
- [x] GREEN 2026-06-26T01:22:52Z — the Anthropic adapter now omits sampling
      parameters for Opus 4.8 requests while keeping `model`, `max_tokens`,
      top-level `system`, and user messages intact.
- [x] REFACTOR 2026-06-26T01:24:31Z — provider HTTP error handling now shares
      one response reader across OpenAI and Anthropic without changing the
      adapter contracts.

Given failed Rust run artifacts and a provider-backed mutation adapter
When the Rust optimizer loop runs for OpenAI or Anthropic
Then the adapter calls the configured provider API with the base skill text and
sanitized failure feedback
And the provider request omits repository ids, task ids, split names, source
artifact paths, and optimizer-only vocabulary
And the CLI can select the provider without adding provider SDK dependencies

### Scenario: Provider smoke output is human-distilled into an experiment candidate

- [x] RED 2026-06-26T02:47:29Z — candidate review test failed because
      `candidates/distilled-rust-ownership-v1/SKILL.md` did not exist.
- [x] GREEN 2026-06-26T02:48:40Z — the human-distilled ownership candidate now
      exists, preserves borrow-checker guidance from the provider smoke, and
      passes the Rust candidate review gate.
- [x] REFACTOR skip: content-only candidate artifact; no structural cleanup
      warranted beyond the existing review gate.

Given OpenAI and Anthropic provider-smoke candidates that passed review
When useful guidance is distilled into a checked-in Rust experiment candidate
Then the candidate skill passes the same candidate review gate
And it preserves the useful borrow-checker guidance without copying provider
output wholesale
And it still omits repository ids, task ids, split names, source artifact paths,
optimizer-only vocabulary, sandbox bypass guidance, and non-Rust guidance

## Rule: Product wiring happens only after the Rust skill passes eval gates

### Scenario: Rust projects install the rust skill conditionally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Given a project with a detected `Cargo.toml`  
When safeword setup or upgrade runs after the accepted Rust skill ships  
Then `.claude/skills/rust/SKILL.md`, `.agents/skills/rust/SKILL.md`, and the
matching Cursor rule are installed

### Scenario: Non-Rust projects do not install Rust guidance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Given a project without Rust language detection  
When safeword setup or upgrade runs  
Then no Rust skill or Rust Cursor rule is installed
