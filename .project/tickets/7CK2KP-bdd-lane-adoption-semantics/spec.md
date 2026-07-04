# Spec: BDD lane adoption semantics: stub convention, verification lane, tag semantics

## Intent

Make safeword's BDD guidance and `codify` output coexist with an adopted host
cucumber harness's house style — by pointing agents at the host's own
conventions doc instead of prescribing mechanics that rot (wrong stub shape,
run-and-expect-failure verification, tag filters that bypass profile safety
exclusions).

## Intake Brief

- **Requested by:** ArcadeAI (issue #650, split from #645) — evidence from a quality-review of arcade-monorepo's drifted hand-rolled `codify-spec` skill.
- **Cost of inaction:** in adopted-harness repos, safeword's installed prose actively gives wrong instructions: foreign-shaped stubs, a verify story that boots a 4-service Docker stack, and `--tags` overrides that silently discard `not @wip` safety exclusions.
- **Reversibility:** two-way door — one optional config key (`bdd.conventions`) plus prose wording; zero behavior when unset. Structured schema (the one-way door) is explicitly deferred.

## References

- https://github.com/ArcadeAI/safeword/issues/650 and https://github.com/ArcadeAI/safeword/issues/645#issuecomment-4872888630
- Ticket 56JCFZ (paths/detection substrate), ticket.md Design Decision section (gate: lean now, structure deferred).

## Personas

- Technical Builder (TB)

## Surfaces

Affected:

- CLI (`safeword codify`) — covered by e2e scenarios in test-definitions.md
- Claude Code, Cursor, OpenAI Codex — via the installed BDD skill prose; skip: prose is surface-uniform (same markdown installed for all three), no per-surface scenario needed

## Jobs To Be Done

### bdd-lane-adoption.TB1 — Adopt safeword without fighting my existing cucumber suite

**Persona:** Technical Builder (TB)

> When I install safeword into a repo that already has a mature cucumber
> harness with its own house style, I want safeword's BDD guidance and codify
> output to follow my harness's documented conventions, so I can keep one
> consistent acceptance suite instead of reviewing foreign-shaped stubs and
> unsafe test invocations.

#### bdd-lane-adoption.TB1.AC1 — Codify surfaces my conventions doc when I configure one

#### bdd-lane-adoption.TB1.AC2 — Safeword's installed guidance defers to my lane and conventions instead of prescribing its defaults

## Rave Moment

skip: table-stakes — coexistence is expected behavior, not a wow moment.

## Outcomes

- An adopted-harness repo can set `bdd.conventions` and see codify point every
  emission at the host doc; agents follow house style without per-session
  re-explanation.
- No behavior change for the majority case (no pre-existing cucumber, key
  unset).

## Open Questions

- defer: whether `bdd.excludedTags` deserves machine enforcement (lint-gherkin warning) — slice 2, pending a second real host (see ticket Design Decision).
