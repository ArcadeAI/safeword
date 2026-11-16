# Rethink: disputed findings

Status: investigation, not an approved replacement plan. The existing draft and
review receipts remain historical evidence. The accepted scenarios and scope
are unchanged.

## Decision to investigate

How can an ordinary two-agent installation handle a disputed finding and recover
after a cloud run without inventing approval, requiring a new service, or making
users manage review infrastructure?

## Candidate approaches

1. **Current draft:** Require an adjudicator distinct from both author and
   originating reviewer; publish the ticket to a confirmed remote branch.
   Strong separation, but a default two-agent installation has no eligible
   adjudicator and a ticket alone cannot authenticate a review in a new runtime.
2. **Fresh independent process, with honest provenance:** A fresh reviewer
   process distinct from the originating review considers only the finding,
   accepted contract and evidence. Permit the author's agent family only if the
   resulting independence is recorded truthfully; never call same-agent or
   author-context review cross-agent independence. If the accepted contract's
   independent-route requirement cannot be met, return unresolved rather than
   substitute this result. This option must establish whether a fresh process
   from the author's family qualifies as an independent route under R2/R5 and
   the user's explicit request; it cannot silently redefine independence. First
   examine the existing coordinator's fresh-context and self-review continuation
   paths, which report no independence, rather than adding a duplicate mechanism.
3. **User-owned scope and portable pending record, fresh review on recovery:**
   Route scope to the user and currency to current provenance as already
   accepted. Preserve the pending finding and its context in the ticket and
   use the host's existing work handoff. On a fresh runtime, treat the record as
   a request to resume, not as authenticated review or approval; reacquire a
   current authenticated review before any authority is granted. This avoids
   exporting the private integrity key but must prove the scenario's requirement
   to recover the *same* pending disposition, not merely restart the task.

## Evidence and failure boundaries

`packages/cli/src/review/job.ts` authenticates jobs with an HMAC key under the
user's state directory and binds the tag to the resolved working-directory path.
A copied job or ticket is therefore not automatically verifiable in a fresh
runtime or a different checkout. The key must not be committed or exposed to
make a ticket portable. [NIST explains that a MAC requires a secret shared by
the origin and verifier](https://csrc.nist.gov/projects/message-authentication-codes).

The repository ticket is canonical and tracker sync is optional and one-way.
Cloud workspace writes alone do not establish survival after reclaim; a host
handoff must actually preserve the relevant ticket and plan. GitHub's
[Codespaces lifecycle](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle)
is an example of this boundary, not proof of behavior on Claude or Cursor.

## Comparison and next proof

Candidate 1 preserves a strong trust boundary but is costly for default users
and does not yet deliver cloud recovery. Candidate 2 improves availability but
is invalid if it labels an interested party's review independent. Candidate 3
is the smallest candidate to investigate because it separates portable pending
state from authority, but needs evidence that the same decision is recoverable
and that the user sees one action, not an unexplained review restart.

First map the exact required information and trust level for a later session to
display the same pending finding, then test whether a fresh authenticated review
can restore only the authority needed to resolve it. Separately test the default
two-agent route against the accepted independence rule. No terminal result,
approval, host support or scenario pass is claimed by this investigation.

## Local trial — 2026-11-14

The existing planning-review fallback integration tests distinguish two states:
the sealed fresh-context continuation initially reports `independence: none`;
after the author-family continuation completes, its planning receipt reports
`reduced`, not `cross-agent`. Under the tested prefer policy it can satisfy the
existing planning approval workflow, but that is not proof it satisfies this
child's independently adjudicated correctness dispute. The child has no
implemented dispute router to exercise yet.

The existing headless design-approval test returns pending without prompting,
leaves the ticket in Implementation Planning, and records a pending log entry.
This covers design approval in a temporary local project, not a disputed finding
or recovery after cloud runner reclamation. The current review-disposition
command's no-input branch returns pending without writing a disposition.

The three existing integration files for planning fallback, route outcomes and
design approval passed: 66 tests. They use simulated reviewers and local test
projects. No live Claude or Cursor cloud reclaim-and-resume run was performed;
the accepted cloud scenario and all 33 historical deferred cases remain
unverified. Source inspection shows the job HMAC is bound to both a local key
and the resolved checkout path, so merely copying ticket and job bytes cannot
establish authenticated review authority in a different fresh environment.
