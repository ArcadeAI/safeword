# Spec: Autonomous PR review at the intent-conformance bar

## Intent

Give any project a PR reviewer that says only what its own tooling can't: did this change do what it said it would, is it bigger than it needed to be, is there a simpler shape, and what breaks if it's wrong. Safeword projects get the richest version of that review — because the intent was written down, before the code, as a contract.

## Intake Brief

- **Requested by:** Alex (2026-07-15) — "safeword to run as a server process or github action and review open PRs and do a super high quality eng review the way a top quality engineer or PM on a team would do", scope-corrected in the same session to "a top tier reviewer of any project, not just safeword's own... and of course, it should be awesome at its own."
- **Cost of inaction:** One per persona. **SM:** this repo merged 40 of its last 40 PRs with **zero** reviews at ~100 PRs/month; a 10-PR shadow probe found 3 live defects, two of them inert safety mechanisms in a cron running daily ([#1069](https://github.com/ArcadeAI/safeword/issues/1069)). **NTB:** they merge agent-written code they cannot read, with nothing between them and a confident agent shipping something broken. **TB:** the generic bots they'd otherwise reach for get ≤19.2% of comments acted on, and the recurring complaint is noise, not wrongness. Structurally: safeword already forces specs, `done_when`, and `Out of scope` into existence — without a reviewer that reads them, the discipline's biggest payoff goes uncollected.
- **Reversibility:** **Two-way door with a one-way edge.** The workflow is a deletable `.yml`, ships default-off, and runs warn-mode with no required status check — nothing is gated on it. The one-way edge: the skill and workflow become **ownedFiles** in `schema.ts` (upgrade-overwritten in installed projects), and any `.safeword/config.json` key becomes a compatibility surface under the versioning commitment. No data model, no migration.

## References

- **ticket.md** — the full decision record: architecture call, tier model, intent provenance, dynamic subtraction, any-project risks, pre-registered shadow bar.
- **Shadow probe (2026-07-15)** — 10 merged PRs, 14 findings, 6/6 spot-checks confirmed; maintainer triage outstanding.
- **[#1069](https://github.com/ArcadeAI/safeword/issues/1069)** — the three live defects the probe surfaced.
- **X4518B** — native-review overlap positioning; this answers it for the PR surface (delegate the mechanism, own the judgment).
- **E2D8S5 / `experiments/gepa-review-spec/`** — the eval discipline this inherits: decoupled metrics, no F1 headline, held-out corpus.
- Evidence: [Bacchelli & Bird ICSE 2013](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ICSE202013-codereview.pdf) (defects are 14% of review comments; understanding is the bottleneck), [Sadowski et al. ICSE-SEIP 2018](https://sback.it/publications/icse2018seip.pdf) (Tricorder's not-useful kill switch), [arXiv 2508.18771](https://arxiv.org/abs/2508.18771) (~70% of AI comments valid, ≤19.2% acted on), [Conventional Comments](https://conventionalcomments.org/).

## Personas

- **Technical Builder (TB)** — any project, any stack, any harness. Reads the diff; will mute a noisy bot without hesitation.
- **Non-Technical Builder (NTB)** — **cannot read the diff.** Judges success by whether the feature works and is safe. Internal jargon is a dead end.
- **Safeword Maintainer (SM)** — ships the reviewer into other people's repos; must trust it before it fires there. Always also a TB in their own sessions.

## Surfaces

Affected:

- **Safeword CLI** — the reviewer ships via `safeword setup` (workflow template + skill as ownedFiles).
- **Claude Code** — the v1 runner (`claude-code-action`, agent mode).
- **OpenAI Codex** — `skip: v1 runner is Claude-only by decision (ticket.md decision record); the CLI runner is the planned second surface. Tagged, not pretended.`
- **Cursor** — `skip: same as OpenAI Codex.`

Unaffected:

- **Claude Code on the Web**, **OpenAI Codex Cloud**, **Cursor Cloud Agents** — the reviewer runs in CI, not in an agent session; no cloud-harness surface is touched.

## Vocabulary

Spec-local pending curation (see Open Questions — these are absent from `.project/glossary.md` and DISCOVERY forbids inventing glossary entries):

- **Intent tier** — how much declared intent a project exposes: T0 artifacts-in-diff (`spec.md`, `done_when`, `Out of scope`) → T1 linked issue/ADR/CONTRIBUTING → T2 PR body + issue → T3 commits or nothing.
- **Intent provenance** — whether an intent source predates the code (a **contract**) or ships with it (a **narrative**). Derived from git commit order, not asserted.
- **Quality surface** — what a project's own tooling already covers (linters, types, tests, CI). The reviewer subtracts this and reviews only the gap.

## Jobs To Be Done

### autonomous-pr-review.TB1 — Hear only what my own tooling can't tell me

**Persona:** Technical Builder (TB)

> When I open a PR on my project, I want a reviewer that skips everything my
> linters, types, and tests already cover and tells me only what they can't —
> whether this did what I said, whether it's bigger than it needs to be, and
> what it might break — so I get signal worth reading instead of a bot I end
> up muting.

#### autonomous-pr-review.TB1.R1 — A concern the project's own tooling already reports is never surfaced as a finding

#### autonomous-pr-review.TB1.R2 — A pull request with nothing worth saying receives no comment at all

#### autonomous-pr-review.TB1.R3 — Findings are capped and ranked, so a large diff never floods the review

#### autonomous-pr-review.TB1.R4 — Every finding carries a concrete proposed change, not just a concern

#### autonomous-pr-review.TB1.R5 — A finding the reviewer could not verify can inform, but never blocks

#### autonomous-pr-review.TB1.R6 — The reviewer uses whatever declared intent the project exposes, and never claims more certainty than that source supports

#### autonomous-pr-review.TB1.R7 — The reviewer runs once per meaningful change, not once per push

### autonomous-pr-review.NTB1 — Be my eyes on a diff I can't read

**Persona:** Non-Technical Builder (NTB)

> When my agent opens a PR I have no way to audit myself, I want a
> plain-language account of whether it does what I asked and what could break
> if it's wrong, so I can decide to merge or push back without reading a line
> of code.

<!-- Split test applied (resolves the "one job or two?" open question): the two
halves — "did it do what I asked" and "what could break" — each look separable,
but an NTB told "it does what you asked" while NOT told "it will drop your
table" is not served. The sub-operations only make sense together; the job is
one decision (merge or push back). So: one JTBD, two Rules. -->

#### autonomous-pr-review.NTB1.R1 — Every finding names its consequence in plain language, without requiring the reader to read code

#### autonomous-pr-review.NTB1.R2 — The review states whether the change did what was asked, in the asker's own terms

#### autonomous-pr-review.NTB1.R3 — The review names what could break if the change is wrong

#### autonomous-pr-review.NTB1.R4 — The review ends in a decision the reader can act on — merge, push back, or ask — not just a list of problems

### autonomous-pr-review.SM1 — Trust the reviewer before it fires on someone else's repo

**Persona:** Safeword Maintainer (SM)

> When I ship a reviewer that will comment on projects unlike ours, I want
> measured evidence that it's worth reading there — not just here — and a way
> to pull it back if it isn't, so I never spend a customer's trust on noise.

#### autonomous-pr-review.SM1.R1 — The reviewer's usefulness is measured on projects unlike safeword's before it fires on them

#### autonomous-pr-review.SM1.R2 — A maintainer can turn the reviewer off without deleting it, and the signal that should trigger that is named

#### autonomous-pr-review.SM1.R3 — Content inside a pull request cannot direct the reviewer's behavior

## Rave Moment

_Pending — deliberately not authored yet._ DISCOVERY requires grounding this via `/figure-it-out` rather than writing it from priors, and it is advisory (never blocks intake exit). The candidate worth researching: **NTB1** — _"I merged something I couldn't read, and it told me in English what would break."_ Whether that clears the beaten-expectation bar, or is table-stakes once you've accepted agent-written code, is exactly what the research must settle. Deferred to the Rules gate.

## Outcomes

_Deferred to the Rules sub-phase._ Outcomes are the product counterpart to `done_when`, and DISCOVERY orders JTBD gate → Rules gate → engineering scope. Writing them now would pre-empt the gate.

## Open Questions

- **New glossary terms.** `intent tier`, `intent provenance`, and `quality surface` are absent from `.project/glossary.md`. DISCOVERY says flag, don't invent — promote to the project glossary, or keep spec-local under `## Vocabulary`?
- ~~**Is NTB1 one job or two?**~~ **Resolved at the Rules gate:** one job, two Rules. The split test fails — an NTB told "it does what you asked" but not "it will drop your table" is not served; the halves only make sense together, and the job is a single decision (merge or push back). See the note under NTB1.
- **Does this feature need to split into an epic?** SPLITTING's entry checkpoint says *3+ stories → epic*, and its define-behavior checkpoint says *>15 scenarios OR 3+ distinct clusters → split by user journey*. We have 3 JTBDs and 14 Rules; at ~2-3 scenarios each that is ~30-40 scenarios, roughly double the threshold. The three natural children: **the reviewer skill** (TB1+NTB1 — the judgment), **distribution + config** (ownedFiles, workflow template, kill switch, trigger gating), **the eval harness** (SM1 — Tier-2 corpus, pre-registered bars). Splitting is suggested, never mandatory — the user decides at this gate.
- **Does the Codex/Cursor gap belong in `out_of_scope`, or as the tagged surface skips above?** Both are live project surfaces; v1's runner is Claude-only by decision. Currently written as skips.
- **What sets the Tier-2 bar for SM1's "measured evidence"?** The Tier-0 shadow run is unscored (triage outstanding) and n=1 repo. Per the pre-registration discipline, the number must be set before a non-safeword corpus is read.
- **Does TB1's "skips what my tooling covers" need per-project config, or pure detection?** Detection is cleaner (PRINCIPLES §3) but every project's CI is idiosyncratic; a `.safeword/config.json` escape hatch may be unavoidable. Affects whether TB1 has a configuration Rule.
