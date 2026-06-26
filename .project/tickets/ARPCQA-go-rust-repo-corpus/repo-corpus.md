<!-- markdownlint-disable MD013 -->

# Create Go and Rust Language Skills from Repository Corpus

Created: 2026-06-25

## Goal

Create language-general `golang` and `rust` skills from this corpus, then install
them through safeword's existing language packs so Go and Rust projects get
language-specific agent guidance automatically.

## Background

Safeword already has Go and Rust language packs for tooling/configuration:

- `packages/cli/src/packs/golang/*`
- `packages/cli/src/packs/rust/*`

Those packs install lint/format/test support, but they do not yet ship
language-specific agent behavior. This issue turns the corpus below into shipped
skills that guide agents on general Go and Rust code quality instead of
project-local tricks.

## Existing Experiment on `main`

After catching this worktree up to `origin/main`, there is already a GEPA-ready
experiment under `experiments/gepa-review-spec/`. It is not for Go/Rust, but its
architecture should be reused:

- `src/dataset.ts` loads input/reference fixtures and split metadata.
- `src/task.ts` runs a candidate skill against an input and coerces output into
  machine-readable form.
- `src/evaluator.ts` is the deterministic metric and Actionable Side Information
  source.
- `src/harness.ts` composes dataset x task x evaluator.
- `gepa/run.py` is the Python GEPA adapter.
- `gepa-eval.ts` is the TypeScript metric bridge.
- `validate-skill.ts` compares a candidate against the shipped skill.
- `rescore.ts` replays cached traces without spending tokens.
- `LOGGING-BRIEF.md` defines what must be captured from real skill use to grow
  an eval corpus over time.

The spike also proved an important failure mode: a GEPA winner can score well by
gaming the evaluator. In E2D8S5, the candidate memorized training fixtures,
referenced eval structure, and exploited the one-seeded-defect fixture regularity.
Held-out metrics alone would not have caught it because the held-out split shared
the same structural regularity. The Go/Rust plan must inherit the safeguards:
vary task shapes, avoid evaluator-shape leakage, inspect candidate diffs, and
human-distill any useful rules before shipping.

## Revised Optimization Plan

1. Create `experiments/gepa-language-skills/` as an isolated experiment, modeled
   on `experiments/gepa-review-spec/`. Do not add GEPA or experiment-only
   dependencies to `packages/cli`.
2. Build a verifiable coding-task dataset from the corpus. Start with a small
   pilot across several Go repositories and several Rust repositories, then
   scale only after the evaluator proves trustworthy.
3. Split by whole repository: train, validation, and final held-out repositories.
   No task from a final held-out repo may be used in optimization.
4. Include multiple task families: bug fix, small feature, test addition,
   refactor, lint/build repair, and performance-sensitive fix where available.
5. Require an executable oracle for every task: tests, build, lint, benchmark
   threshold, or a deterministic repository-specific verifier.
6. The evaluator should run the agent with a candidate skill and return score
   plus rich side information: task text, agent trace, patch summary, test/build/
   lint output, timing, and failure diagnostics.
7. Use a hard correctness floor. A candidate that regresses tests, build, lint,
   or required behavior loses before secondary metrics are considered.
8. Optimize secondary metrics only after correctness: task duration, diff size,
   lint cleanliness, test quality, and cross-repo coverage.
9. Hide evaluator structure. Feedback must not reveal split names, expected bug
   counts, fixture regularity, or optimizer vocabulary such as "seeded defect"
   or "certified clean".
10. Vary task structure so the optimizer cannot learn shortcuts like "one issue
    per task", "always suppress second findings", or "never touch more than one
    file".
11. Compare no-skill, human seed skill, and optimized skill. A repo-specific
    skill can be used as an upper bound, but language skills must stay
    language-general.
12. Evaluate no-skill, human seed skill, and optimized skill across both target
    model families: Claude Opus and GPT/Codex. Score by language x model x
    repository, then macro-average so an improvement on one model or language
    cannot hide a regression on another.
13. Treat GEPA output as a proposal, not a patch. Human-distill stable
    language-general guidance, remove repo-specific/eval-aware text, then
    revalidate on held-out repos and with candidate diff inspection.
14. Only after held-out improvement, human review, and no gaming signs should the
    skills be wired into Go/Rust language-pack-conditioned installation.

## Implementation Scope

- Author model-invocable skills named `golang` and `rust`. Do not name the Go
  skill `go`; `go` is a common English verb and likely to mis-trigger.
- Add matching Cursor rules that point at the Claude skills instead of
  duplicating long guidance.
- Add matching Codex `.agents/skills/*` installs.
- Wire the skills into the existing Go and Rust language packs so Go projects
  receive `golang`, Rust projects receive `rust`, and mixed projects receive
  both.
