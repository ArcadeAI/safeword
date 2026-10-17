# Preserve proof commands and explain invalid reviews for contributors

Follow-up to #4200 from main `ca452a9cc`, reconciling only the remaining fixes
from #4789 and #4988. The dedupe audit was read from chat
`01a145df-9763-70e2-a6cd-297867193c90` before editing.

## Scope

- Accept repeated flags and empty or whitespace command operands in order.
- Preserve JSON backslashes while decoding Markdown table pipe escapes.
- Retain field-specific validator diagnostics through the reviewer subprocess.
- Keep malformed-input rejection, trusted-definition/digest binding, and readable
  denial tripwires intact.

No activation, approval, identity, schema, or dependency changes. Neither old
branch was merged. Generated plugin carriers must reflect the source repair.

## Root cause

Main uses `uniqueNonblankStrings` for argv, treating ordered arguments as a set.
The checklist parser separately rejects empty operands but accepts a whitespace
executable. Its table splitter consumes every backslash before `JSON.parse`.
The runtime replaces validator errors with a generic invalid-output error.

Ruled out stale activation wiring (already on main), reviewer transport as the
argument rejection cause (direct validator reproduces it), and JSON serialization
(the table splitter changes valid JSON before parsing).

## Inline tests

Repeated flags and empty operands preserve the trusted definition. Empty argv,
blank executable, non-string operands, unsafe cwd, extra invocation keys, and
duplicate receipt targets remain invalid. JSON escapes and escaped table pipes
round-trip. A real fake-reviewer subprocess retains the validator explanation.

## Evidence and limits

The first targeted run failed: 48 failed, 102 passed, 2 existing platform skips.
This includes the additive diagnostic assertions on existing rejection cases.
The same three files passed after the repair: 150 passed, 2 skipped.
Raw logs are retained in `evidence/red.log.gz` and `evidence/green.log.gz`.

Initial multi-hunk ticket edits were rejected by the host guard. A later single
exact hunk reconstructed safely, exposed the real missing intake-review gate,
and succeeded after a genuine independent review was verified and stamped.
The canonical task is now in verify. No guard was bypassed.

Historical #4200 failures, unfinished cases, and deferred acceptance remain
unchanged. This patch does not certify the full initiative or either old PR.

**Current authorization:** the later user request explicitly adds Verify, Audit,
Refactor, Quality Review, green CI and admin merge of PR #5897. The earlier
Draft-only restriction is superseded. Final results belong in verify.md.

## Authorized test-quality follow-up

The user subsequently requested the assessment's suggested improvements and
explicitly invoked figure-it-out. The decision, acceptance boundaries, actual
mutation checks, R/G/R results, independent review responses and retained live
failures are recorded in test-improvement-decision.md and test-improvements.md.
The additional production changes are checklist response labels and precise
repair diagnostics exposed by those CLI tests. Production review policy,
conformance corpus, admission evidence and dependencies remain unchanged.
