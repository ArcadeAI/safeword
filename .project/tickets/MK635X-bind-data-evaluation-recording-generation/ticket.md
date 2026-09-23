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

**Out of Scope:** Adding statistical multi-trial claims, changing model adapters, adding a database or external transaction service, coordinating concurrent recording runs, or guaranteeing snapshot reads while publication overlaps a reader.

**Done When:**

- [ ] Both evidence files carry the same UUIDv4 per-run identity minted from platform cryptographic randomness when recording begins; two consecutive runs in one process receive distinct identities, independent of guide, case, rubric, prompt, or configuration bindings.
- [ ] Verification rejects different-generation pairs even when every guide, case, rubric, prompt, and configuration binding matches, and fails closed when either identity is absent, empty, or malformed. Diagnostics name the affected file and defect class.
- [ ] A failed or interrupted refresh leaves either the previous complete pair or the new complete pair verifiable; the accepted-pair location changes through exactly one filesystem mutation, never through sequential replacement of the two live files. Before a first publish, interruption may leave no accepted pair. The implementation documents its ordered filesystem mutations, supported filesystems, atomic primitive, and tested interruption classes.
- [ ] Deterministic verification remains offline and dependency-free; existing evidence consumers and release checks continue to resolve the accepted pair after any layout or indirection change.
- [ ] The checked-in legacy evidence pair is re-recorded through the new path before fail-closed identity verification becomes the release gate; no identity-free compatibility bypass remains.

**Tests:**

- [ ] RED: a changed full response paired with the existing ablation record is accepted when all inputs remain unchanged.
- [ ] GREEN: two consecutive real recordings in one process produce distinct identities; a mixed pair fails with a diagnostic naming the mismatched files and defect class.
- [ ] GREEN: a staged full-guide record from interrupted run A paired with run B's ablation fails using identities carried from recording despite identical input bindings, even if publication happens in one atomic step.
- [ ] GREEN: evidence missing identity from one file or both files, or carrying an empty or malformed identity, fails with a diagnostic naming the affected file and defect class.
- [ ] GREEN: instrumentation counts every actual filesystem mutation during publication, proves exactly one changes the accepted-pair location, and injects failure at every observed mutation boundary; refresh preserves a complete valid pair, while interrupted first publication may leave none.
- [ ] GREEN: deterministic verification runs offline without an added dependency.
- [ ] GREEN: the minting call uses platform cryptographic randomness, and existing evidence consumers and release checks resolve the accepted pair after publication.
- [ ] GREEN: the re-recorded checked-in pair passes identity verification; the prior identity-free pair fails it.
- [ ] REFACTOR: generation identity and publication logic have one authoritative implementation.

## Work Log

- 2026-09-22T17:21:43.266Z Started: Created ticket MK635X
- 2026-09-22T17:22:30.000Z Validated: A focused probe changed the full response ordering while reusing the checked-in ablation; verifyStoredAblation still returned accepted=true.
- 2026-09-23T02:08:53.000Z Clarified: A recording run must mint an identity independent of unchanged input bindings; publication mechanics remain an implementation decision.
