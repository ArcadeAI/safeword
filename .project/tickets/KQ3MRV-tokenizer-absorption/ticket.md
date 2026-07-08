---
id: KQ3MRV
slug: tokenizer-absorption
type: task
phase: implement
status: in_progress
created: 2026-07-08T02:10:00.000Z
last_modified: 2026-07-08T02:10:00.000Z
---

# Absorb the two remaining private shell tokenizers into shell-segments

**Goal:** Migrate `cursor-run-identity.ts` and `branch-staleness.ts` — the two private shell tokenizers the EDDABK code review found outside the four Bash security gates — onto the shared `shell-segments.ts` tokenizer, so the "one tokenizer, one test surface" property holds repo-wide.

**Why:** Follow-up spawned from ticket EDDABK / PR #959. `cursor-run-identity.ts` has a **real functional gap**, not just duplication: its `executableIndexOf` skips only `VAR=val` words, so `command bun .safeword/hooks/write-review-stamp.ts …` / `env bun …record-skill-invocation.ts <skill>` resolve the executable to `command`/`env`, the run-identity/stamp proof is never recorded, and the delegated fail-closed stamp gate can later deny a legitimate write. `branch-staleness.ts`'s `parseCheckoutTarget` uses a bare whitespace split: `git fetch && git checkout main` returns null (warn skipped), quoted prose probes bogus branches, and its flag scan crosses segment boundaries (`git checkout main && git branch -d old` → null; `git checkout -q && echo hi` → bogus target `&&`).

## Constraints

1. Depends on the unified tokenizer from EDDABK (`commandWords` export) — branch stacks on `frosty-yonath-9f2adb` (PR #959) until it merges.
2. Byte-parity mirrors under `.safeword/hooks/lib/` (schema `ownedFiles`).
3. No silent weakening: `sudo git checkout main` was caught by the old flat `indexOf('git')` scan — preserved via a local sudo-skip (kill-guard's pattern).
4. `isInvocationHelperPath` stays slash-anchored-only (deliberate, per its own doc comment) — bare-relative record forms are out of scope.

## Work Log

- 2026-07-08T02:10 Created from the EDDABK follow-up task. Both files read; migration mapped (consumers keep positional contracts: `words[0]`=bun, `words[1]`=helper, `words[3]`=skill). 24-case smoke table green: all preserved behaviors (incl. the pinned newline `SELF_REVIEW_FALLBACK`, prose negatives, sudo checkout) + all gains (`command`/`env` prefixes now record proof; newline segmentation; per-segment checkout parse fixing the `&&` misses and the cross-segment flag bug). The one apparent regression in the smoke table was a wrong expectation: quoted bare-relative `record-skill-invocation` never matched (slash-anchored matcher, unchanged).
