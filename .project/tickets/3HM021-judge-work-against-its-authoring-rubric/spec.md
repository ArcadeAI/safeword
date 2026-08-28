# Shared scenario-quality standard

## Jobs To Be Done

### 3HM021.SWM1 — Safeword maintainer

**Persona:** Maintainer

When I change how scenarios should be judged, I want authors and independent reviewers to receive the same standard, so the workflow cannot silently drift between coaching and enforcement.

#### 3HM021.SWM1.R1 — scenario authors see the gate standard before writing

#### 3HM021.SWM1.R2 — independent reviewers apply the canonical skill rather than a summary copy

#### 3HM021.SWM1.R3 — phase guidance and exit evidence announce the same shared standard

## Surfaces

Affected: Claude Code, OpenAI Codex, Cursor

## Engineering Contract

Preserve the public `review-spec` skill and command. The template skill is canonical; generated host surfaces continue to derive from it through existing generators and parity checks.

`Authoring mode` means the named section of `review-spec/SKILL.md` that tells the define-behavior agent to apply the shared rubric while drafting without launching the independent coordinator. It is not a second skill, flag, or rubric.

The independent prompt's shared-rubric block must be byte-identical to the current canonical template skill. Required project-knowledge paths are resolved at launch time; existing files are passed as supporting context and absent optional files are omitted rather than fabricated or treated as errors.

The required ticket spec is different: without it, scenario-gate cannot judge invariants or scope and must refuse dispatch. Existing generated-surface parity checks are the observable enforcement when a host copy drifts from the canonical template.
