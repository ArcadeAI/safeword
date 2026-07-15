---
id: G5337S
slug: pr-review-skill
type: feature
phase: intake
status: in_progress
depends_on: [CWGYH0]
scope:
  - The `pr-review` SKILL.md — the durable asset and the only real moat. Authored RUNNER-AGNOSTIC so it ports to the `review-pr` CLI without rewrite.
  - Three-pass procedure: COLD (code only, no narrative) → INTENT (the Linear contract) → BODY (last, only to catch body-vs-diff mismatch).
  - Four dimensions: intent conformance, scope discipline, alternatives, blast radius.
  - Triage verdict (safe-to-merge / needs-a-human / not-reviewable-as-is) as the PRIMARY output; findings second.
  - Uncapped findings behind an evidence bar; plain-language consequence on every finding (NTB1.R1).
out_of_scope:
  - The workflow, config, ownedFiles, kill switch, trigger gating, fork safety — all 36EEMY.
  - The eval corpus and its bar — CWGYH0.
  - Author-model detection — X1Z5MG. v1 implies it by config.
done_when:
  - Rules TB1.R1-R11 and NTB1.R1-R4 each have a proving scenario or an explicit skip.
  - The skill is silent on a certified-clean PR.
  - A finding it cannot verify never blocks; the skill says so rather than dropping it.
scope:
out_of_scope:
done_when:
parent: WAWQA6
created: 2026-07-15T14:24:45.692Z
last_modified: 2026-07-15T14:24:45.692Z
---

# pr-review-skill

**Goal:** The cross-model reviewer skill: read a PR against its declared intent (Linear contract), return a triage verdict plus uncapped bar-cleared findings. Serves TB1 + NTB1.

**Why:** The skill is the moat; the runner is a commodity. Everything else in this epic is delivery. Blocked-on CWGYH0 in spirit rather than sequence: the eval is what tells us whether the judgment is worth shipping, so build the skill against the eval, not ahead of it.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T14:24:45.692Z Started: Created ticket G5337S

## Design finding: verify the FIX, not just the finding (2026-07-15)

An adversarial `/quality-review` of the four arcade findings — before anything was posted — caught that the flagship's **claim was true and its fix was a regression**.

The finding on PR #2113 (`index_writes` counts batches, not assets) was correct and verified. The proposed fix — `Add(ctx, int64(count))`, count=0 on failure — would have made `index_writes{outcome=failure}` **a counter that can never increment**, killing failure alerting and turning the PR's own shipped test red (`assert.Equal(t, int64(1), qwenFail.Value)`). It would have proposed a regression while complaining about instrumentation quality.

The severity was also inflated. The draft claimed a "false green to cut over on" and never engaged with counter-evidence sitting in the same file: `UpsertAssets` gates the idempotency ledger on `count == validCount` and logs *"skipping ingestion ledger write: not all assets persisted"* (`service.go:209`) — with a comment where the author explains the exact failure mode the draft was warning them about. A goembed error `continue`s before `indexAssetsBatch` is reached, so the scenario needs goembed returning 200 with an empty embedding list. Narrow, not systemic.

### Consequences for the skill

1. **The `code_block` requirement cuts both ways.** Code blocks are the strongest correlate of a comment being acted on (ρ=0.78) — which means a *wrong* code block is the most dangerous thing the reviewer can emit. It gets applied. **A finding's fix needs its own verification pass, distinct from the finding's.** Minimum bar: does the proposed patch break any test the PR ships?
2. **Require a counter-evidence pass before severity.** The reviewer must actively hunt for guards that already mitigate the finding, and either name them or lower severity. "Did the author already think about this?" — the ledger guard was 40 lines from the finding.
3. **Deliberate-and-documented ≠ oversight.** The shipped metric description said *"Index write **batches**"* — self-consistent, i.e. a considered deviation. The draft read as if the author hadn't noticed. Detect self-consistency between code and its own docs before implying a mistake.
4. **This is metric C (false certainty) firing on our own output** — the kill criterion, caught only because an independent reviewer ran. The author-agent verified the *claim* and never questioned the *fix*, which is precisely the correlated blind spot PRINCIPLES §1 predicts. **Strong evidence the reviewer needs an adversarial pass on its own findings before posting, not just before shipping the skill.**

## Design finding: the reviewer must PIN its tree (2026-07-15)

**Discovered by the user asking "did you dig into the arcade-monorepo codebase?"** — the honest answer exposed a hazard in the skill, not just in the probe.

The probe's local arcade checkout was **483 commits behind origin/main, on a WIP branch, containing none of the four PRs under review**. Agents were told "you may read the repo at /Users/alex/Projects/arcade-monorepo for context." That instruction silently resolved to *"reason about a 483-commit-old tree."*

**Both failure and correct behavior occurred, and the difference was luck:**

- The orchestrator (me) ran `find … db.py` against the stale tree, got nothing, and briefly concluded a TRUE finding was false. Recovered only by falling back to the fetched diff.
- The orchestrator verified 2056 entirely against the stale tree. The claim happens to hold on real `origin/main` (re-verified after the fact) — right answer, unsound method.
- PR 2100's reviewer hit the same stale tree, noticed a `PUBLIC`→`STATIC` rename it couldn't account for, inferred its checkout predated the PR, and **dropped a finding that "would have been confidently wrong."** That is the behavior the skill needs, and it emerged from the agent's own discipline rather than from any instruction.

### Requirements this generates

1. **The tree is an input, not an ambient fact.** The skill must review against a tree that provably contains the PR's head/merge-base. In CI this is free (`claude-code-action` checks out the PR head) — but the skill must not assume it, because the same skill runs locally and via the planned `review-pr` CLI where the working copy is arbitrary.
2. **Fail loudly on a tree mismatch.** If the checkout doesn't contain the PR's SHA, say so and fall back to the diff — never silently reason about different code. A stale-tree finding is indistinguishable from a real one at the point of posting, which makes it a metric-C (false-certainty) generator.
3. **Prefer the diff as ground truth; treat the tree as context only.** Every sound verification in the probe came from the fetched diff or `gh api` at a pinned ref. Every unsound one came from the ambient working copy.
4. **`gh pr view --json mergeCommitOid` returned EMPTY for all four merged PRs** (squash-merge and/or permissions). So "pin to the merge commit" is not reliably available — the skill needs a fallback chain (head SHA → base SHA → diff-only) rather than assuming a merge SHA exists.

**Meta-observation worth keeping:** the deepest verification in the entire session (the adversarial pass, 23 tool calls, `gh api` against the merged tree) produced the most consequential result — catching that the flagship's fix was a regression. Depth of digging correlated with value of finding, exactly as Bacchelli & Bird predict ("finding defects requires the most understanding of any outcome"). The corollary is uncomfortable: the probe's *median* reviewer dug less than that, so its findings deserve less confidence than its confident prose implies.
