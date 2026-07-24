# review-spec eval — reference implementation

The working eval that adjudicated review-spec's prompt (epic 7ZLTWB, hardened in
21RAT9). This is the **copyable reference** for
`.safeword/guides/skill-eval-optimization-guide.md`. To eval a new seeded-corpus
skill, copy this directory and swap the corpus + defect taxonomy — do **not**
extract a shared framework until a third skill needs one (rule of three).

**Isolation:** everything lives here under `experiments/`. No runtime dependency is
added to `packages/cli`; the shipped skill is untouched. Delete this dir and nothing
else changes.

## Seams (what to change per skill)

| File / dir         | Role                                                                                             | Per-skill?                      |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------- |
| `fixtures/`        | `<name>.feature` + `<name>.expected.json` (32 pairs)                                             | **yes** — corpus                |
| `src/types.ts`     | defect taxonomy (`DefectType`, `DEFAULT_SEVERITY`)                                               | **yes**                         |
| `src/dataset.ts`   | load fixtures + train/test split                                                                 | mostly generic                  |
| `src/task.ts`      | run the skill prompt over a fixture → `Detection[]`; vendor runners + the eval output contract   | generic (swap the contract)     |
| `src/evaluator.ts` | deterministic set-matching metric — decoupled recall + false-alarms, family-level, no F1         | generic                         |
| `src/protected.ts` | the relative recall floor + `⌈2N/3⌉` consensus                                                   | **generic — the reusable core** |
| `src/harness.ts`   | composes dataset+task+evaluator, platform-agnostic; `src/adapters/` stubs LangSmith/Phoenix/GEPA | generic                         |

## Entry points (all spend tokens — wrap with `op run`)

```bash
# Build the protected-set manifest from k baseline runs (once per model/corpus)
SAFEWORD_EVAL_MODEL=claude-sonnet-5 bun compute-protected.ts 5 # → baseline-protected.json

# Multi-run accept gate: seed vs candidate on the held-out split (the ship gate)
bun validate-skill.ts gepa/candidate.md 5 test # ACCEPT / REJECT (floor) + precision

# Stability probe: per-fixture variance + which seeds flip (diagnosis, not a gate)
bun stability.ts 3

# GEPA optimizer (optional — proposes candidates; the gate decides)
gepa/.venv/bin/python gepa/run.py --max-metric-calls 250
```

Unit tests (no key, deterministic): `npx vitest run` from this directory.
`rescore.ts <trace>` re-scores a saved `SAFEWORD_EVAL_TRACE=1` run token-free.

## Discipline (full list in the guide)

- The **eval is the gate**; GEPA only proposes. **Never auto-adopt a winner** —
  review-spec's raw GEPA winner was REJECTED (it gamed the eval by dropping a real
  second defect); a human-authored lean candidate beat it and shipped.
- **Read the log, not the exit code** — wrapper/background exit codes lie.
- **Certify every new fixture** (a paid run) before committing it.
- Recall and false-alarms stay **decoupled** — no composite F1 headline.

## Not for every skill

The floor + consensus need a **seeded item set**. A human-judgment-bound skill (e.g.
pr-review) has none — it uses a real-corpus + human-triage eval instead
(WAWQA6/CWGYH0), a different _shape_ that reuses only the discipline, not this
machinery.
