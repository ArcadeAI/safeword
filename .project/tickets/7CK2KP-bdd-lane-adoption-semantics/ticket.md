---
id: 7CK2KP
slug: bdd-lane-adoption-semantics
type: feature
phase: done
status: done
blocked_on: []
relates_to: [56JCFZ]
external_issue: https://github.com/ArcadeAI/safeword/issues/650
created: 2026-07-03T14:30:29.173Z
last_modified: 2026-07-04T16:11:00Z
scope:
  - "Surgical coexistence with an adopted host harness at N=1 evidence (design decision 2026-07-03, see Design Decision section): defer, don't model."
  - "De-hardcode installed BDD prose (bdd/SCENARIOS.md, TDD.md, planning-guide): lane paths become 'root features/ by default, paths.features when configured'; RED verification becomes harness-relative ('run-and-expect-failure applies to safeword's scaffolded lane; harnesses with dry-run/check profiles use those'). Static deferral wording — no template-rendering machinery exists or is added; prose defers to config at read time."
  - "One config key `bdd.conventions`: path to a host-owned conventions doc (stub style, verification profiles, tag rules, step layout). When set, installed prose directs the agent to read and follow it over the defaults, and `safeword codify` prints a one-line pointer to it. Zero behavior when unset."
out_of_scope:
  - Path configurability and collision detection (ticket 56JCFZ).
  - Executing host JS cucumber configs to extract profiles (correctness/safety mess; static json/yaml reading may be considered).
  - "Structured convention modeling — deferred pending a second real host: stub-template engine / cucumber step-stub emitter (codify has none today; building one that matches arbitrary house styles is the losing game the design decision rejects), verify-command runner with dry-run report parsing (cucumber `--dry-run` exits zero on undefined/ambiguous steps), machine-enforced `bdd.excludedTags` (natural slice 2: lint-gherkin/check warning when a tag filter bypasses exclusions)."
done_when:
  - "Gate decision recorded: build the lean pointer slice now; defer structured knobs pending a second real host harness. Evidence gap named: N=1 (ArcadeAI/arcade-monorepo), and house styles are heterogeneous — more examples validate the SLOTS (every harness has a stub style, a wiring-check, tag rules) but can never converge on VALUES, so schema stays pointer-shaped until slot structure is proven."
  - Installed prose templates no longer hardcode `features/<slug>.feature` + `steps/` + run-and-expect-failure; wording defers to configured paths and, when set, the conventions doc.
  - "`bdd.conventions` documented (configuration.mdx), consumed by the installed prose and surfaced by codify, test-backed against a fixture harness."
---

# BDD lane adoption semantics: stub convention, verification lane, tag semantics

**Goal:** Make `safeword codify` output and the BDD skill prose match an adopted host cucumber harness — not just its paths (56JCFZ) but its stub convention, spec-ahead verification lane, and tag-exclusion semantics.

**Why:** The issue #645 design comment reviewed ArcadeAI/monorepo's hand-rolled `codify-spec` skill: every hardcoded mechanic had drifted from the real harness (prescribed throw message appears in zero step files; prescribed verify command boots a 4-service Docker stack and its `--tags` override silently discards profile safety exclusions; "one step file per spec" contradicted by an 8-file spec) while goal-level rules stayed correct. Prose carrying these as hardcoded instructions is what rotted; config or detection is the durable home.

## Evidence

- Issue comment: https://github.com/ArcadeAI/safeword/issues/645#issuecomment-4872888630 (the three knobs and the rot mechanism).
- Cucumber-js dry-run docs: reports undefined/ambiguous but exits zero — "run tags and expect failures" is the wrong verify story for harnesses whose executable profiles exclude spec-ahead work and whose hooks boot infrastructure.
- Deliberately deferred from 56JCFZ (figure-it-out 2026-07-03): schema designed from N=1 host would be semver-committed before its shape is known — K7N2QM precedent against speculative config surface.

## Investigation findings (issue #650 pickup, 2026-07-03)

Codebase audit of where each knob would land, against `main` + the 56JCFZ branch:

