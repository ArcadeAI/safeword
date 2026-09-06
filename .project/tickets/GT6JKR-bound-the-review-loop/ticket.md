---
id: GT6JKR
slug: bound-the-review-loop
type: task
phase: intake
status: in_progress
created: 2026-09-06T16:19:22.798Z
last_modified: 2026-09-06T16:19:22.798Z
---

# Tell agents when to stop reviewing instead of leaving it to judgment

**Goal:** The quality-review loop has an explicit stopping rule and a class-escalation rule, so review effort tracks defects found rather than the agent's patience.

**Why:** The loop says both 'until Critical is None' and 'don't loop indefinitely'; a real session ran 11 passes with none clean.

## Work Log

- 2026-09-06T16:19:22.798Z Started: Created ticket GT6JKR

- 2026-09-06T16:20:00.000Z Split out of PJT893, where the loop ran eleven passes
  and never returned clean.

  **The instruction contradicts itself.** `quality-review/SKILL.md` says "Run the
  review in passes until **Critical issues** come back None. A couple of passes
  is usually plenty — don't loop indefinitely." That is a terminating condition
  the reviewer may never produce, plus an unbounded caution addressed to the
  agent's judgment. Safeword's own first principle is "Structure enforces;
  instructions suggest" — and this loop is governed by an instruction. In PJT893
  the agent stopped and restarted four times on inconsistent grounds.

  **The reviewer was not at fault.** All eleven findings were real, each with a
  named failing input, and five were fail-open defects on a blocking gate. The
  loop was long because the code was defective and because instances were
  patched one at a time. Do not "fix" this by making the reviewer quieter.

  **Proposed rules, both already implied by material in the repo.**
  1. Continue while any finding is severity `error`, judged against the rubric's
     own definition — a named input producing a wrong or absent verdict — rather
     than the label. The rubric defines this; the loop section never cites it.
  2. At the third finding in a single defect class, fix the class rather than the
     instance.

  **Evidence for rule 2.** PJT893's passes 1–6 were one class (anchor resolution)
  and ended by deleting the surface; passes 7–11 were another (silent row/table
  skips). Applying the rule gives roughly five passes instead of eleven, losing
  no real defect.

  **Rejected: a hard pass budget.** Structural and guaranteed to terminate, but
  PJT893's worst defects arrived at passes 7, 8, 9 and 11 — any plausible budget
  ships a gate that silently judges nothing.

  **Note for implementation.** `reviewScope()` keys on the artifact's content
  hash, so consecutive passes after an edit are distinct scopes; per-scope
  counting will not observe a loop. Count per ticket and artifact if counting is
  wanted at all.
