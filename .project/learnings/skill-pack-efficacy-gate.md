# Skill-Pack Efficacy Gate: Prove Behavior Change, Not Provenance

Covers: skill-pack adoption gate, efficacy eval, headroom probe, deterministic grader, control-vs-treatment, picker-cost, experiments/ harness role.

**Finding:** A third-party coding-skill pack (samber/cc-skills-golang and the Python/TS/Rust equivalents, #482/#538/#539/#540) earns its **always-on picker cost (~5–6k tokens, every turn, prompt-cached)** only if it measurably changes what the agent writes. Provenance — permissive license, stars, active maintenance, language-core focus — gets a pack *onto the shortlist* but is **not** evidence it works. The only proof is a behavior-delta eval. Adopt nothing on stars alone.

## The protocol (the durable asset — the per-language trap is disposable)

1. **Headroom-probe FIRST — control-only, N≈4.** Give N agents the trap prompt with **no** skill. If they already write the idiomatic answer, the trap has **zero headroom** and is dead — pick a subtler idiom. Do this *before* building the full eval.
2. **High-headroom idioms are usually the ones standard linters DON'T catch.** If a default linter flags it, the model already complies (that's *why* it's low-headroom). So don't reach for `ruff B006` / `no-explicit-any` / a stock `clippy` lint and assume headroom — most are already-avoided.
3. **Deterministic grader, no LLM judge.** Often a **custom AST/grep check**, not the off-the-shelf linter. Use a linter rule only when the model genuinely violates a non-default rule.
4. **Control vs treatment (skill surfaced), N≈4.** Pass = a clean **0/N → N/N swing** on a trap with *no defensible exception*. Bump N only if the swing is murky (it's a go/no-go gate, not a production rate).
5. **No swing → the pack is decorative.** Don't ship it — it's pure picker-cost for zero benefit. Try the alternative pack, or author/sponsor one.

## The Go evidence (ticket D50Q0T, `experiments/go-skill-directive/`)

- **Race trap, graded by `go test -race`:** 12/12 controls already wrote safe code → **0% headroom, abandoned.** The built-in-tool grader was the trap's downfall, not its strength.
- **Context-in-struct, graded by a hand-built Go AST checker** (`checker/main.go` — no Go linter flags it): control **0/4 → treatment 4/4.** Real lift on a subtle, no-exception idiom. This is the shape to copy.

## What the harness should be (decided via /figure-it-out)

- **The method is the durable artifact (this doc).** Per-language trap+grader are **disposable spikes** under `experiments/<lang>-skill-eval/` — matching the existing `experiments/` convention (`gepa-review-spec`, `go-skill-directive`): self-contained, deterministic grader, manual orchestration, results logged in the ticket, directional go/no-go.
- **Do NOT productize it or put it in CI** — it runs ~5–10× lifetime (per language, per pack-version bump), not a regression invariant; the `Workflow` primitive already covers orchestration if manual fan-out ever hurts. Generalize a shared runner only on the *third* eval (rule of three), not speculatively.
- The current manual / N=4 / "directional" form is **correct for a go/no-go gate** — don't gold-plate it.

**When:** run this gate before adopting any language skill pack, and re-run on a pack-version bump. It is a **Done-when** item in the language tickets, not optional prose.
