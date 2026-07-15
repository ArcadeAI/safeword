# Automated PR review — approach brief

**For:** architecture review · **Date:** 2026-07-15 · **Status:** proposal, nothing shipped, nothing posted
**Backing detail:** ticket WAWQA6 + children (G5337S skill, 36EEMY distribution, CWGYH0 eval)

---

## 1. The problem, measured

Arcade's engineers review nearly every PR and catch almost nothing.

Measured on `ArcadeAI/monorepo`, last 60 merged PRs (2026-07-07 → 07-15):

| | |
| --- | --- |
| PRs reviewed | **96%** (58/60) |
| Reviews that requested changes | **1 of 202 (0.5%)** |
| PRs with zero inline comments | **21 of 25** |
| Of the 4 that got comments | 3 were commented by **Cursor Bugbot**, not a human |
| Median PR size | 69 lines / 4 files |
| Volume | ~60 merged PRs in 8 days |

**This is not a coverage problem — it's a depth problem.** The ritual is intact; the substance isn't. Small PRs, high volume, near-universal approval, almost no comments.

That is tolerable when humans write the code. It is dangerous when agents do: **a skimming human and the authoring model share blind spots.** Nothing in the current pipeline is independent of the thing that wrote the code.

## 2. The gap nobody covers

Every arcade PR carries a **mandatory Linear issue** — `check-linear.yml` enforces it as a required status check. That issue is written *before* the code. It is a contract.

**Nothing reads it.** Bugbot doesn't open Linear. A reviewer approving in 0.5%-changes-requested mode isn't checking the diff against it either.

So the unasked question is: **"Did this PR do what the ticket said, and what else did it quietly touch?"**

That is the entire proposal.

## 3. What we're building

A **second reviewer — a different model than the agent that wrote the code** — that:

1. **Pins the diff**, reads it cold (no narrative), then against the Linear contract, then the PR body last.
2. **Subtracts** everything the project already covers — CI, linters, types, tests, **and Bugbot**. If a linter could say it, we don't.
3. Reviews only four things nothing else does: **intent conformance, scope discipline, alternatives, blast radius.**
4. Emits a **triage verdict** — *does this PR need a human's eyes?* — plus findings.

**The verdict is the product.** Findings are secondary. A team drowning doesn't need more to read; it needs permission to skip. In the trial, 7 of 10 PRs came back `safe-to-merge` — an engineer opens 3 instead of 10.

**Delivery:** a GitHub Action wrapping `anthropics/claude-code-action@v1` (runs on your own runners — it is not a hosted service). Safeword ships the *skill*; the runner is a commodity. Warn-mode, no required check, default off, killable by config.

## 4. Evidence — we ran it

Took **10 merged arcade PRs that a human approved with zero inline comments**. Reviewed each. Then had an independent reviewer attack the results.

**Result: 11 findings · 2 blocking · 3 silences · 7 safe-to-merge.**

Things it found in code that humans had already blessed:

- **A goroutine leak** (PR 2039). `errorChan` is unbuffered; once `WaitForAuthorization` returns via its timeout, nobody receives, and the send blocks forever. **Every auth flow where the user never clicks the link leaks a goroutine**, bounded only by process restart. Nothing tracked it.
- **A metric that cannot do its job** (PR 2113). PLT-2398 specified a counter of *assets upserted*, to gate the qwen3 model cutover. What shipped counts *batches*. Neither counter can answer "has the new index populated?" — the question the ticket exists for.
- **Tests that have never run** (PR 2056). goembed's CI lives in `apps/goembed/.github/workflows/` — a nested directory GitHub Actions does not read. Verified against GitHub's docs. Not one of those tests has ever executed.
- **A retry with no timeout** (PR 2094). Three connection attempts with no `connect_timeout`; libpq's documented default is *wait indefinitely*. ~7 minutes to page instead of ~2.

**Three PRs got silence.** On one, the reviewer formed five suspicions cold and its own verification killed all five — including one it identified as "training-data pattern-matching." Five plausible bot comments that a worse reviewer ships.

## 5. Why not just use CodeRabbit / Greptile / Bugbot

You already have Bugbot, and it's good. This is not a competitor — it is the layer above.

