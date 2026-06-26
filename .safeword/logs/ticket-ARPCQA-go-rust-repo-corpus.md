---
ticket: ARPCQA
slug: go-rust-repo-corpus
created: 2026-06-25T04:50:36Z
---

# Work Log: Go/Rust Repository Corpus

## 2026-06-25

- Started the Rust-first child ticket `M6CQAT-rust-language-skill-optimization`.
  The child is scoped to the experiment/evaluator first: sandboxed Rust tasks,
  whole-repo splits, executable oracles, macro scoring by model and repo, and
  human-distilled skill output before any language-pack install.
- Added model-transfer gate: evaluate no-skill, human seed skill, and optimized
  skill across both Claude Opus and GPT/Codex; require no held-out regression in
  either model family before shipping.
- Fast-forwarded detached worktree from `763ca8a6` to `origin/main` `b0b02124`.
  Main added `experiments/gepa-review-spec/`, an isolated GEPA-ready
  `review-spec` experiment with dataset/task/evaluator/harness seams, Python GEPA
  adapter, TypeScript metric bridge, accept gate, rescore tool, and logging brief.
- Revised #430 plan to reuse that experiment shape for Go/Rust and to inherit its
  anti-gaming safeguards: whole-repo held-outs, varied task structure, no
  eval-shape leakage, candidate-diff inspection, and human distillation before
  any optimized skill text ships.
- Expanded ticket and GitHub issue scope from corpus-only research to implementation:
  create `golang` and `rust` language skills and install them through the Go/Rust
  language packs.
- Added acceptance criteria covering Claude skills, Cursor rules, Codex skills,
  pack-conditioned setup/upgrade, reset/uninstall cleanup, and held-out repository
  evaluation.
- Created GitHub issue: https://github.com/ArcadeAI/safeword/issues/430.
- Linked issue #430 from ticket frontmatter via `external_issue`.
- Completed `repo-corpus.md` inside `.project/tickets/ARPCQA-go-rust-repo-corpus/`.
- Verified exactly 30 Go entries and 30 Rust entries with `awk`.
- Verified markdownlint on `repo-corpus.md`, `ticket.md`, and this work log: 0 errors.
- `gh` confirmed the private Arcade repo is `ArcadeAI/monorepo`; the requested engine package path is `apps/engine`, module `github.com/ArcadeAI/Engine`, `go 1.26.4`.
- Started from user request to create a ticket-local markdown file with two lists: 30 Go repositories and 30 Rust repositories.
- Selection criteria: active, respected, production-grade, idiomatic, useful for training/evaluating general language coding skills, with toolchain/MSRV noted when available.
- User requested `ArcadeAI/arcade-monorepo` be included in the Go list after checking the engine package path.
- Latest versions verified from official sources: Go 1.26.4 and Rust 1.96.0 as of 2026-06-25.
