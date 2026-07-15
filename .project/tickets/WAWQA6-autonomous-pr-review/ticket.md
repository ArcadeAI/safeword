---
id: WAWQA6
slug: autonomous-pr-review
type: feature
phase: intake
status: in_progress
scope:
  - A `pr-review` skill (the durable asset) that reviews a PR diff against the ticket artifacts carried in that same diff — spec.md, impl-plan.md, test-definitions.md, done_when, Out of scope.
  - A GitHub Action workflow wrapping `anthropics/claude-code-action@v1`, authed via Workload Identity Federation (GitHub OIDC), triggered on `ready_for_review`/label — not every `synchronize`.
  - A shadow-mode evaluation over the last ~10 merged PRs, human-triaged, with an actionable-rate bar set BEFORE looking at results.
  - Output discipline: hunk-anchored findings, each carrying a code block, capped (~5), batched into one `POST /pulls/{n}/reviews` call, Conventional Comments labels, provenance-gated severity.
out_of_scope:
  - A server/daemon or webhook service — `claude-code-action` runs on our own runners and is structurally the not-a-service answer. Revisit only for cross-repo/org-wide or non-GitHub triggers.
  - Re-reviewing anything CI already covers: style, format, types, build, tests, dead code, cycles, doc/parity drift.
  - Generic bug-hunting as the headline — commodity; native `/code-review` and hosted bots already do it.
  - A required status check / hard block. Warn-mode only at first (precedent: the done-flip guard #460 over-fired and was held to warn-mode).
  - Voting panels of reviewers — already rejected by ADR as the "popularity trap".
  - Shipping to customers via `safeword setup` — v1 targets this repo. Customer packaging is a follow-up (and reopens the Claude-only-runner question).
done_when:
  - Shadow mode has run over ~10 merged PRs and its actionable rate clears a bar recorded in this ticket before the results were read.
  - Findings are hunk-anchored with a code block each, capped, and batched into a single review call.
  - The reviewer is silent on a clean PR (no "LGTM" comment).
  - A severity claim cannot block unless it cites a `verified` source (reuses the quality-review provenance gate).
  - A kill switch exists: the workflow can be disabled by config without deleting it, and the trust metric that would trigger that is named.
created: 2026-07-15T02:50:15.807Z
last_modified: 2026-07-15T02:50:15.807Z
---

# Autonomous PR review at the intent-conformance bar

**Goal:** Review open PRs autonomously via GitHub Action, on the dimensions no linter or generic AI reviewer covers: intent conformance, scope discipline, alternatives, blast radius.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Why now — the vacuum

40 of the last 40 merged PRs have **zero** reviews; ~100 PRs merged in 30 days; essentially one author. This is not competing with a human reviewer, it is filling a vacuum. Separately, `reviewGate` is off in our own `.safeword/config.json`, so the PR is currently the only unguarded boundary where review could bite.

Our PRs are also far past the size where review is known to work: PR #1053 is +1,922 lines / 44 files, against Google's median change of **24 lines**. Cisco found no review >250 lines exceeded 37 defects/kLOC and reviewers wear out after ~60 min. Human-style review of these PRs is a known-ineffective activity.

## The thesis (what makes this not-a-CodeRabbit)

Safeword PRs carry their own intent artifacts **inside the diff**: `spec.md`, `impl-plan.md`, `test-definitions.md`, `done_when`, `Out of scope`. A generic reviewer checks a diff against "good code in general." This checks a diff against **its own declared intent**.

The literature backs this as the under-served dimension: Bacchelli & Bird found reviewer *understanding* is the bottleneck (91% say unfamiliar files take longer; 82% say familiar reviewers give conceptual rather than superficial feedback) and that finding defects **requires the most understanding of any outcome** — which is why it is under-produced. Context is the input that produces depth. Meanwhile a 178-repo study of AI reviewers found none attempting intent conformance, because none had the spec in the diff. Search for PM-level PR review research returned essentially **zero** results — under-served, not solved.

## What the review consists of

Do these four; stay silent on everything else:

| Dimension | Covered today by | Marginal value |
| --- | --- | --- |
| Style/format/types/build/tests | CI lint+test jobs | zero |
| Dead code, cycles | knip, dependency-cruiser | zero |
| Doc/parity drift | `architecture --check`, `parity-check` | zero |
| Generic bug-hunting | native `/code-review`, hosted bots | low — commodity |
| **Intent conformance** — does the code do what spec.md said; is `done_when` truly met? | nobody | **high** |
| **Scope discipline** — did it breach `Out of scope`; is it bundling? | nobody | **high** |
| **Alternative solutions** — is there a simpler shape? | nobody | **high** |
| **Blast radius / reversibility** | nobody | **high** |

## Design constraints (each carries a citation or a precedent)

- **Noise is irrelevance, not wrongness.** arXiv 2508.18771 (22,326 AI comments, 178 repos): ~70% of AI comments are *valid*, yet ≤19.2% are acted on, vs **60%** for human comments. The enemy is the correct-but-ignorable comment.
- **Hunk-anchored, not summary.** Hunk-level comments are acted on at **43.88%** vs ≤13.89% file-level (file-level ρ=−0.96). A sticky summary comment is the move that makes findings ignorable.
- **Every finding carries a code block.** Strongest positive correlate of action: ρ=**0.78**. Verbosity hurts (ρ=−0.28).
- **Do not auto-fire on every push.** Manual-triggered comments are acted on at 12.8% vs 6.8% automatic (ρ=−0.97). *Caveat: almost certainly confounded by selection — a manual trigger means someone wanted a review. Not proof of mechanism, but enough to move the default given our 97%-noise history.*
- **Silence on clean PRs.** No LGTM comment.
- **Don't trust an LLM to filter its own noise.** Greptile's postmortem: "the LLM's judgment of its own output was nearly random." `claude-code-action`'s `classify_inline_comments` (Haiku, default true) is a convenience, not the noise control.
- **Never one scalar.** A nitpick-rate metric "would go up if you leave almost no comments." Same trap our GEPA harness already hit — which is why its evaluator has no F1 headline. Score actionable-rate and coverage separately.
- **Trust is a metric with a kill switch.** Google's Tricorder fixes or disables any analyzer with a high "not useful" rate.
- **Provenance gates severity.** Reuse `quality-review`'s rule: only a `verified` source can block; training-data/uncertain cap at a non-blocking note.

## The priming trap (design detail, easy to miss)

Cisco found author-prepared reviews **never** exceeded 30 defects/kLOC, most commonly finding **zero** — one reading being that priming *disables* reviewer criticism ("as long as the code matches the prose, the reviewer is satisfied"). Our PR bodies are long and confident. So **split the passes**: hunt correctness cold from the diff alone, *then* read the ticket contract and check conformance. The intent artifacts are the contract; the PR body is the author's closing argument and must not be read before the evidence.

## Decision record

- Source: `/figure-it-out` session 2026-07-15. Three research agents (repo map; AI-review tool landscape + GitHub API; code-review effectiveness literature). Primary sources read in full.
- **Chose:** GitHub Action wrapping `claude-code-action@v1`; safeword ships the **skill**, not the runner.
- **Rejected — server/daemon:** net-new hosting, webhooks, HMAC, queue, retry, observability, for a single-repo problem GitHub already triggers. `claude-code-action` runs on our runners (MIT), structurally the opposite of hosted CodeRabbit/Greptile/Bugbot. Revisit for cross-repo/org-wide/non-GitHub.
- **Rejected (for v1) — `safeword review-pr` CLI + headless `claude -p`:** the real runner-up; reuses `retro/github-rest.ts` + `hooks/lib/retro-extract.ts` and fits safeword's cross-harness identity (`claude-code-action` is Claude-only). Loses because it reimplements what Anthropic maintains. **The skill is the moat; the runner is a commodity** — and the skill ports to this later without rewrite.
- **Answers X4518B** (native-review overlap positioning) for this surface: *delegate the mechanism, own the judgment* — the "mix" that ticket predicted.
- Auth: **Workload Identity Federation** (GitHub OIDC, `id-token: write`) — no static secret. This repo is public and has **no secrets configured**. `claude_code_oauth_token` via `claude setup-token` is the fallback.
- API mechanics: batch all inline comments into ONE `POST /pulls/{n}/reviews` — review submissions hit GitHub's **secondary** rate limits, surfacing as **422**, not 429. `position` is deprecated; use `line`+`side`.
- **No neutral benchmark exists in this category.** Greptile self-reports 82% recall / 66.2% precision; a competitor benchmark puts the same tool at 36.1% / 15.9%. Their public benchmark measures recall but not precision. Treat every vendor number as marketing — including any we might later publish.

**Riskiest assumption:** that intent-conformance findings clear a materially higher actionable rate than the ~6.8% automatic-comment baseline. **Cheapest test:** shadow mode over ~10 merged PRs — the corpus already exists and costs only tokens.

## Shadow-mode pre-registration (committed BEFORE the probe ran)

Pre-registered 2026-07-15, before any finding existed. Committed to git ahead of the run so neither the bar nor the corpus can be fitted to the results. Bar set by the agent because the user delegated it ("do it"); the user may dispute the numbers, but only against this recorded version.

**Corpus (locked, no substitution):** merged PRs #1052, #1038, #994, #992, #990, #988, #967, #964, #958, #949. Selection rule, applied before reading any diff: merged, non-dependabot, carries ≥1 ticket artifact in-diff, ≥5 files changed, excluding administrative `chore(ticket): close` PRs. Every PR matching that rule in the last 60 merged is included — no cherry-picking.

**Three separate metrics. No composite, no trade-offs** — per the GEPA evaluator's no-F1-headline lesson and the "never one scalar" constraint above.

| # | Metric | Bar | Rationale |
| --- | --- | --- | --- |
| **A** | **Actionable rate** — share of all surfaced findings the user marks "real / would act on" | **≥40%** | Best generic AI reviewer measured at **19.2%** (arXiv 2508.18771); hunk-level ceiling observed in the wild is **43.88%**. If intent-conformance can't clearly beat the best generic tool, the thesis is dead. Deliberately ambitious. |
| **B** | **Coverage** — PRs (of 10) with ≥1 real finding | **≥3** | Blocks the degenerate win: near-silence buys a perfect rate. This is exactly Greptile's metric trap ("would go up if you leave almost no comments"). |
| **C** | **False certainty** — findings that confidently assert something false about the spec or code | **≤1** total | A wrong-but-ignored comment is cheap; a wrong-but-confident one burns trust. Per PRINCIPLES, false certainty is the cry-wolf mechanism. |

**Ship decision:** A ≥40% **AND** B ≥3 **AND** C ≤1. All three. Failing any one means do not ship — a strong A does not buy a bad C.

**What the probe is:** a throwaway v0 prompt, not the shipped skill. This is an intake experiment testing the riskiest assumption, not implementation. A failed bar kills or reshapes the feature; it does not mean "tune the prompt until it passes" — that is the eval-gaming failure our GEPA run already hit.

## Citations

- [Bacchelli & Bird, ICSE 2013](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ICSE202013-codereview.pdf) — defects are 14% of comments (4th of 9); code improvements 29%, understanding 21%; understanding is the bottleneck.
- [Sadowski et al., ICSE-SEIP 2018](https://sback.it/publications/icse2018seip.pdf) — median change 24 lines; median 1 reviewer; Tricorder's not-useful kill switch; "context" as a named, untooled pain point.
- [arXiv 2508.18771](https://arxiv.org/abs/2508.18771) — 22,326 AI comments / 178 repos; the valid-but-ignored gap; hunk vs file; code-block ρ=0.78.
- [Code Review at Cisco Systems](https://static1.smartbear.co/support/media/resources/cc/book/code-review-cisco-case-study.pdf) — size/fatigue limits; the author-priming trap. *Vendor study, not peer-reviewed; their "defect" ≠ bug. The famous "200–400 LOC → 70–90% discovery" line is NOT in it — do not cite.*
- [Conventional Comments](https://conventionalcomments.org/) — output schema; independently reinvented Bacchelli's taxonomy; 3 of 9 labels non-blocking by definition.
- [Greptile nitpick postmortem](https://news.ycombinator.com/item?id=42451968) — LLM self-judgment "nearly random"; the metric trap.
- `.project/learnings/dogfooding-enforcement-session.md` — our own 304 fires / ~5 catches / 97% noise.

## Work Log

- 2026-07-15T02:50:15.807Z Started: Created ticket WAWQA6
- 2026-07-15T02:52:00.000Z Filed from a `/figure-it-out` pass. Classified **feature** (new skill + workflow + config surface, customer-facing eventually, needs the BDD flow). Captured the architecture decision, the four review dimensions, the anti-noise constraints, and the shadow-mode gate. Ticket is intake-phase; `spec.md` (personas/JTBD/outcomes) is the next artifact and is NOT yet written.
