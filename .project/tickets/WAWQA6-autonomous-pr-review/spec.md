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

#### autonomous-pr-review.TB1.R9 — Every review reaches a verdict on whether the PR needs a human; a needs-a-human verdict is surfaced without opening the diff, and safe-to-merge is delivered as silence (R2), not a posted comment

<!-- Clarified 2026-07-18 to reconcile with R2 ("a clean PR receives no comment at all"): the verdict always EXISTS, but only needs-a-human is POSTED; safe-to-merge is the absence of a review. So R2 and R9 do not contradict — silence IS the safe-to-merge signal. -->

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

#### autonomous-pr-review.TB1.R15 — A simpler-shape observation is offered as a provocation, never asserted as a defect

<!-- product-scout reframe 4/5: the autonomy curve is U-shaped — high at the
edges (detect, verify), LOW in the creative middle. "Is there a simpler design?"
is the creative middle. The `alternatives` dimension scored 0/11 not because it
is worthless but because it was framed as a FINDING (an assertion the human must
rebut) instead of a PROVOCATION (an option the human may take). A confident
single alternative anchors the author the same way a single JTBD draft anchors —
which is exactly why product-scout emits a divergent spread and lets the human
own the leap. So: alternatives never blocks, never counts toward the verdict,
and is phrased as an invitation ("worth considering: X would collapse these
three branches") not a verdict ("this should be X"). If it keeps getting
ignored, that is fine — a provocation nobody takes is cheap; a false defect is
not. See R16: a design concern that names a concrete consequence in the change
as written — not merely a simpler shape — is not a provocation and can route to
a human. -->

#### autonomous-pr-review.TB1.R16 — A design concern that names a concrete consequence in the change as written can raise the verdict to needs-a-human

<!-- Added 2026-07-18 from the 42-PR human-review study (arcade, the last 50 PRs
where a human commented). The highest-value human move in the set is
blocking-grade design pushback: itsthatriver asked to CLOSE a 2,872-line PR for
a load-bearing design flaw (PLT-2489); wdawson pushed to delete "a fragile
invariant with no validation in code" (2184); teallarson repeatedly refused
reinvented primitives (2122). R15 (provocation, never blocks) is correct for a
pure alternative — a nicer shape the author may decline freely. It is WRONG when
the concern names a concrete consequence in the change AS WRITTEN: a bug class,
a scaling wall, a maintenance trap that will drift. The distinguishing test is
NTB1.R1's — does it name a consequence, or only a different shape? A
consequence-bearing design concern routes to needs-a-human. It is NOT a mandated
fix (that stays R4/R15's line) and NOT a "block" in R5's sense: needs-a-human IS
the "inform a human" action R5 prescribes for what the reviewer cannot itself
resolve. It aims scarce human attention (R9); it does not redesign. -->

#### autonomous-pr-review.TB1.R17 — The reviewer works from a full checkout of the PR's head branch — the whole codebase, not the diff alone — and, where the code is trusted to run, an environment it can exercise

<!-- Added 2026-07-18. The study showed the sharpest human catches rest on
context the diff does not carry: a TOCTOU race across two Gmail calls giving a
false confirmation on a destructive op (byrro, 2120); "the Engine paginates
in-memory and prod has ~8k tools, so this is 80x slower" (EricGustin, 2073);
"you reinvented our Tabs component" (teallarson, 2122). A diff-scoped reviewer
structurally cannot produce these. A full checkout collapses most of the gap: it
reads the file the diff doesn't touch, greps for the primitive that already
exists (R18), and — where the code is trusted — builds it, runs the tests, and
reproduces (which is how R12 base-repro and R13 fix-run already execute). This
is the substrate, not a nicety: R18 and the fix/repro gates are IMPOSSIBLE on
the diff alone.

Composes with SM1.R3: reading the whole tree is always safe; EXECUTING it is
gated — a fork's head runs only in a secretless/unprivileged environment or not
at all, because "an environment it can exercise" is precisely the pwn-request
execution surface. Cost is tiered, not uniform: the checkout+read is cheap and
runs on every PR; standing up and exercising a live environment is reserved for
where execution buys verification (a finding carrying a patch, a base-repro, a
high-blast-radius surface), never as a per-PR default — the target is drowning
in PRs and cannot afford a full environment spin-up on each.

The residual a full checkout still cannot confirm — a project-external fact like
a production tool count — stays R5's case: it can inform, never block, and R7
caps the certainty claimed. -->

#### autonomous-pr-review.TB1.R18 — A change that reimplements a capability the project already provides is flagged, and the existing capability is named

<!-- Added 2026-07-18 from the study: a large share of human review — teallarson's
entire 2122 pass — is "we already have this; compose it, don't rebuild it" (a
base Callout, the Tabs component, a tri-state checkbox atom). None of it is
something linters/types/tests catch (so it is in R1's gap), and it is absent
from the v1 dimension set (blast-radius, evidence-integrity, intent, scope,
alternatives). It is only POSSIBLE with R17's full checkout — you cannot know
what already exists from the diff. Delivery weight follows the same split as
everything else: naming the existing capability is the finding; whether it rises
above a provocation depends on consequence. Pure "consider consolidating" is R15
(a provocation the author may decline); reinvention that creates a concrete
hazard — two sources of truth that will drift, a divergent second implementation
of a security-relevant control — is R16 (routes to a human). This keeps R18 from
degenerating into a nitpick generator: it flags and names; R15/R16 set the
volume. -->

#### autonomous-pr-review.TB1.R11 — The reviewer runs on a different VENDOR than the agent that wrote the code, and never implies an independence it cannot establish

<!-- STRENGTHENED 2026-07-17 (user): different MODEL -> different VENDOR. Claude
reviewing Claude shares a training lineage, an RLHF approach, and therefore its
failure modes — the exact correlated blind spot PRINCIPLES §1's class-1 rule
exists to break. A different vendor is the most decorrelated reviewer available.
Default: assume the author was Claude and review with Codex; that fails toward
cross-vendor, which is the safe direction when detection is uncertain.
Every review this session ran same-vendor and declared `cross_model: false` —
this closes a gap we have been declaring, not discovering. -->

#### autonomous-pr-review.TB1.R14 — When a finding exists, a second vendor tries to refute it before anyone sees it

<!-- This is how "run both" is answered WITHOUT rebuilding the voting panel the
ADR rejected (the "popularity trap": correlated models converge on shared wrong
answers and underperform a single adversarial reviewer). Two vendors, but
author->adversary, never a vote:

  - Union of both vendors' findings  -> doubles the noise. Noise is the enemy.
  - Intersection                     -> kills recall; the best findings this
                                        session were single-reviewer insights.
  - Majority vote                    -> the rejected popularity trap.
  - Author -> adversary              -> attacks false certainty (metric C, the
                                        kill criterion) with the strongest
                                        instrument available: a different vendor
                                        trying to prove you wrong.

Session evidence: the two highest-value passes were both adversarial — an
independent review killed a bloated proposal, and an adversarial pass caught
that a true finding shipped with a regressing fix. Cost is bounded because the
adversary only runs when findings exist (~25-30% of PRs) and only reads the
findings, not the whole diff: ~10% on the per-PR average. -->

#### autonomous-pr-review.TB1.R12 — A finding that reproduces unchanged on the base branch is not reported as feedback on this pull request

<!-- MECHANIZES §3.5. Today the on-topic test is prose the model applies by
judgment — and it already failed once: the goroutine leak was true, verified,
and off-topic, and a maintainer called it noise. With base+head checked out the
question "would this be equally true if this PR didn't exist?" stops being a
judgment and becomes a check. PRINCIPLES §1: instructions are the weakest tier. -->

#### autonomous-pr-review.TB1.R13 — A suggested fix is not posted unless it has been run against the tests it could break

<!-- MECHANIZES the fix gate. It exists because a true finding shipped with a
patch that would have made a failure counter unable to increment and turned a
shipped test red. "Read the tests, don't assume" is an instruction; running them
is a gate. Only fires on the rare finding carrying a patch, so the cost is
bounded. -->

<!-- R11 is PRINCIPLES §1's class-1 rule at the PR boundary: correlated blind
spots are the threat, so the reviewer must not share the author's. v1 implies
the author model by configuration; detection is X1Z5MG. The second clause is the
load-bearing one — a same-model review that believes it is cross-model launders
correlated blind spots as independent verification, which is worse than a
same-model review that admits it. -->


#### autonomous-pr-review.TB1.R4 — A finding that proposes a fix carries a concrete, verified change — not a vague concern

<!-- Softened from "every finding" 2026-07-18: absolute "every" contradicted R13 (a finding whose fix can't be verified is posted WITHOUT a fix) and R15 (a simpler-shape is a provocation, not a defect carrying a mandated fix). The rule is about the QUALITY of a fix when one is offered — concrete + verified — not that every finding must carry one. -->

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

<!-- The delivery contract (product-scout reframe 7, "every human surface is
plainspoken"): a surface that needs decoding spends the very attention the tool
exists to protect. Fixed shape on every finding:

  [what happens, one sentence] → [what to do] → [evidence on demand]

Not "index_writes uses Add(ctx,1) so the counter is batch-scoped" but
"this metric can't tell you when the model migration is safe — it counts
batches, not items. → confirm before cutover. → (details)."

This RESOLVES the NTB1.R1-vs-TB1.R4 conflict (plain language vs mandatory code
block): they are not in tension, they are LAYERS. The plain-English consequence
is the surface; the code block is the evidence one level deeper. Same reason the
body is read last — a wall of code anchors, a one-line stake orients. TB reads
the code; NTB reads the stake; both are served by the same finding. -->

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

#### autonomous-pr-review.SM1.R3 — The reviewer never executes fork-PR code while holding a credential that can write, comment, or approve

<!-- Refined 2026-07-17 (/figure-it-out, GitHub Security Lab "pwn requests"): the threat is EXECUTING untrusted code with secrets present, not reading it. Reading the diff as data and sending it to the model is safe in a privileged job; the two gates that execute (R13 fix-run, R12 base-repro) degrade on forks or run in an unprivileged sidecar. Earlier wording ("never holds a write credential while reading") forbade the safe act and missed the real hazard. R17's live environment is the same execution surface under a broader name: a fork's head is exercised only in a secretless/unprivileged job or not at all — "clone everything and read it" is always safe; "spin it up and bang on it" is the gated act. -->

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


### autonomous-pr-review.TB2 — Stop me from waving through the small change that matters

**Persona:** Technical Builder (TB)

> When a 60-line change touches auth or infra, I want it reviewed at the
> depth its risk deserves rather than the depth its size suggests, so the
> dangerous small ones stop sliding through while I'm busy reading the big
> ones.

<!-- MEASURED, not assumed (50 merged arcade PRs, 2026-07-17): review here is
triaged by SIZE — <100 lines get a human comment 18% of the time, 500+ get 62%.
11 of 14 small PRs touching auth/infra got ZERO human comments. The sharpest:
#2096, 65 lines, whose body literally says "## For the security reviewer 👀 —
this intentionally removes a nominal security control... please sanity-check
that reasoning." It got one bare APPROVED, zero comments, and merged. The size
heuristic is rational and it has a systematic blind spot; this job is that gap.
NOTE this INVERTS the original product bet: `safe-to-merge` saves nothing (they
already skip 82% of small PRs). `needs-a-human` on what they'd wave through IS
the product. -->

#### autonomous-pr-review.TB2.R1 — Review depth is set by what the change touches, never by how many lines it has

#### autonomous-pr-review.TB2.R2 — A change to a sensitive surface (auth, permissions, migrations, public API, CI credentials) is never verdicted safe-to-merge on size alone

#### autonomous-pr-review.TB2.R3 — When an author asks in the PR for a specific review, an answer to that request appears or the PR is verdicted needs-a-human

## Rave Moment


Authored 2026-07-17 via `/figure-it-out` (grounded, not from priors). The rave lives at the **highest persona-facing surface — TB**. NTB is deferred (below), with a reason.

### TB — "It caught the thing that was green"

- **The moment:** the reviewer flags a defect that every existing safety net missed *because the tests passed* — a test that would still pass if the bug came back (2118, `toMatchObject` where the anti-loop invariant needed `toEqual`), a test suite that never runs at all (2146, CI job gated on a path the change doesn't touch; 2056, workflow in a folder GitHub Actions doesn't read), or a metric that reports `success` while writing nothing (2113). The peak: the author stares at a green check and a real bug in the same breath.
- **The expectation it beats:** *everything I own goes quiet exactly when the tests pass.* CI is green, the linters are green, Bugbot said "low risk," a teammate skimmed and clicked approve — and the dread, live in 2026, is that an AI reviewer is just one more thing to mute (the "cry wolf" effect is the #1 reason teams abandon AI review; 70–90% of comments get ignored). This beats that dread at its own game: it is loudest precisely where everything else fell silent.
- **The one-sentence test (does it travel?):** *"Our reviewer caught a test that would've let an infinite-loop bug back in — and CI was green."* That sentence makes the **teller** look sharp for running it (Berger's Social Currency — the mechanism of word-of-mouth), it is a specific Story with Practical Value, and it already happened: the code owner (Sergio) called the 2118 catch *"a good one"* unprompted. Not luck — evidence-integrity was 3/3 in the trial, so the green-catch is a **repeatable class**, not a one-off.

**Why the green-catch and not the near-misses:** "it found a bug" is table-stakes — Bugbot finds bugs. "It got quieter when we were slammed" (the floating bar) is a real delight but an *average*, not a peak you screenshot, and it is unbuilt. "It refused to ship a fix it couldn't verify" is the **trust foundation** that makes the green-catch believable rather than another bot crying wolf — but it makes the *tool* look careful, not the *teller* look smart, so it seeds the rave; it isn't the rave.

### NTB — `skip: table-stakes / premature for v1`

The candidate was *"I merged something I couldn't read, and it told me in English what would break."* It does not clear the bar **yet**, for three reasons the research made concrete: (1) an NTB who cannot read code has **no prior experience of code review to beat** — beating nothing is a first, not a rave; (2) their delight is **fragile** — they cannot verify the review is right, so one confident-but-wrong "safe to merge" collapses the trust the rave depends on; (3) the user has scoped NTB as *not the v1 target*. The NTB rave is real and downstream — it becomes authorable once the verdict has *earned* enough trust that a non-coder can rely on it — but writing it now would be aspirational fiction, which is the exact failure the "run `/figure-it-out`, don't invent" rule guards against.

## Outcomes

_Deferred to the Rules sub-phase._ Outcomes are the product counterpart to `done_when`, and DISCOVERY orders JTBD gate → Rules gate → engineering scope. Writing them now would pre-empt the gate.

## Open Questions

- **New glossary terms.** `intent tier`, `intent provenance`, and `quality surface` are absent from `.project/glossary.md`. DISCOVERY says flag, don't invent — promote to the project glossary, or keep spec-local under `## Vocabulary`?
- ~~**Is NTB1 one job or two?**~~ **Resolved at the Rules gate:** one job, two Rules. The split test fails — an NTB told "it does what you asked" but not "it will drop your table" is not served; the halves only make sense together, and the job is a single decision (merge or push back). See the note under NTB1.
- **Does this feature need to split into an epic?** SPLITTING's entry checkpoint says *3+ stories → epic*, and its define-behavior checkpoint says *>15 scenarios OR 3+ distinct clusters → split by user journey*. We have 3 JTBDs and 14 Rules; at ~2-3 scenarios each that is ~30-40 scenarios, roughly double the threshold. The three natural children: **the reviewer skill** (TB1+NTB1 — the judgment), **distribution + config** (ownedFiles, workflow template, kill switch, trigger gating), **the eval harness** (SM1 — Tier-2 corpus, pre-registered bars). Splitting is suggested, never mandatory — the user decides at this gate.
- ~~**Intent-granularity mismatch** — a naive contract-vs-diff check emits false conformance findings when the ticket is broader than the PR.~~ **RESOLVED 2026-07-15 (`/figure-it-out`).** Conformance has two directions and only one is granularity-safe. **Scope** (PR → ticket: "did it do something unsanctioned?") cannot false-positive — a subset is still sanctioned — so it always runs. **Completeness** (ticket → PR: "did it do everything?") false-positives whenever the ticket is broader, so its severity is bound by scope certainty: assert only when the ticket is 1:1 with this PR, otherwise cap at `question`. The finer cut, found while applying it: **deviation vs absence.** A requirement the diff implemented *wrongly* is always checkable at full severity; a requirement simply *missing* from the diff is the unsafe case. Detector: count PRs already referencing the ticket (>0 → not 1:1). Verified 3/3 on the arcade corpus — PLT-2383 (5 PRs) and PLT-2296 (3 PRs) are exactly the two that produced false gaps; PLT-2398 (1 PR) carried real blocking findings. **The rule is free**: it suppresses both known false positives and costs nothing on the corpus. Same move as `evaluator.ts` ("false alarms only on bases certified clean" — precision over an under-labeled corpus is formally unidentifiable). Applied to `G5337S/skill-draft.md` §3–4. Known hole recorded there: the first PR of an unannounced series reads as 1:1.
- ~~**Are there TWO products here, and is the second one ours?**~~ **RESOLVED 2026-07-16 (user): PR-scoped only. No sweep — not deferred, out of scope.** *"Stay on PR. That's where we feel pain today."* The architect's noise complaint on the posted goroutine leak forced the question; the re-audit answered its cost. **Off-topic findings are 1 of 11 (9%) on the trial corpus** — staying PR-only sacrifices almost nothing, and the one lost finding is the exact one that drew the complaint. Consequences applied: no sweep, no routing infrastructure, the two-products fork is closed. **Off-topic findings still go on the PR (revised 2026-07-16, user) — in a collapsed, hard-capped, non-blocking "Noticed nearby" section of the review body, structurally separated from the inline review of the change and excluded from the verdict.** The earlier "never on the PR" rule over-corrected for what was really a labeling failure (the finding ran on like normal feedback, so the maintainer asked "is this talking to me?"). The author has the most context on those files right now; label it hard rather than hide it. Open bet CWGYH0 must measure: does the "Noticed nearby" section get acted on or scrolled past — if ignored, the maintainer was right that it's a workflow problem, not a labeling one, and it comes back out. The re-audit also re-ranked the dimensions under the on-topic filter — **evidence integrity is 3/3 change-caused and co-leads blast radius (3/4)**, making "the tests this PR *added* don't prove what they claim" the single most PR-native, most defensible value, and it is invisible to Bugbot and to a skimming human because CI is green.
- **Does the Codex/Cursor gap belong in `out_of_scope`, or as the tagged surface skips above?** Both are live project surfaces; v1's runner is Claude-only by decision. Currently written as skips.
- **What sets the Tier-2 bar for SM1's "measured evidence"?** The Tier-0 shadow run is unscored (triage outstanding) and n=1 repo. Per the pre-registration discipline, the number must be set before a non-safeword corpus is read. **Sharpened by the quality-review:** the Tier-0 bar's own rationale was mis-derived (anchored to a filter statistic, not an addressing rate — see ticket.md); the corrected anchors are AI 0.9–19.2% / human 60%. Any Tier-2 bar must be justified against those, and against the fact that Metric A is a more permissive quantity than either.
- **Who triages ~395 findings/month?** 282 merges/month × the probe's 1.4 findings/PR. If the review vacuum is an *attention* problem rather than a missing-reviewer problem, this feature taxes the bottleneck instead of relieving it — and the 10-PR triage already sitting outstanding is that bottleneck in miniature. Reframes TB1.R2/R3/R8 (silence, cap, trigger gating) from hygiene into the primary feature. **Needs a user answer before Rules close.**
- **Where does an NTB actually read this review?** The output surface is inline GitHub review comments on the Files-changed tab. An NTB directing an agent in natural language plausibly never opens it. NTB1 currently has **no named delivery surface** — and if the answer is "a summary comment," that collides head-on with the hunk-anchored discipline TB1 rests on (file-level sources address at 0.9–4.2% vs hunk-level 6.5–19.2%).
- ~~**Does NTB1.R1 conflict with TB1.R4?**~~ **RESOLVED 2026-07-17 (product-scout reframe 7).** Not a conflict — they are LAYERS. Plain-English consequence at the surface, code block as evidence one click deeper. Fixed contract: [what happens] → [what to do] → [evidence on demand]. Encoded under NTB1.R1.
- **Is NTB1 grounded, or inferred from `personas.md`?** The independent review's sharpest observation: TB1 traces to the ≤19.2% data and SM1 traces near-verbatim to the persona file's "needs to trust and verify the rule set before it ships"; NTB1's cost-of-inaction echoes the persona file's own "the only thing standing between them and an agent that confidently ships broken code." Legitimate inference — but the most differentiated persona claim is the least grounded, and **no NTB has been asked.** `/elicit` before Rules close.
- ~~**Should the `alternatives` dimension be cut (0/11 findings)?**~~ **RESOLVED 2026-07-17 (product-scout reframe 4/5 — the U-shaped autonomy curve).** Zero findings was the wrong diagnosis. Alternatives IS the creative middle of the curve, where autonomy should be LOW by design — a confident "here's a simpler shape" anchors exactly like a single JTBD draft does. Fix: alternatives stops being a *finding* (asserted defect) and becomes a *provocation* (offered as input, human owns the leap). Reframed as TB1.R15 below; do not delete the dimension.
- **Is the 4-tier model over-built for v1?** Only one of four dimensions degrades with tier. If T1/T2/T3 all collapse to "read whatever intent exists, weight it by provenance," a 4-tier taxonomy earns its complexity nowhere — 2 tiers (artifacts-in-diff vs not) + provenance weighting may deliver ~all the value at a fraction of the surface. PRINCIPLES §5: don't abstract for hypothetical reuse.
- **Unresolved tension in the artifact-free claim.** Bacchelli ranks *alternative solutions* the 2nd-most understanding-demanding outcome, right after defect-finding — yet this spec lists alternatives as needing "no artifacts, high at every tier." Tier measures *declared-intent* artifacts, not code familiarity, so it isn't a refutation — but our own source says the artifact-free dimensions are the understanding-hungriest ones, which undercuts "differentiated at Tier 3 already" more than the ticket admits.
- **Does TB1's "skips what my tooling covers" need per-project config, or pure detection?** Detection is cleaner (PRINCIPLES §3) but every project's CI is idiosyncratic; a `.safeword/config.json` escape hatch may be unavoidable. Affects whether TB1 has a configuration Rule.