- Add conditional schema support if needed so template-backed files can be
  installed only when `ctx.languages?.golang` or `ctx.languages?.rust` is true.
- Update schema registration, skill/Cursor parity fixtures, setup/upgrade tests,
  and reset/uninstall coverage.
- Use this corpus for skill design and evaluation. Keep repo-specific commands,
  paths, and conventions out of the shipped language-general skills.

## Acceptance Criteria

- [ ] `packages/cli/templates/skills/golang/SKILL.md` exists and covers Go package
      structure, errors, contexts, concurrency, tests, tooling, and common agent
      failure modes.
- [ ] `packages/cli/templates/skills/rust/SKILL.md` exists and covers Rust
      ownership, error handling, async, modules/crates, tests, tooling, unsafe
      boundaries, and common agent failure modes.
- [ ] Matching Cursor rules exist for both skills.
- [ ] Matching Codex skill installs exist for both skills.
- [ ] Go projects install the `golang` skill and do not install the `rust` skill
      unless Rust is detected too.
- [ ] Rust projects install the `rust` skill and do not install the `golang`
      skill unless Go is detected too.
- [ ] Non-Go/Rust projects do not receive either language skill from
      pack-conditioned installation.
- [ ] Reset/uninstall removes the installed language skill files.
- [ ] Schema, skill validation, Cursor parity, Codex install, setup/upgrade, and
      reset/uninstall tests pass.
- [ ] Evaluation holds out whole repositories from this corpus; do not train and
      test on tasks from the same repository.
- [ ] Evaluation covers no-skill, seed-skill, and optimized-skill conditions on
      both Claude Opus and GPT/Codex.
- [ ] A candidate does not ship if it regresses either target model family on
      held-out repositories, even when the aggregate score improves.

Latest stable toolchains checked at creation time:

- Go: `go1.26.4`
- Rust: `rustc 1.96.0`

Selection criteria:

- Active, respected, production-grade codebases.
- Useful for learning general language-specific coding-agent behavior, not just one repo's lore.
- Prefer current toolchains where possible.
- Keep some canonical lower-MSRV Rust libraries because they teach API design, compatibility, and safety better than many "latest only" apps.
- For evaluation, hold out whole repositories. Do not train and test on tasks from the same repo if the goal is general Go/Rust ability.

## Go Repositories

