---
id: ARPCQA
slug: go-rust-repo-corpus
type: task
phase: intake
status: in_progress
created: 2026-06-25T04:50:23.537Z
last_modified: 2026-06-25T05:41:08Z
external_issue: https://github.com/ArcadeAI/safeword/issues/430
---

# Create Go and Rust language skills from repository corpus

**Goal:** Create language-general `golang` and `rust` skills from the curated repository corpus, then install them through the existing language packs so Go and Rust projects get the right agent guidance automatically.

**Why:** The existing language packs install tooling and config, but they do not yet ship language-specific agent behavior. A broad, current, high-quality corpus gives the skills a defensible source base and gives us held-out repositories for evaluation.

## Scope

- Preserve `repo-corpus.md` as the research artifact with 30 Go repositories and 30 Rust repositories.
- Author model-invocable skills named `golang` and `rust`; avoid the skill name `go` because it is a common English verb and likely to mis-trigger.
- Add matching Cursor rules and Codex skill installs so Claude, Cursor, and Codex stay in parity.
- Wire the skills into the Go and Rust language packs so Go projects receive only `golang`, Rust projects receive only `rust`, and mixed projects receive both.
- Add conditional schema support if needed so template-backed files can be installed only when `ctx.languages?.golang` or `ctx.languages?.rust` is true.
- Update schema, skill/Cursor parity fixtures, setup/upgrade tests, and reset/uninstall coverage.
- Use the corpus for skill design and evaluation; keep repo-specific tricks out of the shipped skills.

## Main Catch-Up

`origin/main` now contains `experiments/gepa-review-spec/`, a completed GEPA
research spike for the `review-spec` skill. Reuse its durable assets instead of
starting a new optimizer harness from scratch:

- Dataset/task/evaluator/harness seams under `experiments/gepa-review-spec/src/`.
- Python GEPA adapter and TypeScript metric bridge under
  `experiments/gepa-review-spec/gepa/run.py` and `experiments/gepa-review-spec/gepa-eval.ts`.
- `validate-skill.ts` accept gate and `rescore.ts` token-free replay tool.
- `LOGGING-BRIEF.md` guidance for turning real skill invocations into eval data.

The spike also found the failure mode to design around: GEPA produced a
train-perfect but gamed, bloated candidate that memorized training fixtures and
referenced eval structure. Held-out metrics alone would have missed the gaming
because train and held-out shared the same one-defect fixture regularity. For
Go/Rust, the eval must vary task shapes, hide evaluator structure, and require
human review before any optimized text ships.

## Revised Plan

1. Create an isolated experiment, likely `experiments/gepa-language-skills/`,
   based on the `gepa-review-spec` seams rather than adding dependencies to
   `packages/cli`.
2. Build a task dataset from the repo corpus, not just a reading list. Start
   with a small pilot across several Go repos and several Rust repos before
   scaling toward the full 30 + 30.
3. Split by whole repository: train repos, validation repos, and final held-out
   repos. Do not let the optimizer see final held-out repos.
4. Use verifiable coding tasks: bug fixes, test additions, small features,
   refactors, and lint/build repairs. Every task needs an executable oracle
   such as tests, build, lint, or a deterministic verifier.
5. Make the evaluator return rich side information: task prompt, agent trace,
   patch summary, test/build/lint output, timing, and failure diagnostics.
6. Score with a hard correctness floor first. Secondary objectives can optimize
   time, diff size, lint cleanliness, and test quality, but they must not allow
   a candidate to trade away correctness.
7. Avoid eval-shape leakage: feedback must not reveal split names, expected
   defect counts, fixture regularity, or optimizer-specific vocabulary.
8. Vary task structure so a candidate cannot learn "one bug per task" or
   "always make the smallest possible edit" as an eval shortcut.
9. Compare at least three candidates: no language skill, human seed skill, and
   optimized skill. Optional: include a repo-specific skill as an upper bound.
10. Evaluate those candidates across both target model families: Claude Opus and
    GPT/Codex. Score by language x model x repository, then macro-average so a
    candidate cannot hide a regression on one model or one language behind gains
    elsewhere.
