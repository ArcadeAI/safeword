---
id: MK635X
slug: bind-data-evaluation-recording-generation
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/4768
created: 2026-09-22T17:21:43.266Z
last_modified: 2026-09-23T02:08:53.000Z
---

# Keep data evaluation evidence from one recording run

**Goal:** Prove the full-guide and ablation records came from one complete recording generation.

**Why:** Sequential publication can leave a mixed-generation evidence pair that current content bindings accept.

**Type:** Improvement

**Scope:** Mint one identity for each recording run, bind it into both full-guide and ablation evidence, and publish refreshes so interruption cannot leave a newly accepted mixed-generation pair.

**Out of Scope:** Adding statistical multi-trial claims, changing model adapters, or adding a database or external transaction service.

**Done When:**

- [ ] Both evidence files carry the same collision-resistant per-run identity minted when recording begins; that identity is not derived solely from guide, case, rubric, prompt, or configuration bindings.
- [ ] Verification rejects different-generation pairs even when every guide, case, rubric, prompt, and configuration binding matches, and fails closed with a focused diagnostic when the identity is absent from either or both files.
- [ ] A failed or interrupted publish leaves either the previous complete pair or the new complete pair verifiable; the accepted pair changes at one atomic publication point, not through sequential replacement of the two live files.
- [ ] Deterministic verification remains offline and dependency-free.

**Tests:**

- [ ] RED: a changed full response paired with the existing ablation record is accepted when all inputs remain unchanged.
- [ ] GREEN: mixed-generation evidence fails with a focused diagnostic.
- [ ] GREEN: evidence missing identity from one file or both files fails with a focused diagnostic.
- [ ] GREEN: failures injected at every staging and commit boundary, including immediately before and after the atomic publication point, preserve a complete valid pair.
- [ ] GREEN: deterministic verification runs offline without an added dependency.
- [ ] REFACTOR: generation identity and publication logic have one authoritative implementation.

## Work Log

- 2026-09-22T17:21:43.266Z Started: Created ticket MK635X
- 2026-09-22T17:22:30.000Z Validated: A focused probe changed the full response ordering while reusing the checked-in ablation; verifyStoredAblation still returned accepted=true.
- 2026-09-23T02:08:53.000Z Clarified: A recording run must mint an identity independent of unchanged input bindings; publication mechanics remain an implementation decision.
