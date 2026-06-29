---
id: SPNZKM
slug: retro-egress-hardening
type: task
phase: implement
status: in_progress
parent: RV9JT4-retro-transcript-mining
scope: |
  Durable follow-ups from the PR #543 egress review (the immediate Critical —
  hyphenated provider keys / Bearer / assignment literals / relative customer
  paths — was fixed inline in commit 859c5fb). Two items here:
    1. Adopt `@secretlint/core` rule-packs behind the existing `scrubSecrets`
       seam (detect-mode over a raw string → redact reported spans). The
       maintained rule pack tracks new key formats, replacing the hand-rolled
       regex set as the durable secret-coverage source. Confirm it can scan a
       string (not just files) and return spans — the open question RV9JT4 flagged.
    2. Cover the GitHub WRITE path: createIssue/createComment POST/PATCH are
       currently unasserted because the test transport's fetch mock discards the
       init arg — an auth-header or method drop would ship green. Add a wiring
       test that asserts method, path, auth header, and JSON body on the real
       fetch init.
out_of_scope: |
  - The inline regex fix already shipped (859c5fb) — this replaces it with
    secretlint, not re-does it.
  - A blanket high-entropy/hex catch-all (rejected inline: over-redacts git SHAs);
    secretlint's targeted rules are the better answer.
done_when: |
  - scrubSecrets is backed by @secretlint/core rule-packs (or the regex set is
    kept only as a documented fallback), with the modern provider formats covered
    by the library, proven by the existing leak-regression tests staying green.
  - A test asserts the GitHub write requests carry the right method + auth header
    + JSON body (the mock no longer discards the fetch init arg).
created: 2026-06-29T01:05:04.643Z
last_modified: 2026-06-29T01:05:04.643Z
---

# Durable egress hardening: secretlint rule-packs + GitHub write-path test

**Goal:** Replace retro's hand-rolled secret regex with maintained `@secretlint`
rule-packs, and close the untested GitHub write path — the two durable follow-ups
from the PR #543 egress review.

**Why:** A hand-rolled regex set will always lag new key formats (the #543
Critical was exactly that lag); a maintained rule-pack tracks them. And an
auth-header/method drop on the write path currently ships green.

## Work Log

- 2026-06-29T01:05:04.643Z Started: Created ticket SPNZKM
- 2026-06-29T01:05Z Scoped from the PR #543 review fast-follow. The immediate
  Critical (modern key formats + relative paths + honest LLM-pass comment) was
  fixed inline in 859c5fb; this ticket carries the durable secretlint adoption +
  the write-path test.
- 2026-06-29T02:35Z Riskiest-assumption spike PROVEN: `@secretlint/core`
  `lintSource` scans a raw string and returns secret spans (`range:[start,end]`).
  Config shape that works: `{ rules: [{ id: '<preset>', rule: creator }] }` — core
  expands `creator.rules` into its 28 scanners. Key finding that shaped the design:
  secretlint is PRECISE, not broad — the anthropic rule needs the exact 108-char
  `sk-ant-api0[34]-` shape, and the AWS rule SKIPS `AKIA…` access-key ids unless
  `enableIDScanRule` is set (off by default). So secretlint MISSES truncated keys
  and bare `AKIA…` that the hand-rolled regex catches.
- 2026-06-29T02:37Z Implemented as LAYERED, not replacement: `redactKnownSecrets`
  (async secretlint pass, fail-OPEN to input) + `sanitizeTextDeep` =
  `sanitizeText(await redactKnownSecrets(text))`. The regex set stays as the broad
  over-redaction floor AND the fail-open fallback. `prepareEncounters` is now async.
  Both `done_when` met: (1) secretlint backs the secret-coverage with the regex set
  kept as documented floor, modern formats (anthropic/sendgrid/linear) covered &
  tested, all leak-regression tests green; (2) write-path tests assert method +
  auth header + JSON body on createIssue/createComment/updateComment.
  Verify: retro suite 74/74 pass; eslint clean on changed files; typecheck adds 0
  errors (10 pre-existing `.safeword`-mirror rootDir errors are on origin/main too);
  build + runtime dep-resolution confirmed. `@secretlint/*` documented in
  ARCHITECTURE.md (dep-drift).
