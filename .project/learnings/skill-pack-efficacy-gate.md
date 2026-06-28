# Skill-Pack Efficacy Gate: Prove Behavior Change, Not Provenance

Covers: skill-pack adoption gate, efficacy eval, headroom probe, deterministic grader, control-vs-treatment, picker-cost, experiments/ harness role.

**Finding:** A third-party coding-skill pack (samber/cc-skills-golang and the Python/TS/Rust equivalents, #482/#538/#539/#540) earns its **always-on picker cost (~5–6k tokens, every turn, prompt-cached)** only if it measurably changes what the agent writes. Provenance — permissive license, stars, active maintenance, language-core focus — gets a pack *onto the shortlist* but is **not** evidence it works. The only proof is a behavior-delta eval. Adopt nothing on stars alone.

**Scope — what this gate proves and what it does NOT.** The gate measures **content efficacy: does the skill change behavior _given it is in the agent's context_** (force-fed / pre-pointed by path). That is a **necessary** condition — if force-feeding the skill doesn't move a trap, the picker surfacing it is moot, so kill it. It is **not sufficient** to justify the picker cost: passing the content gate does NOT prove the live picker/native description-triggering actually surfaces this skill among ~40 others at the right moment. That self-selection step is a **separate, still-open question** (the Go spike pre-pointed both arms at the one relevant skill, so it never tested it — see the README CORRECTION). Treat picker reliability as a distinct, live multi-skill check, not something this gate certifies.

## The protocol (the durable asset — the per-language trap is disposable)

1. **Headroom-probe FIRST — control-only, N≈4.** Give N agents the trap prompt with **no** skill. If they already write the idiomatic answer, the trap has **zero headroom** and is dead — pick a subtler idiom. Do this *before* building the full eval.
2. **High-headroom idioms are usually the ones standard linters DON'T catch.** Heuristic, not law: if a default linter flags it, the model has usually already internalized the rule and complies — that's *why* it tends to be low-headroom. So don't reach for `ruff B006` / `no-explicit-any` / a stock `clippy` lint and assume headroom — probe it; most are already-avoided.
3. **Deterministic grader, no LLM judge.** Often a **custom AST/grep check**, not the off-the-shelf linter. Use a linter rule only when the model genuinely violates a non-default rule.
4. **Control vs treatment, N≈4.** Treatment = the skill **force-fed into context** (pre-pointed by path / pasted body), NOT relying on the live picker — this isolates content efficacy. Pass = a clean **0/N → N/N swing** on a trap with *no defensible exception*. Bump N only if the swing is murky (it's a go/no-go gate, not a production rate). A clean swing here certifies the *content*, not that the picker will surface it — that's the separate check in the Scope note above.
5. **No swing → the pack is decorative.** Don't ship it — it's pure picker-cost for zero benefit. Try the alternative pack, or author/sponsor one.

**Shortcut — mine the pack's own evals before probing.** If the pack publishes control-vs-treatment numbers (samber's `cc-skills-golang/EVALUATIONS.md` does — 98% with-skill vs 56% without across 3,395 assertions, with per-skill deltas), use them as a **headroom prior**: skills already at ceiling there (e.g. `golang-spf13-viper` 100%→98%, −2pp) are decorative and don't earn picker cost, while high-delta skills (e.g. `golang-samber-do` 19%→100%, +81pp) are where the lift lives. Spend your own probe budget on the high-delta skills and on confirming the picker actually surfaces them. Caveat: their treatment feeds the skill into context (content efficacy, same scoping as ours) and some graders are human-judged with no inter-rater reliability reported — so it's a prior to *prioritize* probing, not a substitute for it. A pack shipping its own honest evals is itself a sourcing signal.

## The Go evidence (ticket D50Q0T, `experiments/go-skill-directive/`)

- **Race trap, graded by `go test -race`:** 12/12 controls already wrote safe code → **0% headroom, abandoned.** The built-in-tool grader was the trap's downfall, not its strength.
- **Context-in-struct, graded by a hand-built Go AST checker** (`checker/main.go` — no Go linter flags it): control **0/4 → treatment 4/4.** Real lift on a subtle, no-exception idiom. This is the shape to copy.
- **Sample caveat:** N=4, one trap, one language, one model generation — a clean *directional* signal, not a production rate. The swing is what gates go/no-go; don't read the 4/4 as a reliability number.

## What the harness should be (decided via /figure-it-out)

- **The method is the durable artifact (this doc).** Per-language trap+grader are **disposable spikes** under `experiments/<lang>-skill-eval/` — matching the existing `experiments/` convention (`gepa-review-spec`, `go-skill-directive`): self-contained, deterministic grader, manual orchestration, results logged in the ticket, directional go/no-go.
- **Do NOT productize it or put it in CI** — it runs ~5–10× lifetime (per language, per pack-version bump), not a regression invariant; the `Workflow` primitive already covers orchestration if manual fan-out ever hurts. Generalize a shared runner only on the *third* eval (rule of three), not speculatively.
- The current manual / N=4 / "directional" form is **correct for a go/no-go gate** — don't gold-plate it.

**When:** run this gate before adopting any language skill pack, and re-run on a pack-version bump. It is a **Done-when** item in the language tickets, not optional prose.
