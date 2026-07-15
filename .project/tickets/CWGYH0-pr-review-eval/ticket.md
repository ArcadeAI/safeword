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
