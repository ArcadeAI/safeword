# Spec: Autonomous PR review at the intent-conformance bar

## Intent

A team shipping agent-written PRs faster than it can review them well needs a **second model** — one that doesn't share the authoring agent's blind spots — to check each change against the intent that was declared before the code, and to tell a human whether this PR is worth their eyes. Safeword builds and ships that reviewer; **`ArcadeAI/monorepo` is customer #1 of many.**

The target does not lack review — it reviews 96% of PRs and requests changes on **0.5%**. It lacks review *depth*: 21 of 25 PRs get zero inline comments. Rubber-stamping plus agent-written code is the failure mode, because a skimming human and the authoring model share blind spots. Every arcade PR carries a **mandatory, pre-committed Linear issue** (branch protection enforces it) — a contract nobody currently checks the diff against.

## Intake Brief

- **Requested by:** Alex (2026-07-15) — "safeword to run as a server process or github action and review open PRs and do a super high quality eng review the way a top quality engineer or PM on a team would do", scope-corrected in the same session to "a top tier reviewer of any project, not just safeword's own... and of course, it should be awesome at its own."
- **Cost of inaction:** **TB (the target — arcade engineers, measured 2026-07-15):** 60 PRs merged in 8 days, **96% reviewed but 0.5% changes-requested and 21/25 with zero inline comments** — agent-written code is landing on a rubber stamp, and the humans doing the stamping share the authoring model's blind spots. Every PR has a mandatory Linear contract nobody checks the diff against. **NTB (downstream, per user):** *"if we get this right then yes, the NTB will benefit because they clearly aren't doing eng review and we still need a second model catching blind spots"* — real, but not the v1 target. **SM:** ships it to arcade and to customers after; can't turn it on for anyone without evidence it's worth reading there. Structurally: safeword already forces specs, `done_when`, and `Out of scope` into existence — without a reviewer that reads them, the discipline's biggest payoff goes uncollected.
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

#### autonomous-pr-review.TB1.R3 — Every finding that clears the bar is surfaced, and nothing that doesn't — the review neither pads nor truncates

#### autonomous-pr-review.TB1.R9 — Every review ends in a verdict that tells an engineer whether this PR needs their eyes, without opening the diff

#### autonomous-pr-review.TB1.R10 — A pull request with more real problems than are worth enumerating is verdicted unreviewable-as-is, not flooded with comments

<!-- R3 REVERSED at the intake gate (user: "Why only 5 findings? Why cap it?").
The old Rule was "findings are capped and ranked." The cap was a proxy for
precision, and it fails twice: it suppresses true findings (12 real problems ->
show 5, hide 7 — the GEPA eval-gaming failure), and it never binds on the real
target (arcade's median PR is 69 lines / 4 files; Google's volume peaks at 12.5
comments for ~1250-line changes). It solved safeword's 1,922-line PRs — the
wrong repo's problem. R3 is now a bar; R10 absorbs the density case the cap was
clumsily protecting against; R9 makes the verdict first-class. Silence (R2)
stays — a floor is not a cap. -->

<!-- R9 is deliberately TB-facing, not only NTB-facing: the target team reviews
96% of PRs and requests changes on 0.5%. For a team drowning in agent-written
PRs the verdict IS the product — it routes scarce human attention. Is_Human
rho=0.99: the strongest predictor a comment gets acted on is that a human wrote
it, so the reviewer's job is to aim human review, not replace it. -->

#### autonomous-pr-review.TB1.R11 — The reviewer runs on a different, never-weaker model than the agent that wrote the code, and never implies an independence it cannot establish

<!-- R11 is PRINCIPLES §1's class-1 rule at the PR boundary: correlated blind
spots are the threat, so the reviewer must not share the author's. v1 implies
the author model by configuration; detection is X1Z5MG. The second clause is the
load-bearing one — a same-model review that believes it is cross-model launders
correlated blind spots as independent verification, which is worse than a
same-model review that admits it. -->


