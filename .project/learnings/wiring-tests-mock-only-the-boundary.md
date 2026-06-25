# Wiring Tests — Mock Only the Process Boundary

Covers: every entry-point needs one real-collaborator wiring test, internal-seam
mocks, false greens, mock only the process boundary, sync-tracker corpus-walk miss (#349, #363).

A suite that fakes _internal_ seams can be fully green while the real wiring is
broken. While building `sync-tracker` (#349), `readCorpus` passed `cwd` to
`readTickets`, which actually takes the _tickets directory_ — so with a
configured provider it scanned the repo root and projected **zero tickets**. The
bug survived 21 scenarios, 61 tests, an independent scenario-gate review,
`/verify`, `/audit`, and `/quality-review` — every gate green — because every
test faked at an internal seam: the orchestrator tests hand-built
`tickets`/`config`, and the only command-level test used `provider: none`, which
short-circuits _before_ the corpus walk. The one seam that mattered (real config
→ real corpus → orchestrator) was never exercised.

## The rule

Name the **process boundary** you mock — the network, filesystem, clock, or
subprocess at the edge of your code — and mock _only_ that. Every entry point or
command that wires modules together gets **≥1 test built from real
collaborators**, faking nothing but that boundary.

If the only way to exercise a code path is through an injected internal value
(`provider: 'none'`, a hand-passed `repoVisibility`) and never through the real
command, that path has **no wiring test** — add one.

## Why gates missed it

Completion metrics — "21/21 scenarios", "all ACs covered" (lineage tags),
`/verify` green, `/audit` passed — are **all satisfiable by a fully-mocked
suite**. None measures integration/wiring coverage. `/audit` samples _existing_
tests for anti-patterns; a _missing_ wiring test leaves no artifact to flag.
Independent reviews reasoned over the same fully-mocked artifacts and shared the
blind spot. The fix is guidance + one pointed review question at the decision
points, not a new presence-checking gate (which would enforce that a line
exists, not that a real wiring test does).

## Where it now lives

- `testing/SKILL.md` → "Wiring Tests — Mock Only the Process Boundary"
- `bdd/SCENARIOS.md` → impl-plan **Approach** names the mocked boundary + assigns
  the wiring test
- `quality-review/SKILL.md` → **Wiring gate (required)**
- `review-spec/SKILL.md` → **Wiring** cross-cutting lens
