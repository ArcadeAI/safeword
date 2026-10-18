---
id: DR5647
slug: clear-stale-dependency-blocks-without-rm
type: task
subtype: bug-investigated
phase: done
status: done
created: 2026-10-08T21:00:00Z
last_modified: 2026-10-17T15:00:00Z
external_issue: https://github.com/ArcadeAI/safeword/issues/5647
scope:
  - Replace the stale-dependency recovery's `rm -f` step with a command host policies accept.
  - Clear the block on every host, including Codex and Cursor, which have no PostToolUse stamping.
  - Name the pinned package-manager version in the recovery message.
out_of_scope:
  - Fixing the user's PATH or version manager.
  - Older dependency-readiness defects found in review (global installs, Husky hook executability, bootstrap lock race) — filed as separate follow-ups.
  - Detecting node_modules changes Safeword never observed (e.g. a manual install on Codex between two input switches). The content marker on main has the same gap (reproduced 2026-10-17); a sentinel becomes that marker and widens nothing. Filed as a follow-up; user chose to ship without it.
done_when:
  - The stale recovery message contains no `rm`.
  - Running the printed recovery clears the pre-tool gate and the done gate.
  - The recovery message names a `packageManager` pin when one exists.
---

# Let host-restricted agents clear stale-dependency blocks without rm

**Goal:** An agent on a host that forbids `rm -f` (Codex) can clear Safeword's stale-dependency block by running the printed recovery as written.

**Why:** #5647 and #5188 — the recovery `bun ci && rm -f node_modules/.safeword-deps-fingerprint && touch node_modules` is rejected by host command policy, and Codex has no PostToolUse hook to stamp the fingerprint, so the done gate stays blocked. #5647 also lost time to an older Bun on PATH with no hint about the pinned version.

## Approach

- Recovery becomes `<install> && touch node_modules/.safeword-deps-reinstalled-<fp12>`, named for the inputs the message was rendered from; no timestamps are compared.
- Every readiness check settles all sentinels: a matching one becomes the content fingerprint marker (stamping clears the rest); otherwise all are discarded with the artifact mtime restored so the marker-less mtime fallback is unaffected.
- The message adds `This project pins <manager>@<version>; if the install fails, check that \`<manager> --version\` matches.` (Corepack hash stripped).

Delivery: PR #5665.

## Work Log

- 2026-10-08 Diagnosed: message comes from the done gate on Codex (no Codex dependency hooks); rm+touch existed only to drop the marker so the mtime fallback could pass. Chose one-shot sentinel over plain `bun ci` (needs PostToolUse, absent on Codex) and over trusting marker mtime (weakens content authority).
- 2026-10-08 TDD: tests in `dependency-readiness.test.ts`; mutation check killed 4/4 sentinel guards after adding the install-attempt test; backdated inputs for coarse-mtime filesystems; added done-gate end-to-end test (fails on main).
- 2026-10-08 Cross-agent Codex quality-review: no findings in this diff; 3 pre-existing findings filed as follow-ups. Diff audit clean.
- 2026-10-16/17 Merged main four times; conflicts only in generated fixture digests and plugin identity, regenerated and verified.
- 2026-10-17 Implement-exit Codex reviews found four sentinel defects, all fixed with failing-first tests: timestamp-based acceptance (coarse/skewed clocks, mtime bump on deletion), an install-attempt guard that could block a real recovery, a leftover sentinel surviving A → B → A, and a sentinel outliving a failed bootstrap. Fifth finding (unobserved manual install between input switches) reproduced on main's marker; answered as pre-existing and out of scope.
- 2026-10-17T18:29:26.156Z Phase: implement → verify
- 2026-10-17T18:29:54.491Z Phase: verify → done