1. **Stub convention is a missing capability, not just a missing config.** `codify` emits only vitest skeletons — `it.todo(title)` default, `throw new Error('not implemented')` under `--red` (`packages/cli/src/utils/test-skeleton.ts` `renderTest`) — plus passthrough Gherkin. There is **no cucumber step-definition stub emitter at all**; the scaffolded lane relies on generic shell-out steps (`templates/cucumber/shared.steps.ts`). "Match the host's stub convention" therefore implies first building step-stub emission, then making its template configurable — a bigger slice than the issue framing suggests. The build-branch scope should name this explicitly.
2. **The wrong verify story is codified in prose today.** `templates/skills/bdd/TDD.md` ("If no matching steps exist, the first RED can be `bun run test:bdd` failing with undefined or pending steps") is exactly the run-and-expect-failure assumption the issue calls out. No dry-run concept exists anywhere in the codebase. Confirms the scope note: the verify lane needs dry-run *report parsing*, since `--dry-run` exits zero on undefined/ambiguous steps.
3. **Tag semantics are absent.** `emitGherkinFeature` emits only lineage `@<jtbd>.AC#` tags; nothing models host tag exclusions (`not @wip` etc.).
4. **Prose hardcoding inventory:** `features/<slug>.feature` + `steps/` appear in `bdd/SCENARIOS.md` (×3), `guides/planning-guide.md` (×4), `bdd/TDD.md` (×2) — unchanged on the 56JCFZ branch, i.e. the prose-parameterization scope item is still fully open.
5. **Substrate confirmed on the 56JCFZ branch:** `paths.features`/`paths.steps` via `resolveConfiguredLaneDirectory` (augment-not-replace), harness detection with own-lane self-exclusion, and `safeword check` advisories. A `bdd` config block would sit alongside `paths` and be consumed at the same choke points (`feature-source.ts`, emitters, check).
6. **Dependency status:** 56JCFZ is complete on `claude/safeword-issue-645-s78mvk` (R/G/R ledger done, quality-reviewed, verified) but **unmerged and has no PR** — this ticket is doubly blocked until that lands.
7. **Gate status:** evidence remains N=1 (ArcadeAI/arcade-monorepo). Resolved by the Design Decision below.

## Design Decision (2026-07-03, gate closed: build lean now, defer structure)

**Question:** most surgical coexistence with arcade-monorepo's harness given no second use case. Options weighed:

1. **Zero-config** (rely on the host's own CLAUDE.md/AGENTS.md): rejected — safeword's installed prose actively prescribes wrong mechanics (run-and-expect-failure, `steps/` layout, stub shape), so silence doesn't fix the lying prose.
2. **Three structured keys** (stub template / verify command / excluded tags): rejected at N=1 — house styles are heterogeneous, so a second example validates the *slots* but can never converge the *values*; a stub-template engine and dry-run report parser are large builds that still wouldn't match arbitrary house styles; semver-commits schema before its shape is known (K7N2QM precedent).
3. **Deferral prose + one pointer key** (`bdd.conventions` → host-owned doc): **chosen.** The doc lives next to the harness, maintained by whoever changes the harness — the exact fix for the rot mechanism that killed arcade-monorepo's codify-spec skill (conventions transcribed into far-away prose). Safeword's consumer is an agent; pointing it at the source of truth beats reproducing style. One string key = minimal semver surface; zero behavior when unset (most customers have no cucumber). Docs hosts write become the evidence corpus for later structure promotion.

**Feasibility check (2026-07-03):** no template-var rendering machinery exists for installed skills (verified by grep) — skills copy verbatim. Deferral wording that reads config at agent-read-time is therefore the only no-new-machinery path, and it's also the durable one.

**Host-side counterpart (arcade-monorepo, not this repo's work):** write `tests/CONVENTIONS.md` (pending-helper stub style, `check`/`check-steps` dry-run profiles, `@wip`/`@requires-owned-stack` tag rules, step layout); set `paths.features`/`paths.steps` + `bdd.conventions` in `.safeword/config.json`.

## Work Log

- 2026-07-03T14:30:29.173Z Started: Created ticket 7CK2KP as the deferred second slice of issue #645.
- 2026-07-03 Blocked on 56JCFZ (path/detection substrate) and on a second real host harness to validate the schema shape.
- 2026-07-03T14:45Z Quality-review pass 1: done_when restructured — gate decision (build vs defer) comes first; stub/prose items apply only on the build branch, resolving the build-vs-defer contradiction.
- 2026-07-03T16:55Z Issue #650 pickup: scope now has its own upstream issue (split from #645) — external_issue repointed. Recorded codebase-audit findings above; ticket carried onto branch `claude/safeword-issue-650-airxby`. Still blocked: 56JCFZ unmerged (no PR), schema evidence still N=1.
- 2026-07-03T19:20Z Gate decision closed with user (design discussion on issue #650 branch): build the lean slice (deferral prose + `bdd.conventions` pointer key), defer all structured convention modeling pending a second real host. Scope/out_of_scope/done_when rewritten accordingly; option weighing recorded in Design Decision section. Still blocked on 56JCFZ landing (prose de-hardcoding touches files changed on that branch; `paths.features` deferral wording depends on its config keys).
- 2026-07-03T19:35Z Lean slice implemented on `claude/safeword-issue-650-airxby`, stacked on the 56JCFZ branch (merged in; PR ordering: #645 branch must land first). `readBddConventionsPath` in configured-paths.ts; codify prints the pointer to stderr (stdout stays pipeable) — covered by 2 new e2e tests (15/15 codify tests pass; 51/51 across codify + lane-paths + schema). Prose de-hardcoded in TDD.md / SCENARIOS.md / planning-guide.md (templates + this repo's installed copies); `bdd.conventions` documented in configuration.mdx.
- 2026-07-04T16:26Z Done: PR #756 open. Full pipeline green — /verify (4606 tests, 243 Gherkin, build/lint/typecheck), /audit 0/0, /quality-review (caught + fixed a rebuild regression that dropped the SQL-formatting docs section; finished prose de-hardcoding in planning-guide + bdd/SKILL.md), /refactor (code already minimal, no change). Ticket flipped implement→verify→done to satisfy the PR ticket-done gate.
