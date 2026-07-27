---
id: CWGYH0
slug: pr-review-eval
type: task
phase: intake
status: in_progress
scope:
  - Corpus: `ArcadeAI/monorepo` PRs that a human APPROVED and merged with ZERO inline comments (21 of 25 recent PRs qualify — the corpus is free).
  - Metrics decoupled, no composite headline (GEPA's no-F1 lesson): actionable rate, coverage, false-certainty.
  - The bar is RECORDED BEFORE the corpus is triaged, and triage is done by ARCADE ENGINEERS — not by the agent that built the reviewer.
  - A certified-clean fixture proving silence, which the safeword shadow probe never tested.
out_of_scope:
  - The reviewer skill — G5337S. The workflow — 36EEMY.
  - Scoring by the authoring agent. Greptile's postmortem: an LLM's judgment of its own output was "nearly random".
done_when:
  - The five judgment-bound Rules split out of the runner on 2026-07-19 — R19 (work type), R20 (test coverage), TB2.R1 (review depth), TB2.R3 (author request) — are scored eval cases here. They live verbatim in `features/autonomous-pr-review.feature` under `@eval-bound` as a holding pen; each Given describes code shape and each Then asserts the model's judgment about it, so a stubbed runner test would only assert its own fixture. Until they are scored here, nothing proves them.
  - A bar exists in git before any verdict does.
  - Arcade engineers have triaged the corpus, and the result is honoured — a failed bar kills or reshapes the epic rather than licensing a prompt-tuning loop until it passes.
  - False-certainty count is reported separately and can veto a ship on its own.
parent: WAWQA6
created: 2026-07-15T14:24:45.773Z
last_modified: 2026-07-15T14:24:45.773Z
---

# pr-review-eval

**Goal:** Measure the reviewer on arcade PRs humans approved with zero inline comments, against a bar recorded before triage. Serves SM1 — gates the other two from firing on customers.

**Why:** SM1's job — trust the reviewer before it fires on someone else's repo. This gates the other two children from shipping. Finding a real defect in code humans already approved is unambiguous signal in a way "would you act on this?" never is.

**The risk this ticket owns:** the safeword 10-PR triage from 2026-07-15 is STILL outstanding. If arcade engineers are too underwater to triage 20 findings, that is itself the answer to whether they would read the reviewer's output — and it is cheaper to learn here than after building.

**Why:** {One sentence: why does this matter?}

## Work Log

- 2026-07-15T14:24:45.773Z Started: Created ticket CWGYH0

## Probe run 2026-07-15 — 10 arcade PRs, all human-APPROVED and merged with ZERO inline comments

Throwaway v1 prompt, three-pass (cold code → Linear contract → PR body last). **10/10 reported.**
**Not cross-model**: ran fresh-context Opus, the same family arcade's agents likely use.
Declared, not implied — dogfooding TB1.R11's second clause.

| PR | intent chars | verdict | findings |
| --- | --- | --- | --- |
| 2113 | 4217 | needs-a-human | **4 (2 blocking)** — verified in full |
| 2100 | 1448 | needs-a-human | 1 question (agent refused to assert; my own check inconclusive) |
| 2109 | 526 | needs-a-human | 1 question — author asked 2 direct questions; approval answered neither |
| 2094 | 3842 | safe-to-merge | 1 — verified |
| 2039 | 1030 | safe-to-merge | 2 verified |
| 2056 | 1978 | safe-to-merge | 1 — verified |
| 2096 | 1733 | safe-to-merge | 1 — author *requested* security review; got zero comments |
| 2051 | 3097 | safe-to-merge | **0 — silence** |
| 2099 | 1301 | safe-to-merge | **0 — silence** |
| 2093 | 1800 | safe-to-merge | **0 — silence** — formed 5 cold hypotheses, verification killed all 5 |

**Verdict distribution is the product:** **7/10 safe-to-merge → an engineer opens 3 PRs, not 10.** That is the capacity answer, and no findings cap could produce it.

**Silence works here.** **3/10 silent (30%).** The safeword probe produced 0/10 silence on a repo whose PRs were 28× larger — evidence the earlier probe's noise was the corpus, not the reviewer.

### The flagship (2113) — the thesis, demonstrated

Contract: `RecordIndexWrite(ctx, model, outcome, batchSize)` / *"Assets successfully upserted"*. Shipped: `RecordIndexWrite(ctx, model, err)` — `batchSize` deleted — `Add(ctx, 1)` / *"Index write batches"*. The author's comment rationalizes the drop by pointing at `catalog_sync_tools_indexed` — and the contract's own Gap section says that metric **"cannot distinguish which embedding model an asset was indexed for."** All verified against the diff + intent this session.

`index_writes` is the go/no-go signal for the qwen3 migration. It counts batches, not assets, and a batch whose embeddings are all missing returns `(0, nil)` → **`outcome=success` for writing nothing**. A broken model shows a green line at full rate. Bugbot: "Low Risk." Human: approved, zero comments. Reviewer: *"the code, the PR body, and Bugbot all agree with each other, and all three are wrong together."*

### Intent richness — the measured finding (refines the tier model)

Richness does NOT predict finding count (2051: 3097 chars → 0 findings; the code was right). Richness predicts **checkability**. 2113's blocking findings were only reachable because the contract was specific; 2109's 526-char contract made conformance *"nearly unfalsifiable."* **Thin intent doesn't mean a clean PR — it means nobody can tell.** Supports collapsing the 4-tier model to intent-richness + provenance (the independent review already flagged 4 tiers as over-built).

### Refinement to the priming rule (from 2109)

Cisco's warning is that the author's prose suppresses criticism. 2109 inverts it: the body *self-disclosed* the PR's weakest point (a subtree modeled without a doc cross-check) and asked two direct questions — and the zero-comment approval engaged with neither. The reviewer's finding came **from** the body. So: read the body LAST, but never ignore it — **author self-disclosure is high-signal**, and an unanswered author question is itself a finding.

### Process findings nobody asked for

Every reviewer audited the *intent process*, not just code — a class no bot can produce: acceptance criteria scoped to "another PR's diff" (uncheckable by anyone, 2099); follow-up PRs reusing a parent's Linear link so the linkback looks like a contract but carries no obligation (2056); a deflake ticket that never said "without reducing coverage" (2039); goembed's CI sitting in a nested `.github/` GitHub Actions never reads, so those tests have **never run** (2056, verified).

### Restraint (the metric-C evidence)

2099 declined a scope gap ("asserting a gap here would be confidently wrong"). 2056 declined a conformance gap belonging to the parent PR. 2100 caught its own stale checkout and **dropped** a finding that would have been confidently wrong. 2109 killed its own google_slides hypothesis by verifying it. **2093 is the strongest case: five cold hypotheses, all five killed by verification** — including one it named as "training-data pattern-matching" — and it declined a sixth as "would have been confidently wrong". Five plausible bot comments a lesser reviewer ships.

### NEW RISK the probe surfaced: intent-granularity mismatch

Three PRs (2056, 2093, 2109) hit the same trap: the linked Linear issue is written at **epic granularity**, not PR granularity, so it bundles work this PR never owned. 2093 states it plainly: *"A reviewer checking conformance against the Linear contract alone would flag a false positive here."* 2056: reusing a parent's link means the linkback *looks* like a contract while carrying no obligation for the diff under review.

**This is the intent-conformance wedge's own failure mode, and the design does not yet handle it.** A naive contract-vs-diff check generates false CONFORMANCE findings — exactly the confidently-wrong class that is metric C's kill criterion. In all three cases only the PR body (written after the code) disambiguated scope, which cuts against reading the body last. Needs an answer before G5337S implements: detect granularity mismatch, or weight the contract down when it doesn't match the diff's scope.

### Honest caveats

- **Not triaged.** Arcade engineers must judge these. The agent that built the reviewer must not score it (Greptile: an LLM's judgment of its own output was "nearly random").
- **Not cross-model.** Same-model fresh context. Declared, per TB1.R11.
- **My spot-checks are a weak instrument.** Twice today my own verification nearly produced a false negative (shell ate `$doc`; stale arcade checkout). I confirmed 2113/2094/2056 and was inconclusive on 2100.
- **n=9, one repo, 8 days, one prompt.** Not a result — a reason to build.


**Final: 10/10. 11 findings, 2 blocking, 3 silences (30%), 3 needs-a-human (30%), 7 safe-to-merge (70%).**

## Added measurement 2026-07-16: does the "Noticed nearby" section get acted on?

The reviewer posts off-topic (latent, not-caused-by-this-PR) findings in a collapsed, non-blocking "Noticed nearby" section (G5337S §7a) — a user call that overrides a maintainer's stated "I'd ignore it." The eval must settle who's right:

- **Track the off-topic section's action rate separately** from inline on-topic findings. Acted-on (fixed / filed / replied) vs scrolled-past.
- If it is reliably ignored, the maintainer was right that this is a workflow problem a label can't fix, and §7a comes back out (reverts to run-summary-only or drop).
- The off-topic *rate* is also the §3.5 calibration canary: 1/11 in the first probe. A rising rate means the gate is being used as an escape hatch from the on-topic bar.

## Validation run #2 (2026-07-16) — the ACTUAL skill on a fresh, harder corpus

Run #1 was a throwaway prompt on 10 rubber-stamped (zero-comment) PRs. Run #2 dogfooded the real `skill-draft.md` on **8 fresh, non-overlapping** PRs deliberately chosen HARDER: 5 had human/Bugbot comments, 1 was CHANGES_REQUESTED, 4 linked multi-PR (epic-granularity) tickets.

| PR | verdict | findings |
| --- | --- | --- |
| 2140 | safe-to-merge | 0 (subtracted Bugbot) |
| 2088 | safe-to-merge | 1 — completeness capped to `question` (PLT-2383 = 6 PRs) |
| 2064 | safe-to-merge | 0 — formed 4 hypotheses, refuted all 4 vs the tree |
| 2049 | safe-to-merge | 0 — granularity cap; verified signal-preserving |
| 2112 | safe-to-merge | 1 — evidence-integrity (relaxed evals); **fix gate declined an unverifiable fix** |
| 2061 | safe-to-merge | 0 — subtracted all human+bot; verified 2 novel clean |
| 2135 | safe-to-merge | 2 — prose-lies (wrong metric tags → silent-empty dashboard) + doc-drift |
| 2111 | **needs-a-human** | 4 — evidence-integrity (unproven wiring) + intent (capped) + prose-lies + scope |

**Totals: 10 findings, 0 blocking, 0 false positives, 1 needs-a-human (legitimately), 7 safe-to-merge.**

Every gate fired correctly where applicable: **granularity cap** capped completeness to `question` on all 4 multi-PR tickets (2088/2049/2061/2111) — no false gaps; **fix gate** declined unverifiable fixes twice (2112, 2111) — the exact behavior it was invented for after run #1's regression near-miss; **subtraction** dropped bot/human items on every commented PR; **on-topic gate** routed the monorepo-wide govulncheck off-topic twice (2049, 2135). Highest-value findings came from **evidence-integrity** (the co-headline dimension): tests that would pass with the feature reverted (2112), attribution wiring nothing proves fires (2111).

I independently verified two silences/findings at the merge SHA: 2049's "cache-size metric was dead in prod" (held — no non-test caller) and 2111's prose-lies comment (held — ory.config.ts does not import the middleware). Both survived.

**Caveats:** same-model-family (declared, not truly cross-model); my corpus selection + my classification; the harder corpus was also genuinely cleaner (more-scrutinized PRs), so high silence is partly the corpus, not only precision; still untriaged by arcade engineers. n=8, one repo.

**What it settles:** the accumulated skill is markedly more disciplined than run #1 (which needed the fix gate invented mid-run). And it directly grounds the 2026-07-16 decision to reject the debug/figure-it-out import — the target behaviors already emerged here without those instructions.

### False-negative spot-probe (2026-07-16, while awaiting architect triage)

The automated run measures false POSITIVES (bad findings) — run #2 = zero. It structurally CANNOT measure false NEGATIVES (a wrong `safe-to-merge` that hides a real problem); only someone who knows the code can. As a bounded hedge, I adversarially probed the two highest-stakes `safe-to-merge` verdicts myself — the ones where a miss would hurt most — targeting each reviewer's most consequential judgment call:

- **2064 (CI caching — a miss ships stale artifacts everywhere).** The reviewer waved off Bugbot's "remote cache lacks token scope" as harmless. Verified at merge SHA: `TURBO_CACHE_ACCESS = github.ref=='refs/heads/main' ? 'remote:rw' : 'remote:r'` — PRs are read-only on the remote cache, so a PR structurally cannot poison main's cache. Downgrade correct. **Holds.**
- **2088 (IAM — a miss = over-broad cloud permission).** The reviewer's least-privilege silence: verified `Resource="*"` appears only on `ecr-public:GetAuthorizationToken` + `sts:GetServiceBearerToken` (the two auth actions AWS requires it for); all write actions are ARN-scoped to `charts-staging/*`. **Holds.**

Combined with the two verified findings that also held (2049, 2111): across the full checkable sample, **zero false negatives found.** This is corroboration, not proof — most of the 7 safe calls still need a human who knows the code (the architect question). But the two scariest are independently checked.

## Open-PR run (2026-07-16) — the LIVE use case, 5 currently-open arcade PRs

First run against **unmerged** PRs (the actual product surface — review before merge). Same skill, pinned trees, nothing posted.

| PR | verdict | finding |
| --- | --- | --- |
| 2133 (Google Picker app_id) | safe-to-merge | 0 — applied the "ticket plainly describes more work → treat as broader" fallback, declined a disclosed-follow-up false gap |
| 2144 (tool-search impl) | safe-to-merge | 0 — verified the search filter runs AFTER access hooks (no back-door to hidden tools), impl matches spec #2061 |
| 2119 (gmail triage, 3031L) | safe-to-merge | 1 — **scope**: an OAuth scope reduction on `who_am_i` (drops userinfo.profile/email) bundled into a triage-verbs PR |
| 2145 (MCP OAuth elicitation) | **needs-a-human** | 1 — **doc-drift**: PR body documents an abandoned `-32021`/HTTP-400 path; code ships a non-error auth steer — opposite behavior, and the body is the permanent squash record |
| 2118 (auth redirect-loop fix) | **needs-a-human** | 1 — **evidence-integrity**: the test named for the anti-loop invariant uses `toMatchObject`, so it'd pass even if the fallback re-added `auto_login` and the loop returned |

**5 PRs, 3 findings, 0 blocking, 2 needs-a-human, 3 safe-to-merge. I independently verified all 3 findings at the head SHA — zero false positives.**

Why these matter (the wedge on live PRs): none is a generic bug a linter/Bugbot catches — each needed the change read against its intent/context. A tiny auth-scope change buried in 3k lines; a body that will mislead the next debugger on an OAuth path; a test that looks like it guards the exact bug the PR fixes but doesn't. Both needs-a-human verdicts are legitimate: 2145 (durable record contradicts code on a security path) and 2118 (production-correctness depends on out-of-repo Ory-console config a human must coordinate; PR is CONFLICTING; empty body = zero self-disclosure on a high-stakes auth PR).

Discipline observed: 2145 navigated a real trap — the ticket AC says the degraded path should be an error, so "code violates AC" looked true; the reviewer read the review thread, saw the maintainer had flipped that design to non-error and the author complied, subtracted the false reading, and landed on the real (stale-body) issue. That is the counter-evidence/subtraction machinery preventing a confident false positive on exactly the kind of intent-vs-code mismatch that is this tool's headline risk.

**Caveats unchanged:** same-model (declared), my classification, actively-reviewed PRs so cleanliness is partly the corpus, nothing posted, n=5. Distinct from the two merged runs in that these findings are actionable NOW (pre-merge) if the authors want them.

## First real human triage (2026-07-16, Nate — senior eng) — the gate the project was blocked on

Nate reacted to both the merged-PR run (7 skip / 1 look) and the 3 live open-PR findings we posted. Scorecard:

**Findings landed 3 of 4 useful — one confirmed by the code owner:**

- **#2118 (login redirect `toMatchObject`)** — routed to Sergio (owns the code); **Sergio: "a good one."** A real evidence-integrity catch on a live PR, confirmed by the domain owner who had no reason to flatter it. Strongest single data point of the project.
- **#2119 (who_am_i scope reduction)** — "useful comment… a good catch just so we are sure!" Intentional, exactly as the reviewer framed it (a question, not an assertion). Correct call.
- **MARTECH-52 (the 1 needs-a-human on the merged run)** — "a useful note. I would flag it as minor, but useful." Directionally right; we over-pitched the severity.

**One real MISS — and it's diagnostic:**

- **#2145 (MCP OAuth doc-drift)** — Nate: **"over-rotating on the description, when the BDD is the law."** The reviewer flagged a stale PR body vs the code, but the BDD scenario (BU10.R2) — the executable contract — already matched the code. The skill treated the PR body as "the durable squash record"; arcade treats the BDD as law and the description as disposable. **Fix applied to skill-draft Pass 3: the PR body is the least-authoritative source; when an executable/authoritative source agrees with the code, a stale description is a trivial nitpick at most, never needs-a-human.** This is the highest-value feedback of the project — a specific, expert-sourced over-rotation with a clean provenance-ranking fix.

**Methodological caveat Nate raised (must own):**

- The 7 safe-to-merge are "mostly chores… evaluating very easy ones. Seems correct, but weak evidence." Independent confirmation of our own caveat: the merged corpus was too easy to prove much.
- **#2061 specifically: he asked whether we reviewed it before or after his comments — Sergio and he had gone several review rounds, and we reviewed the FINAL (already-scrubbed) state.** So "safe-to-merge" there is near-worthless evidence: of course pre-reviewed code is clean. The merged-PR runs systematically reviewed post-human-review states → the precision numbers are inflated by corpus contamination. The OPEN-PR run (2118/2119/2145) is the real evidence, because those weren't yet resolved.

**The load-bearing question is STILL unanswered.** Q2 was "would a green safe-to-merge actually make you skip a PR, or open it anyway?" Nate engaged with whether the calls were *correct*, not with whether he'd *change his behavior*. The capacity thesis (verdict-as-product) remains unvalidated — the tool has shown it can produce good findings, not yet that a green verdict earns enough trust to skip.

**Net:** promising, not proven. Real value demonstrated on live substantive PRs (2118 owner-confirmed); one specific correctable over-rotation (2145, fixed); the merged-run precision evidence discounted as corpus-too-easy; the behavioral/capacity question open.

## Note for whoever scores the frozen experiment (added 2026-07-21)

**The experiment is unaffected by the runner's development — but it does not
measure the runner.** Worth stating plainly, because the distinction decides
what a good score entitles you to conclude.

Every trial in this ticket — run #1, run #2, the open-PR run, and the
pre-registered experiment frozen 2026-07-17 — was executed **by hand in an agent
session**: fresh-context model, pinned trees, nothing posted. None of them went
through the shipped pipeline, which did not exist yet (`src/pr-review/invoke.ts`
was created 2026-07-21, four days after the freeze).

So:

- **A good score means the JUDGMENT is good.** That is what was measured, and it
  is the thing worth measuring first.
- **It says nothing about whether the runner delivers that judgment.** Different
  code path, different failure modes, measured separately.

That distinction is not hypothetical. Until 2026-07-21 the prompt and the runner
disagreed on field names — the prompt emitted `file`/`plain_language`/`code_block`
while the parser required `path`/`consequence`. Had anything run through the
pipeline, `verdict` would have parsed while EVERY finding was silently dropped:
a pull request nobody reviewed coming back `reviewed` with zero findings. The
hand-run trials are clean precisely because they bypassed it.

Now reconciled, with `packages/cli/tests/pr-review/output-contract.test.ts`
failing if the two ever drift again. But the shipped path still has no end-to-end
run against a real pull request — so when the prompt clears its bar, the next
question is not "does it review well" but "does the runner deliver what the
trials proved it can say."

## PRE-REGISTERED predictiveness experiment (2026-07-17, 20 open arcade PRs)

Frozen BEFORE any outcome is known, so the 1–2-week scoring is honest. Design (user): mark every open PR; watch what the team does organically; later score whether the verdict predicted the outcome. Marker format (user): emoji + "trial reviewer: no findings" on clean ones (NO "safeword", NO "safe to merge"); findings as trial comments on flagged ones.

**Prediction under test = the verdict.** safe-to-merge → predict merges without a human requesting substantive changes. needs-a-human → predict it draws changes / discussion / a hold.

**safe-to-merge (11):** 2174, 2170, 2005, 2014, 2158, 2043, 2121, 2168, 2120*, 1959*, 2119 — (*carry a non-blocking FYI finding)
**needs-a-human (9):** 2073, 2122, 2026, 2150, 1998, 2128, 2146, 2046, 2118

Verdicts + head SHAs are in scratchpad/arcade-sweep/ledger.tsv (frozen at review time). Scoring in ~2 weeks: for each PR, did the outcome (merged-clean / changes-requested / still-open-with-discussion / closed) match the verdict?

**Quality note:** across the 18 fresh reviews, the findings skew genuinely useful — the two strongest (2128: an eval proxy that would execute REAL tools + an untested API-key redirect guard; 2146: a CI job that never runs on test-only changes + a semver test that can't catch its own bug) are exactly the evidence-integrity catches humans miss because CI is green. And 2150 explicitly applied the just-added #2145 fix (suppressed a description-vs-code over-rotation because the BDD agreed), validating that fix live. 2122 is the one at-risk finding (2145-adjacent over-rotation) — held pending review.

## SCORING the frozen experiment — day 8 (2026-07-25, PARTIAL: plan said ~day 14)

Scored from GitHub state, 8 days after the 2026-07-17 freeze. **6 of 20 are still
unresolved (open)**, so this is an interim read — re-score at day 14+.

**`safe-to-merge` (11): 6 resolved, 6 hits, 0 misses.** Every one that closed merged
clean with zero changes-requested (2174, 2170, 2005, 2121, 2120, 2119). Still open:
2014, 2158, 2043, 2168, 1959. **This half of the verdict is validated so far.**

**`needs-a-human` (9): 2 hits, ~5 misses, 1 ambiguous, 1 pending.**

| PR | outcome | scored |
| --- | --- | --- |
| 2122 | CLOSED after 2× changes-requested; **split into a 6-part stack** (#2232→#2237) | ✅ hit — and this was the ticket's flagged "at-risk" finding, posted deliberately AS A QUESTION. The caution was right. |
| 2150 | CLOSED after 1× changes-requested | ✅ hit |
| 2146 | MERGED with **zero approvals**, 8 comments of author back-and-forth | ~ ambiguous |
| 2046 | still OPEN at day 8 | pending |
| 2073, 2026, 1998, 2128, 2118 | MERGED clean, approved, no changes requested | ✖ miss *by the rubric* |

### The rubric is broken for `needs-a-human` — and 2118 proves it

On **2118**, nbarbettini asked the author directly: *"We're testing something, I'm
curious if the above reviewer comment is helpful? Lmk!"* — sdserranog replied:
**"@nbarbettini, that was a good comment."**

2118 is scored a MISS above. An engineer called it good. **So the outcome proxy is
measuring the wrong thing.** "Merged without changes requested" conflates *nothing
was wrong* with *nobody looked* — and WAWQA6's own 42-PR study found this team has
ceded mechanical review to Bugbot (8/42 PRs got zero human review). Team behaviour
is not a correctness oracle on a team that merges fast.

**Consequence for any future eval (incl. the log-mining corpus): the labels are
ASYMMETRIC.** "Acted on" is a strong POSITIVE label. "Merged clean" is a WEAK
NEGATIVE — it is not evidence the finding was wrong. Scoring them as symmetric
hit/miss teaches a reviewer to suppress good findings.

### Data-hygiene facts worth keeping

- **18 of 20 got a trial comment. 2073 and 1998 never did** (no issue comment, no
  inline review comment). They are valid data for the organic-outcome prediction,
  but invalid for "did our comment change anything."
- **Engagement was near-zero: 1 reaction (👍 on 2119) and 1 reply thread (2118)
  across 18 posted comments.** That is a real signal on this ticket's stated risk —
  whether engineers would read the output at all — and it is independent of whether
  the findings were correct.
- **`scratchpad/arcade-sweep/ledger.tsv` is GONE** (scratchpad is session-scoped and
  was cleaned). The frozen head SHAs are lost, so a strict re-score cannot pin each
  PR to the exact reviewed tree. The verdict lists survive above, which is what
  carries the prediction. **Lesson: freeze the ledger IN the ticket, not a scratchpad.**
- **Confound to declare:** posting comments intervened in the thing being measured.
  The design said "watch what the team does organically"; on the 18 commented PRs the
  outcome is no longer purely organic.

### Open question this scoring could not answer

Did the 5 "merged clean" PRs **silently fix** the finding — commits pushed after the
comment that address it, with no reply? Only 2026, 2128, 2118 can be tested (2073 and
1998 got no comment). A silent fix flips a MISS to a HIT and would further indict the
outcome proxy. Untested as of day 8.
