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