11. Treat GEPA output as proposal material, not shippable text. Human-distill
    general rules into the `golang` and `rust` skills, strip repo-specific or
    eval-aware guidance, then validate again.
12. Only after held-out improvement and human review, wire the skills into
    language-pack-conditioned installation for Claude, Cursor, and Codex.

## Acceptance Criteria

- [ ] `packages/cli/templates/skills/golang/SKILL.md` exists and gives Go-specific guidance for package structure, errors, contexts, concurrency, tests, tooling, and common agent failure modes.
- [ ] `packages/cli/templates/skills/rust/SKILL.md` exists and gives Rust-specific guidance for ownership, error handling, async, modules/crates, tests, tooling, unsafe boundaries, and common agent failure modes.
- [ ] A Go/Rust skill experiment reuses or cleanly adapts the `experiments/gepa-review-spec` dataset/task/evaluator/harness seams.
- [ ] The Go/Rust experiment has whole-repository train/validation/held-out splits.
- [ ] The evaluator uses executable coding-task oracles and rich side information, not an LLM judge as the primary signal.
- [ ] The optimization gate blocks correctness regressions before considering time, diff size, lint cleanliness, or test-quality improvements.
- [ ] The eval design includes anti-gaming controls learned from E2D8S5: varied task structure, no eval-shape leakage, and human inspection of the candidate diff.
- [ ] No-skill, seed-skill, and optimized-skill conditions are evaluated on both Claude Opus and GPT/Codex before shipping.
- [ ] A candidate must not regress either target model family on held-out repositories; model-specific gains must be visible separately, not only in an aggregate.
- [ ] GEPA output is not shipped verbatim; accepted improvements are human-distilled into language-general rules and revalidated.
- [ ] Matching Cursor rules exist and point at the Claude skills instead of duplicating long guidance.
- [ ] Codex receives matching `.agents/skills/golang/SKILL.md` and `.agents/skills/rust/SKILL.md` installs.
- [ ] Go language pack setup/upgrade installs `golang` guidance for Go projects and does not install `rust` guidance unless Rust is also detected.
- [ ] Rust language pack setup/upgrade installs `rust` guidance for Rust projects and does not install `golang` guidance unless Go is also detected.
- [ ] Non-Go/Rust projects do not receive either language skill from pack-conditioned installation.
- [ ] Reset/uninstall removes the installed language skill files.
- [ ] Parity and validation tests pass for schema entries, skill frontmatter, Cursor mappings, and Codex skill installation.
- [ ] Evaluation plan uses held-out repositories from `repo-corpus.md`, split by repository rather than by task.

## Work Log

- 2026-06-25T05:41:08Z Updated: Started Rust first via child ticket
  [M6CQAT](../M6CQAT-rust-language-skill-optimization/ticket.md). The Rust slice
  is scoped to the isolated experiment/evaluator before product skill wiring,
  with sandboxing, per-model/per-repo scoring, and anti-gaming gates as blocking
  requirements.
- 2026-06-25T05:25:13Z Updated: Added Opus + GPT/Codex model-transfer evaluation as a shipping gate for no-skill, seed-skill, and optimized-skill conditions.
- 2026-06-25T05:17:41Z Updated: Fast-forwarded to `origin/main` and revised the plan around the new `experiments/gepa-review-spec/` harness and its anti-gaming lessons.
- 2026-06-25T05:09:39Z Updated: Expanded ticket from corpus-only research to implementation scope for `golang` and `rust` language skills installed through language packs.
- 2026-06-25T05:00:49Z Complete: Created GitHub issue https://github.com/ArcadeAI/safeword/issues/430 and linked it in ticket frontmatter.
- 2026-06-25T04:57:56Z Complete: Created `repo-corpus.md` with exactly 30 Go repositories and 30 Rust repositories; verified markdownlint with 0 errors.
- 2026-06-25T04:54:40Z Found: `gh` access resolves the private Arcade repo as `ArcadeAI/monorepo`; Engine is at `apps/engine`, module `github.com/ArcadeAI/Engine`, `go 1.26.4`.
- 2026-06-25T04:50:36Z Started: Preparing corpus criteria and researching current repo/toolchain metadata for Go and Rust.
- 2026-06-25T04:50:23.537Z Started: Created ticket ARPCQA
