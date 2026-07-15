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