1. [golang/go](https://github.com/golang/go) — Go source tree; no normal root `go.mod`. Canonical compiler, runtime, standard library, toolchain, tests, and proposal-driven code review culture.
2. [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes) — `go 1.26.0`. Large-scale API machinery, controllers, reconciliation loops, compatibility, generated clients, and test-heavy infrastructure code.
3. [tailscale/tailscale](https://github.com/tailscale/tailscale) — `go 1.26.4`. Excellent modern product Go across networking, OS integration, security, state machines, and pragmatic tests.
4. [etcd-io/etcd](https://github.com/etcd-io/etcd) — `go 1.26`, `toolchain go1.26.4`. Consensus, storage, distributed systems, long-running service behavior, and careful failure handling.
5. [containerd/containerd](https://github.com/containerd/containerd) — `go 1.26.3`. Runtime systems, plugin boundaries, Linux/container internals, and production API design.
6. [moby/moby](https://github.com/moby/moby) — `go 1.25.9`. Mature container engine code with integration-heavy behavior, platform branches, and compatibility constraints.
7. [prometheus/prometheus](https://github.com/prometheus/prometheus) — `go 1.25.7`. Observability server, TSDB/query engine, service discovery, performance-sensitive code, and operational tests.
8. [grafana/loki](https://github.com/grafana/loki) — `go 1.26.4`. Distributed logging backend, query paths, storage, observability, and multi-component service architecture.
9. [caddyserver/caddy](https://github.com/caddyserver/caddy) — `go 1.25.1`. Polished HTTP server, TLS automation, module/plugin design, configuration UX, and production networking.
10. [nats-io/nats-server](https://github.com/nats-io/nats-server) — `go 1.25.0`, `toolchain go1.25.11`. High-performance messaging, clustering, protocol handling, and concurrency.
11. [minio/minio](https://github.com/minio/minio) — `go 1.24.0`, `toolchain go1.24.8`. Storage server with distributed consistency, performance, cloud APIs, and robust operations paths.
12. [hashicorp/terraform](https://github.com/hashicorp/terraform) — `go 1.26.4`. Mature CLI, graph planning, schemas, provider boundaries, state management, and long-term compatibility.
13. [cockroachdb/cockroach](https://github.com/cockroachdb/cockroach) — `go 1.26.2`. Very large distributed SQL system with concurrency, transactions, testing infrastructure, and performance discipline.
14. [cli/cli](https://github.com/cli/cli) — `go 1.26.0`, `toolchain go1.26.4`. High-quality command-line UX, API clients, terminal behavior, tests, and release engineering.
15. [charmbracelet/bubbletea](https://github.com/charmbracelet/bubbletea) — `go 1.25.0`. Idiomatic terminal UI library with event loops, composable APIs, and clean examples.
16. [traefik/traefik](https://github.com/traefik/traefik) — `go 1.25.0`. Reverse proxy/load balancer code with providers, dynamic config, networking, middleware, and production integration.
17. [vitessio/vitess](https://github.com/vitessio/vitess) — `go 1.26.4`. Distributed database middleware, sharding, query serving, migrations, and complex operational behavior.
18. [open-telemetry/opentelemetry-go](https://github.com/open-telemetry/opentelemetry-go) — `go 1.25.0`. Library-quality telemetry APIs, context propagation, spec adherence, and compatibility.
19. [grpc/grpc-go](https://github.com/grpc/grpc-go) — `go 1.25.0`. Canonical RPC library with transport internals, API stability, interop tests, and careful error semantics.
20. [temporalio/temporal](https://github.com/temporalio/temporal) — `go 1.26.4`. Workflow orchestration server with persistence, queues, distributed coordination, and long-running correctness concerns.
21. [argoproj/argo-cd](https://github.com/argoproj/argo-cd) — `go 1.26.4`. Kubernetes GitOps controller with reconciliation, API/UI integration, security, and operational workflows.
22. [helm/helm](https://github.com/helm/helm) — `go 1.26.0`. CLI plus Kubernetes package manager with templates, dependency resolution, UX, and backward compatibility.
23. [hashicorp/consul](https://github.com/hashicorp/consul) — `go 1.26`. Service discovery/control-plane code with networking, consensus, agent/server split, and upgrade paths.
24. [VictoriaMetrics/VictoriaMetrics](https://github.com/VictoriaMetrics/VictoriaMetrics) — `go 1.26.4`. Performance-focused time-series database with storage, query execution, and operational tooling.
25. [grafana/tempo](https://github.com/grafana/tempo) — `go 1.26.3`. Distributed tracing backend with ingestion, storage, querying, and observability-system integration.
26. [go-gitea/gitea](https://github.com/go-gitea/gitea) — `go 1.26.4`. Full web application in Go with HTTP, ORM, background jobs, Git integration, and user-facing workflows.
27. [syncthing/syncthing](https://github.com/syncthing/syncthing) — `go 1.25.0`. Peer-to-peer sync system with protocol design, filesystem correctness, concurrency, and cross-platform behavior.
28. [rclone/rclone](https://github.com/rclone/rclone) — `go 1.25.0`. Broad cloud-storage CLI with many backends, configuration UX, network behavior, and integration edge cases.
29. [cert-manager/cert-manager](https://github.com/cert-manager/cert-manager) — `go 1.26.0`. Kubernetes controller code focused on certificates, reconciliation, webhooks, and API versioning.
30. [ArcadeAI/monorepo/apps/engine](https://github.com/ArcadeAI/monorepo/tree/main/apps/engine) — private repo; requested as `ArcadeAI/arcade-monorepo`. Engine path checked with `gh`: `apps/engine`, module `github.com/ArcadeAI/Engine`, `go 1.26.4`.

## Rust Repositories

1. [rust-lang/rust](https://github.com/rust-lang/rust) — Rust source tree. Canonical compiler, standard library, borrow checker, diagnostics, tests, and language evolution.
2. [rust-lang/cargo](https://github.com/rust-lang/cargo) — package `rust-version = "1.96"`, edition 2024. Canonical Rust CLI/package-manager code with strong error handling and integration tests.
3. [rust-lang/rust-analyzer](https://github.com/rust-lang/rust-analyzer) — `rust-version = "1.95"`, edition 2024. IDE/LSP architecture, incremental analysis, syntax/semantic modeling, and compiler-adjacent design.
4. [astral-sh/ruff](https://github.com/astral-sh/ruff) — toolchain `1.96`, `rust-version = "1.94"`, edition 2024. Modern high-performance parser/linter/formatter with excellent architecture.
5. [astral-sh/uv](https://github.com/astral-sh/uv) — toolchain `1.95.0`, `rust-version = "1.94.0"`, edition 2024. Resolver, packaging, networking, filesystem behavior, and polished CLI UX.
6. [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) — `rust-version = "1.94.0"`, edition 2024. Runtime/compiler/sandboxing code with careful unsafe boundaries and security posture.
7. [denoland/deno](https://github.com/denoland/deno) — toolchain `1.95.0`, edition 2024. Runtime, V8 integration, permissions, async systems, and large-workspace organization.
8. [biomejs/biome](https://github.com/biomejs/biome) — toolchain `1.96.0`, edition 2024. Modern formatter/linter/toolchain code with parser infrastructure and user-facing diagnostics.
9. [apache/datafusion](https://github.com/apache/datafusion) — toolchain `1.96.0`, `rust-version = "1.88.0"`, edition 2024. Query engine, optimizer, Arrow integration, and data-system abstractions.
10. [nushell/nushell](https://github.com/nushell/nushell) — toolchain `1.95.0`, edition 2024. Shell, parser, plugins, data pipelines, structured errors, and user-facing command design.
11. [vectordotdev/vector](https://github.com/vectordotdev/vector) — toolchain `1.95`, `rust-version = "1.92"`, edition 2024. Observability pipeline, async services, codecs, config, and production integration.
12. [influxdata/influxdb](https://github.com/influxdata/influxdb) — toolchain `1.95`, edition 2024. Database/server code with query paths, storage, services, and operational constraints.
13. [servo/servo](https://github.com/servo/servo) — toolchain `1.95.0`, `rust-version = "1.88.0"`, edition 2024. Browser engine code with layout, DOM, graphics, async, and safety-critical systems work.
14. [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) — toolchain `1.93`, `rust-version = "1.93"`, edition 2021. Graphics abstraction, backend portability, unsafe/device boundaries, and API design.
15. [linebender/xilem](https://github.com/linebender/xilem) — `rust-version = "1.92"`, edition 2024. Emerging native UI architecture, reactive app design, and library ergonomics.
16. [helix-editor/helix](https://github.com/helix-editor/helix) — toolchain `1.90.0`, `rust-version = "1.90"`, edition 2021. Editor code, tree-sitter integration, terminal UI, commands, and plugin-facing design.
17. [sharkdp/fd](https://github.com/sharkdp/fd) — `rust-version = "1.90.0"`, edition 2024. Small, polished CLI with filesystem traversal, testing, and high signal-to-noise implementation.
18. [starship/starship](https://github.com/starship/starship) — `rust-version = "1.90"`, edition 2024. Cross-shell prompt, config parsing, async-ish command execution, and cross-platform behavior.
19. [alacritty/alacritty](https://github.com/alacritty/alacritty) — `rust-version = "1.85.0"`, edition 2024. Terminal emulator with rendering, input, platform integration, and performance constraints.
20. [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) — `rust-version = "1.85"`, edition 2024. Gold-standard CLI/performance code, regex/search internals, and pragmatic tests.
21. [clap-rs/clap](https://github.com/clap-rs/clap) — `rust-version = "1.85"`, edition 2024. Canonical CLI argument parser with API ergonomics, derive macros, and compatibility discipline.
22. [tokio-rs/tokio](https://github.com/tokio-rs/tokio) — package `rust-version = "1.71"`, edition 2021. Canonical async runtime; lower MSRV is intentional library compatibility, not stale code.
23. [hyperium/hyper](https://github.com/hyperium/hyper) — `rust-version = "1.63"`, edition 2021. Canonical HTTP library with async, protocol state machines, and compatibility-heavy API design.
24. [rustls/rustls](https://github.com/rustls/rustls) — library workspace, edition 2018. TLS implementation with security-critical Rust, safety patterns, fuzzing, and API stability.
25. [sharkdp/bat](https://github.com/sharkdp/bat) — `rust-version = "1.88"`, edition 2021. Polished CLI with syntax highlighting, pager integration, config, and cross-platform behavior.
26. [swc-project/swc](https://github.com/swc-project/swc) — edition 2021. Fast compiler/transpiler infrastructure, parser/codegen design, and large workspace patterns.
27. [tauri-apps/tauri](https://github.com/tauri-apps/tauri) — `rust-version = "1.77.2"`, edition 2021. App framework, IPC, platform integration, security model, and plugin architecture.
28. [paritytech/polkadot-sdk](https://github.com/paritytech/polkadot-sdk) — edition 2021. Large blockchain/runtime workspace with macros, no-std-ish constraints, networking, and protocol code.
29. [tikv/tikv](https://github.com/tikv/tikv) — nightly pinned, edition 2021. Distributed transactional KV database with Raft, storage engines, concurrency, and deep systems tests.
30. [rust-lang/crates.io](https://github.com/rust-lang/crates.io) — edition 2024. Production web service for the Rust package registry, with database, background jobs, API, and operational concerns.

## Notes for an Agent-Optimization Corpus

- Split by repository, not by task. A held-out repo should have zero training tasks if the goal is general language transfer.
- Keep separate tracks for bug fixing, feature work, refactors, performance, tests, and code review.
- Include structured feedback beyond pass/fail: compiler errors, test output, race/fuzz/static-analysis output, benchmark deltas, diff size, and reviewer rubric notes.
- Keep repo-specific skills separate from language-general skills. The language-general pack should learn patterns like Go context/error/concurrency discipline or Rust ownership/error/async design, not project-local commands.