#### autonomous-pr-review.TB1.R4 — Every finding carries a concrete proposed change, not just a concern

#### autonomous-pr-review.TB1.R5 — A finding the reviewer could not verify can inform, but never blocks

#### autonomous-pr-review.TB1.R6 — The reviewer uses whatever declared intent the project exposes, however little that is

#### autonomous-pr-review.TB1.R7 — A finding never claims more certainty than the intent source it rests on supports

<!-- R6/R7 split at the quality-review gate: the original bundled "uses whatever
intent exists" (tiering) with "never over-claims certainty" (provenance
weighting). Split test: tiering without provenance-weighting is a working
reviewer; provenance-weighting without tiering is a working safeguard. Each
ships standalone value → two Rules. -->

#### autonomous-pr-review.TB1.R8 — The reviewer runs once per change the author has declared ready, not once per push

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

#### autonomous-pr-review.SM1.R1 — The reviewer's usefulness is measured against a recorded bar, on projects unlike safeword's, before it fires on them

#### autonomous-pr-review.SM1.R2 — A maintainer can turn the reviewer off without deleting it, and the signal that should trigger that is named

#### autonomous-pr-review.SM1.R3 — The reviewer never holds a credential that can write, comment, or approve while it is reading untrusted content

<!-- R3 REWORDED at the quality-review gate. It previously read "Content inside a
pull request cannot direct the reviewer's behavior" — an absolute the platform
explicitly refuses to promise. claude-code-action's own security doc (fetched
this session) offers sanitization + actor allowlists, then concedes "new bypass
techniques may emerge" and recommends manually reviewing raw content from
external contributors. An invariant that no bypass exists is neither achievable
nor testable (you cannot write a scenario proving a negative over an open
attack space). The reworded Rule is structural, provable, and survives a
successful injection rather than pretending none can occur: if the reviewer
holds no write credential, a hijacked reviewer says something wrong instead of
doing something irreversible. Vendor's concrete pattern to adopt: check out the
base ref at the workspace root, put the PR head in a subdirectory, pass it via
`--add-dir`; never check an untrusted ref into the workspace root under
`pull_request_target`. -->

<!-- SM1.R1: "measured" was untestable as written (no bar). Now bound to "a
recorded bar" — the bar's VALUE stays an Open Question, but the Rule is
testable: either a bar was recorded before the corpus was read, or it wasn't. -->

<!-- Rules gate note: TB1 now carries 8 Rules to SM1's 3. The independent review
flagged the lopsidedness; it is real but is a symptom of the epic split (below),
not of over-decomposition — TB1+NTB1 are one child feature, SM1 is another. -->


## Rave Moment

_Pending — deliberately not authored yet._ DISCOVERY requires grounding this via `/figure-it-out` rather than writing it from priors, and it is advisory (never blocks intake exit). The candidate worth researching: **NTB1** — _"I merged something I couldn't read, and it told me in English what would break."_ Whether that clears the beaten-expectation bar, or is table-stakes once you've accepted agent-written code, is exactly what the research must settle. Deferred to the Rules gate.

## Outcomes

_Deferred to the Rules sub-phase._ Outcomes are the product counterpart to `done_when`, and DISCOVERY orders JTBD gate → Rules gate → engineering scope. Writing them now would pre-empt the gate.

## Open Questions