The published evidence on generic AI review is unflattering: across 22,326 AI comments in 178 repos, **~70% of AI comments are technically valid and only 0.9–19.2% are ever acted on** — versus **60% for human comments** ([arXiv 2508.18771](https://arxiv.org/abs/2508.18771)). **The failure mode is not wrongness. It's irrelevance.** Most AI review comments are correct and ignorable.

The academic picture explains why the intent angle is open: reviewers' bottleneck is **understanding**, not detection. Bacchelli & Bird's card sort of 570 real review comments found defects are only **14%** of what reviewers actually say (4th of 9 categories; code improvements 29%, understanding 21%) — and that *finding defects demands the most understanding of any outcome*, which is why it's under-produced. **Context is the input that produces depth.**

Our survey found **no tool attempting intent conformance** and **no research evaluating it**. That's our own survey's gap claim, not a cited result — but the reason is structural: none of them have the ticket.

## 6. Risks — the honest list

**1. This tool is dangerous, and we have proof.**
Our flagship finding was *true* and shipped with a *fix that would have broken the code* — it would have made the failure counter unable to increment and turned one of arcade's own tests red. We would have proposed a regression while lecturing about instrumentation quality. **Only an independent adversarial pass caught it.**
→ *Mitigation:* the fix gets its own verification pass, separate from the finding. Minimum bar: does the patch break a test the PR ships?

**2. Severity inflation.**
The same finding claimed a "false green to cut over on" — and never noticed the idempotency-ledger guard **40 lines away**, whose comment describes the exact failure mode we were warning about. The author had already handled it.
→ *Mitigation:* mandatory counter-evidence pass before assigning severity. "Did the author already think about this?"

**3. Stale-tree findings.**
Our probe reasoned partly against a checkout **483 commits out of date**. One reviewer caught this itself and dropped a finding that "would have been confidently wrong"; the orchestrator did not, and briefly concluded a true finding was false.
→ *Mitigation:* pin the tree; fail loudly on mismatch; treat the diff as ground truth.

**4. Trust is spendable once.**
The strongest predictor that a review comment is acted on is that **a human wrote it** (ρ=0.99 in the study above). We start from a deficit. A wrong comment on a senior engineer's PR costs more than a right one gains.
→ *Mitigation:* Google's Tricorder precedent — trust is a metric with a kill switch. Analyzers with high "not useful" rates get fixed or disabled. Ship one comment, read the room, then decide.

**5. The uncomfortable one.**
If engineers rubber-stamp because they're **too busy**, this helps — it tells them which 3 of 10 to open. If they rubber-stamp because they **trust the agent writing the code**, this tool tells them something they don't want to hear. That's a people problem, and no tooling fixes it.

## 7. What we're NOT doing

- **Not a server.** `claude-code-action` runs on your runners. A webhook service is net-new infrastructure for a trigger GitHub gives away.
- **Not generic bug-hunting.** Commodity; Bugbot has it.
- **Not a required check.** Warn-mode. Nothing is gated on it.
- **Not a voting panel.** A single adversarial cross-model reviewer beats a committee — correlated models converge on shared wrong answers.
- **Not capped at N findings.** A cap suppresses truth. A bar plus a verdict handles volume.

## 8. Open questions for architecture review

1. **Cross-model, how?** v1 *implies* the reviewer differs from the author by configuration ("our agents are Claude → review with something else"). That's wrong the moment the fleet is mixed, and it **fails silently** — a same-model review that believes it's cross-model launders shared blind spots as independent verification. Detection is filed (X1Z5MG), but v1 ships on an assumption.
2. **Intent-granularity mismatch.** Three of ten PRs linked a Linear issue written at *epic* granularity, bundling work the PR never owned. A naive contract-vs-diff check generates **false conformance findings** — the wedge's own failure mode. Needs an answer before build.
3. **Who triages?** ~225 PRs/month. If nobody has time to read the reviewer's output, we've taxed the bottleneck instead of relieving it. Our own 10-PR trial is *still* untriaged — that's the bottleneck in miniature.
4. **Where does a non-coder read this?** The output surface is inline PR comments. Someone directing an agent in natural language may never open the Files-changed tab.
5. **Confidence in the trial itself.** n=10, one repo, 8 days, one throwaway prompt, not cross-model, untriaged by the people who own the code. It is a reason to build — not a result.

## 9. Recommendation

Post **one** comment: the goroutine leak (PR 2039). Fully traced, correct fix, real production bug, nothing tracking it.

Then read the room. If the owner says "we know" or "you're wrong," that is the cheapest lesson available. If it lands, ship the other three and build the eval properly against a bar recorded *before* triage.

**The bar to beat is not "is it right." It's "would you have acted on it."** The published ceiling for AI review is ~19% acted-on versus ~60% for humans. If we can't clearly beat the bots on the dimension they can't reach, this doesn't ship.
