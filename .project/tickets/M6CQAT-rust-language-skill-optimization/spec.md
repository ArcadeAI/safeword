# Spec: Optimize the Rust language skill with held-out repositories

## Intent

Prove that a language-general Rust skill can improve coding-agent behavior on
held-out Rust repositories without teaching repo-specific tricks or evaluator
shortcuts. The feature starts with an isolated optimization/evaluation loop, then
ships only the human-distilled Rust guidance that survives sandboxed held-out
validation across Claude Opus and GPT/Codex.

## Intake Brief

- **Requested by:** Alex, as the Rust-first slice of ARPCQA/#430 after the Go and
  Rust corpus was created.
- **Cost of inaction:** Safeword can ship a plausible Rust skill that is based on
  taste and memory instead of measured transfer. Worse, an optimizer can overfit
  to the eval and make agents worse on one model family while aggregate numbers
  look better.
- **Reversibility:** Two-way door until product wiring. The experiment lives under
  `experiments/` and can be removed without changing `packages/cli`; the shipped
  skill and language-pack install are gated until held-out results pass.

## References

- Parent ticket: [ARPCQA](../ARPCQA-go-rust-repo-corpus/ticket.md)
- Corpus: [repo-corpus.md](../ARPCQA-go-rust-repo-corpus/repo-corpus.md)
- Existing local GEPA spike: `experiments/gepa-review-spec/`
- GEPA paper: <https://arxiv.org/abs/2507.19457>
- GEPA optimize-anything blog:
  <https://gepa-ai.github.io/gepa/blog/2026/02/18/introducing-optimize-anything/>
- gskill coding-agent blog:
  <https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/>

## Personas

- **Technical Builder (TB)** — installs safeword into Rust or polyglot projects
  and expects the agent to make Rust-appropriate engineering decisions.
- **Safeword Maintainer (SM)** — builds the experiment, reviews optimizer output,
  and wires the accepted skill into the language-pack surface.

## Vocabulary

- **Language skill** — an agent-readable `SKILL.md` that teaches general Rust
  engineering behavior, not one repository's commands.
- **Candidate skill** — one of the evaluated guidance variants: no-skill, human
  seed skill, or optimized skill.
- **Whole-repository split** — train, validation, and held-out partitions where a
  repository appears in exactly one split.
- **Executable oracle** — a deterministic command or verifier such as
  `cargo test`, `cargo check`, `cargo clippy`, a benchmark threshold, or a
  repository-specific script run inside the sandbox.
- **Eval-shape leakage** — feedback or candidate text that reveals split names,
  expected bug counts, fixture regularity, optimizer vocabulary, or other details
  that help game the evaluator rather than write better Rust.

## Jobs To Be Done

### rust-language-skill-optimization.TB1 — Get Rust-aware agent behavior that transfers

**Persona:** Technical Builder (TB)

> When I use an AI coding agent in a Rust codebase, I want safeword's language
> pack to steer it toward idiomatic Rust decisions that have been validated on
> held-out repositories, so I can trust the guidance is not just copied from one
> project or tuned to one model.

#### rust-language-skill-optimization.TB1.AC1 — Rust guidance improves or holds steady on held-out repositories for both Claude Opus and GPT/Codex

#### rust-language-skill-optimization.TB1.AC2 — Rust projects receive Rust guidance only when Rust is detected

#### rust-language-skill-optimization.TB1.AC3 — The shipped Rust guidance stays language-general and avoids repo-specific commands or memorized corpus details

### rust-language-skill-optimization.SM1 — Optimize Rust guidance without trusting misleading scores

**Persona:** Safeword Maintainer (SM)

> When I optimize a Rust skill from a repository corpus, I want a sandboxed eval
> harness with whole-repository splits, executable oracles, and anti-gaming review,
> so I can separate real Rust transfer from prompt overfitting before anything
> ships.

#### rust-language-skill-optimization.SM1.AC1 — The Rust experiment runs in isolation from shipped CLI dependencies

#### rust-language-skill-optimization.SM1.AC2 — Every Rust task is sandboxed and scored by executable oracles before secondary metrics matter

#### rust-language-skill-optimization.SM1.AC3 — The eval reports model-family and repository-level results instead of only a single aggregate score

#### rust-language-skill-optimization.SM1.AC4 — GEPA output is reviewed and human-distilled before any template file changes

## Rave Moment

skip: internal quality feature; the user-facing value is trustworthiness, not a
single screenshotable moment.

## Outcomes

- Safeword has a Rust-first language-skill experiment that can prove whether a
  candidate skill helps actual Rust coding tasks instead of optimizing prose.
- Maintainers can see exactly where a candidate helps or hurts by repository and
  model family.
- The eventual `rust` skill is grounded in held-out evidence and human review,
  then installed only for detected Rust projects.

## Open Questions

- defer: exact task count per pilot repository should be chosen during dataset
  implementation after checkout/runtime cost is measured.
