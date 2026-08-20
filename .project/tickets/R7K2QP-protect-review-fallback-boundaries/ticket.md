---
id: R7K2QP
slug: protect-review-fallback-boundaries
type: task
created: 2026-08-09T08:39:54.000Z
last_modified: 2026-08-20T14:31:00.000Z
---

# Protect review fallback boundaries for builders

## Goal

Harden host-continuation envelopes and recovery-command construction without
coupling those protocol changes to review-coverage vocabulary.

## Jobs to be done

- When a host provides supplemental review feedback, accept only a bounded,
  closed result shape so untrusted prose cannot forge completion or provenance.
- When Safeword offers a recovery command, preserve argv boundaries across
  supported shells without interpreting untrusted targets as code or options.
- When a continuation runs, admit it only after typed route exhaustion and keep
  retry/self-review bounds explicit.

## Candidate scenarios

- Closed host-envelope schema, contradictory verdicts, malformed findings, and
  size boundaries.
- Typed/own-property reviewer identity and continuation-admission boundaries.
- Structured recovery argv, POSIX and PowerShell rendering, path/control
  rejection, and metacharacter round trips.

## Out of scope

- Standard/independent/supplemental vocabulary.
- Default versus requested-details placement.
- Claims that static host instructions prove live model behavior.
