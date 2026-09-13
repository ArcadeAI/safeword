---
id: 07BW3N
slug: review-stamp-helper-help
type: task
phase: verify
status: in_progress
created: 2026-09-13T04:15:52.685Z
last_modified: 2026-09-13T04:15:52.685Z
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
