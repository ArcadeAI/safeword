---
id: 07BW3N
slug: review-stamp-helper-help
type: task
phase: done
status: done
created: 2026-09-13T04:15:52.685Z
last_modified: 2026-09-13T14:10:34.506Z
---

# Show review-stamp help without artifact lookup

**Goal:** Make the review-stamp helper show usage for standard help flags without resolving a ticket or writing a stamp.

**Why:** Agents need a reliable self-service way to discover the helper contract.

**Type:** Bug

**Scope:** Recognize the review-stamp helper's standard `-h` and `--help` flags,
print its usage, and exit successfully before resolving run identity, tickets, or
artifacts.

**Out of Scope:** Replacing the helper's parser, changing stamp semantics, or
changing how unknown options are rejected.

**Done When:**

- [x] Both standard help flags print actionable usage and exit successfully
      without a runtime identity or active ticket.
- [x] Help invocation writes no review stamp or other project state.
- [x] Values consumed by existing options are not reinterpreted as help flags.

**Tests:**

- [x] Integration: invoking the real helper with `-h` or `--help` and no runtime
      identity exits 0, prints usage, and writes no stamp.
- [x] Integration: `-h` consumed as a `--skip` value remains a skip reason rather
      than triggering help.

**External Issue:** https://github.com/ArcadeAI/safeword/issues/4521

## Root Cause

The handwritten parser classifies every token except known value-taking flags as
an artifact/phase positional, so `--help` becomes the artifact name. Run identity
is also resolved before parsing, making even informational calls depend on
operational state. The source trace and direct invocation confirm this ordering.

Ruled out: the packaged `project runtime` forwarding layer is not the cause; the
reported direct helper invocation reaches this parser unchanged. Also ruled out:
active-ticket selection is not the root cause; it only determines whether the
bad help token fails first as missing identity, ambiguous ticket, or missing
artifact.

## Work Log

- 2026-09-13T04:15:52.685Z Started: Created ticket 07BW3N
- 2026-09-13T04:18:00.000Z Reproduced: `--help` follows the artifact path instead
  of an informational path; without runtime identity it fails even earlier.
- 2026-09-13T04:20:00.000Z Investigated: parser-aware help is the smallest safe
  fix because it distinguishes top-level flags from values consumed by options.
- 2026-09-13T04:31:00.000Z Green: review-stamp integration suite passes 32/32;
  manual no-identity help smoke and TypeScript typecheck also pass.
- 2026-09-13T04:53:00.000Z Verification found: generated Claude and Codex plugin
  assets needed regeneration after the canonical helper changed.
- 2026-09-13T04:55:00.000Z Green: regenerated both plugin distributions with
  pinned Bun 1.3.14; the complete CLI contract check passes.
- 2026-09-13T04:57:00.000Z Verified: affected integration tests pass 32/32 and
  the three generated-plugin acceptance scenarios pass 3/3 (135/135 steps).
- 2026-09-13T05:30:28.000Z Verified: the complete CLI suite passes 9,595 tests
  across 578 files (57 skipped); the full acceptance lane passes 1,496
  scenarios and 68,731 steps (3 scenarios and 4 steps skipped), plus 45/45
  proof tests.
- 2026-09-13T05:30:28.000Z Verified: all builds and typechecks pass after
  materializing the lockfile-pinned optional website binding; Bun, Python, and
  Go dependency scans report no known vulnerabilities.
- 2026-09-13T14:10:34.506Z Complete: user confirmed the verified resolution;
  marked the ticket done.
- 2026-09-13T19:15:06.350Z Post-close review: re-assessed TDD/BDD quality and
  refactorability; focused integration remains 32/32 green. The quality-review
  coordinator exhausted all reviewer routes, so the required fallback completed
  a non-independent approval with one out-of-scope, non-blocking help-ordering
  edge documented in verify.md.
- 2026-09-13T19:53:19.000Z Independent quality review: corrected the review
  dispatch boundary and obtained real Claude coverage. The first pass found a
  non-discriminating proof around the one-shot Codex/Cursor identity bridge;
  added lifecycle coverage for both hosts and confirmed both tests fail under
  the proposed ordering mutation. Independent re-review approved the finished
  change with no release-blocking findings; focused integration passes 34/34.