- **New glossary terms.** `intent tier`, `intent provenance`, and `quality surface` are absent from `.project/glossary.md`. DISCOVERY says flag, don't invent — promote to the project glossary, or keep spec-local under `## Vocabulary`?
- ~~**Is NTB1 one job or two?**~~ **Resolved at the Rules gate:** one job, two Rules. The split test fails — an NTB told "it does what you asked" but not "it will drop your table" is not served; the halves only make sense together, and the job is a single decision (merge or push back). See the note under NTB1.
- **Does this feature need to split into an epic?** SPLITTING's entry checkpoint says *3+ stories → epic*, and its define-behavior checkpoint says *>15 scenarios OR 3+ distinct clusters → split by user journey*. We have 3 JTBDs and 14 Rules; at ~2-3 scenarios each that is ~30-40 scenarios, roughly double the threshold. The three natural children: **the reviewer skill** (TB1+NTB1 — the judgment), **distribution + config** (ownedFiles, workflow template, kill switch, trigger gating), **the eval harness** (SM1 — Tier-2 corpus, pre-registered bars). Splitting is suggested, never mandatory — the user decides at this gate.
- **Does the Codex/Cursor gap belong in `out_of_scope`, or as the tagged surface skips above?** Both are live project surfaces; v1's runner is Claude-only by decision. Currently written as skips.
- **What sets the Tier-2 bar for SM1's "measured evidence"?** The Tier-0 shadow run is unscored (triage outstanding) and n=1 repo. Per the pre-registration discipline, the number must be set before a non-safeword corpus is read. **Sharpened by the quality-review:** the Tier-0 bar's own rationale was mis-derived (anchored to a filter statistic, not an addressing rate — see ticket.md); the corrected anchors are AI 0.9–19.2% / human 60%. Any Tier-2 bar must be justified against those, and against the fact that Metric A is a more permissive quantity than either.
- **Who triages ~395 findings/month?** 282 merges/month × the probe's 1.4 findings/PR. If the review vacuum is an *attention* problem rather than a missing-reviewer problem, this feature taxes the bottleneck instead of relieving it — and the 10-PR triage already sitting outstanding is that bottleneck in miniature. Reframes TB1.R2/R3/R8 (silence, cap, trigger gating) from hygiene into the primary feature. **Needs a user answer before Rules close.**
- **Where does an NTB actually read this review?** The output surface is inline GitHub review comments on the Files-changed tab. An NTB directing an agent in natural language plausibly never opens it. NTB1 currently has **no named delivery surface** — and if the answer is "a summary comment," that collides head-on with the hunk-anchored discipline TB1 rests on (file-level sources address at 0.9–4.2% vs hunk-level 6.5–19.2%).
- **Does NTB1.R1 conflict with TB1.R4?** TB1.R4 requires every finding to carry a concrete code block (code-to-text ratio ρ=0.89); NTB1.R1 requires findings readable without reading code. Both target the same inline comment. Possibly reconcilable (consequence-first prose, code block second) — but currently unproven and unstated.
- **Is NTB1 grounded, or inferred from `personas.md`?** The independent review's sharpest observation: TB1 traces to the ≤19.2% data and SM1 traces near-verbatim to the persona file's "needs to trust and verify the rule set before it ships"; NTB1's cost-of-inaction echoes the persona file's own "the only thing standing between them and an agent that confidently ships broken code." Legitimate inference — but the most differentiated persona claim is the least grounded, and **no NTB has been asked.** `/elicit` before Rules close.
- **Is the 4-tier model over-built for v1?** Only one of four dimensions degrades with tier. If T1/T2/T3 all collapse to "read whatever intent exists, weight it by provenance," a 4-tier taxonomy earns its complexity nowhere — 2 tiers (artifacts-in-diff vs not) + provenance weighting may deliver ~all the value at a fraction of the surface. PRINCIPLES §5: don't abstract for hypothetical reuse.
- **Unresolved tension in the artifact-free claim.** Bacchelli ranks *alternative solutions* the 2nd-most understanding-demanding outcome, right after defect-finding — yet this spec lists alternatives as needing "no artifacts, high at every tier." Tier measures *declared-intent* artifacts, not code familiarity, so it isn't a refutation — but our own source says the artifact-free dimensions are the understanding-hungriest ones, which undercuts "differentiated at Tier 3 already" more than the ticket admits.
- **Does TB1's "skips what my tooling covers" need per-project config, or pure detection?** Detection is cleaner (PRINCIPLES §3) but every project's CI is idiosyncratic; a `.safeword/config.json` escape hatch may be unavoidable. Affects whether TB1 has a configuration Rule.
