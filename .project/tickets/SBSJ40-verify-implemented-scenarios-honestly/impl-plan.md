# Retrospective scenario evidence implementation plan

Status: in progress

Current progress: the CKWE2D-only source gate validates authenticated eligibility
and proof reviews, checks cutoff and current blobs, and independently repeats a
passing and behavior-removal execution. The first scenario has approved reviews
and a successful source-gate replay. The installed stable 0.85.0 lacks this
command; no VERIFIED row has been edited. The source now has a bounded pre-close
replay command and a signed, content-bound close check. Remaining scenario
reviews, stable release, and final verification remain open.

## Done-gate timing decision

The first honest two-copy replay takes about 11 seconds. The OpenCode pre-tool
dispatcher allows 2 seconds, while a Codex Stop child allows 600 seconds; about
46 rows plus the normal test suite cannot reliably fit either budget. Increasing
timeouts only hides the scaling problem. Keep the expensive replay in a
deliberate, installed-CLI pre-close command that runs every checked VERIFIED row
and writes one authenticated, content-bound completion record only after all
replays pass. The host closing gate checks that record, current ledger, review
identities, and all proof inputs cheaply. Any changed or missing input denies
completion and requires a new pre-close run. Do not substitute a digest-only
check for either execution, and do not reuse a project-writable CLI as authority.

Premortem: a record could outlive a changed support input; bind the exact
declared input bytes and review fingerprints, and test that a one-byte change
invalidates it before accepting this design.

OpenCode also runs the ordinary bounded test command in its done edit path
through `evaluateDoneEvidence`. Its dispatcher now gives a closing edit 90
seconds, matching Cursor's 90-second done hook and leaving the normal test
check in place. A VERIFIED edit gets 30 seconds for its one fresh proof; other
OpenCode operations retain their 2-second guard. The close record covers only
retrospective replays and is invalidated by changed ledger, reviewed files,
support files, review jobs, opt-in, or unreachable historical commits.

## Receipt architecture decision

Use Safeword's existing integrity-protected review jobs for the two independent
review identities. A separate receipt store would duplicate key management,
reviewer provenance, and freshness checks. Add a narrow retrospective proof
review rubric, then make one shared verifier independently rerun the reviewed
request and compare its stable observations at edit and done. The reviewer's
approval alone never authenticates author-supplied execution output. Failure
mode to guard: a changed request or observation still appears approved; bind
their current bytes through the job fingerprint and reject a different rerun.

## Boundary

This is a one-ticket migration. `CKWE2D` is the only eligible ticket, and
`690536ec56c07c2b042108d9c31d28bc3bc82619` is its immutable pre-authorization
cutoff. A missing, stale, malformed, or non-independent receipt denies VERIFIED.
Normal RED/GREEN/REFACTOR evidence remains the default for every other ticket.
Existing checked rows, including the intermediate-symlink proof, are historical
and must not be rewritten.

## Build order

1. Add a shared retrospective evidence contract and negative tests. Parse a
   separate VERIFIED row without treating it as RED or GREEN. Reject every
   non-CKWE2D ticket before considering opt-in fields or receipts. Reject
   mismatched cutoffs, altered scenario bodies, and missing baseline blobs.
   Resolve the baseline as a commit, then use Git ancestry to require it be
   ancestor-or-equal to the fixed cutoff. A baseline reachable from HEAD but
   later than the cutoff must fail; timestamps never decide eligibility.
2. Add coordinator-issued eligibility receipts. Bind the ticket, ledger,
   cutoff, baseline, baseline blob digests, current-path mapping, rationale,
   eligible headings, and scenario-body digests. Require a separate independent
   review attesting historical implementation at the baseline. Both gates
   re-resolve every cited baseline path and blob against that exact commit.
3. Add coordinator-issued proof receipts. Execute an exact named-test argv on
   current code, then the same argv in an isolated copy with one reviewed
   behavior-removal mutation to an eligibility-named implementation file.
   Require the selected test to pass first and its own assertion to fail after
   mutation. Bind argv, cwd, ledger path, heading, named test and failing
   assertion identities, target and support bytes, mutation digest, execution
   observations, scenario bytes, and both reviewer identities. The proof
   reviewer judges actor-facing Given/When/Then coverage, the specific
   behavior removal, and whether the declared files include every input that
   could flip the result.
4. Give Claude, Codex, Cursor, and OpenCode edit and done gates one shared
   verifier. At edit time validate the proposed VERIFIED transition and both
   current receipt identities. At done time repeat the selected passing and
   mutated executions in isolation. Report retrospective completion distinctly.
   Preserve the feature-level refactor and quality-review requirements. Test
   both partially checked historical R/G/R rows and ordinary GREEN edits
   without a failing RED receipt as negative regressions.
5. Opt CKWE2D in with its explicit baseline, blob map, and RED-unavailability
   explanation. Obtain independent eligibility and per-scenario proof reviews;
   mark rows VERIFIED one at a time only after each gate accepts its receipt.
   One independently reviewed eligibility receipt may name a set of headings;
   each VERIFIED row still requires its own independently reviewed passing and
   mutation proof. The current ledger has roughly 46 outstanding rows.
6. Run targeted, BDD, generated-surface, lint, type, and final full-suite gates.
   Keep CKWE2D in `implement` until every scenario and final gate passes.

## First vertical proof

Start with “A nested project uses its committed generated marker.” The fixed
cutoff contains its unchanged feature body and `packages/cli/src/review/packet.ts`
blob `ddc5c2ed07a192ae73ee7440c9d6688e588ac061`. Its public-command proof
must select a named test and demonstrate a reviewer-visible failure when the
nested-project generated-marker behavior is removed. The first receipt proves
only that scenario; it cannot authorize another heading.

## Safety and recovery

Never fabricate an old failing RED run. Never accept a user-authored JSON file
as a coordinator receipt. Keep coordinator records integrity-protected and
content-bound; missing records or changed proof inputs fail closed. If the
cutoff is no longer reachable, stop the migration and request a newly
authorized cutoff instead of selecting one automatically.
