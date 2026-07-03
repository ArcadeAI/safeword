---
id: 7CK2KP
slug: bdd-lane-adoption-semantics
type: feature
phase: intake
status: blocked
blocked_on: [56JCFZ]
relates_to: [56JCFZ]
external_issue: https://github.com/ArcadeAI/safeword/issues/645
created: 2026-07-03T14:30:29.173Z
last_modified: 2026-07-03T14:35:00Z
scope:
  - Per-repo answers for how `safeword codify` output targets an adopted host harness — the three knobs from the issue #645 design comment.
  - "Stub convention" — what an unimplemented step body looks like in the host (throw message vs shared pending helper, naming/labeling), consumed by codify's emitters.
  - "Verification lane" — how to prove codified-but-unbuilt scenarios are wired without executing them (dry-run profile or equivalent), given cucumber-js `--dry-run` loads support code, skips hooks, and reports undefined/ambiguous steps WITHOUT failing the process — needs output handling, not just an exit code.
  - "Tag semantics" — which tags the host's profiles exclude by default, so generated scenarios/tag filters don't bypass safety exclusions (e.g. `not @wip` / `not @requires-owned-stack`).
  - Decide the durable home — config keys vs detection from the host's cucumber config/profiles — and how generated skill prose (bdd/SCENARIOS.md, TDD.md, planning-guide) gets parameterized at generation time instead of hardcoding `features/<slug>.feature` + `steps/`.
out_of_scope:
  - Path configurability and collision detection (ticket 56JCFZ).
  - Executing host JS cucumber configs to extract profiles (correctness/safety mess; static json/yaml reading may be considered).
done_when:
  - "Gate decision recorded first: schema shape designed from ≥2 real host harnesses (not just ArcadeAI/monorepo), OR explicitly deferred pending demand with the evidence gap named. All items below apply only on the build branch; on the deferral branch this ticket closes with the recorded decision."
  - codify can emit stubs matching a configured host convention, and the verify story for spec-ahead scenarios is documented and test-backed against a fixture harness.
  - Generated prose templates no longer hardcode lane paths/conventions that config can carry.
---

# BDD lane adoption semantics: stub convention, verification lane, tag semantics

**Goal:** Make `safeword codify` output and the BDD skill prose match an adopted host cucumber harness — not just its paths (56JCFZ) but its stub convention, spec-ahead verification lane, and tag-exclusion semantics.

**Why:** The issue #645 design comment reviewed ArcadeAI/monorepo's hand-rolled `codify-spec` skill: every hardcoded mechanic had drifted from the real harness (prescribed throw message appears in zero step files; prescribed verify command boots a 4-service Docker stack and its `--tags` override silently discards profile safety exclusions; "one step file per spec" contradicted by an 8-file spec) while goal-level rules stayed correct. Prose carrying these as hardcoded instructions is what rotted; config or detection is the durable home.

## Evidence

- Issue comment: https://github.com/ArcadeAI/safeword/issues/645#issuecomment-4872888630 (the three knobs and the rot mechanism).
- Cucumber-js dry-run docs: reports undefined/ambiguous but exits zero — "run tags and expect failures" is the wrong verify story for harnesses whose executable profiles exclude spec-ahead work and whose hooks boot infrastructure.
- Deliberately deferred from 56JCFZ (figure-it-out 2026-07-03): schema designed from N=1 host would be semver-committed before its shape is known — K7N2QM precedent against speculative config surface.

## Work Log

- 2026-07-03T14:30:29.173Z Started: Created ticket 7CK2KP as the deferred second slice of issue #645.
- 2026-07-03 Blocked on 56JCFZ (path/detection substrate) and on a second real host harness to validate the schema shape.
- 2026-07-03T14:45Z Quality-review pass 1: done_when restructured — gate decision (build vs defer) comes first; stub/prose items apply only on the build branch, resolving the build-vs-defer contradiction.
