# Bounded CI-backed execution provenance — proposed design

User authorized design and ordinary bounded review-and-repair cycles. No
workflow edit, CI dispatch, implementation, installation or qualification is authorized or claimed.
This replaces the insufficient shared-local-signer proposal, not the accepted
EP9-only boundary or its independent semantic review requirement.

## Smallest credible trust boundary

Use GitHub Actions infrastructure already used by this repository, with a
separately reviewed workflow at an immutable trusted revision. Candidate code
must not choose the workflow revision, proof commands, accepted report schema,
profile or signing policy. An ordinary PR green check does not qualify.

The existing release workflow separates unprivileged build work from privileged
publishing. Reuse that principle; do not modify the release workflow or create
a new signing service. Current ci.yml does not yet implement this proof contract.

### Execution job

1. Receive one full candidate commit SHA and the fixed EP9 profile identifier.
   Resolve the commit in the expected repository and verify exact tree/profile/
   feature/map/harness inputs against the accepted profile before execution.
2. Load the observer/controller and toolchain definition from the trusted workflow
   revision, not from candidate scripts. Pin action/tool identities during actual
   implementation; versions and runner availability must be checked then.
3. Run candidate code in a credential-free isolated process boundary. Proposed
   implementation uses a nonprivileged container controlled by the trusted host
   runner: no host Docker socket, signing/OIDC/artifact credentials, runner home,
   trusted-controller files or host-process access inside the container. Keep
   dependency preparation isolated too; candidate install scripts are code.
4. The trusted controller launches the fixed ordinary lane plus named EP9 proof
   commands, captures actual process exits/timeouts and report bytes, and builds
   the normalized observation outside the candidate's writable paths. Refuse
   missing, duplicated or unexpected proof bindings and incomplete commands.
5. Return an observation artifact. Failure produces retained diagnostic evidence,
   not a successful observation. Candidate stdout or JSON alone cannot assert
   that a command ran; trusted process observations supply that claim.

The report says which commands actually executed. Candidate tests remain code
requiring independent coverage review: a test that always passes is not made
meaningful by execution attestation. The boundary must prevent candidate escape
into controller/signing context; do not equate an ordinary same-user shell step
with this isolation. Implementation feasibility must be proven before adoption.

### Separate signing job

Run on a fresh runner with no candidate checkout or executable candidate data.
Give attestation permissions only to this job. It uses pinned trusted parser/
attestation tooling, treats report content as data, and identifies the exact
upstream execution job/run attempt and its artifact digest through trusted
workflow outputs and GitHub run metadata, not report-supplied identifiers alone.

Sign only a complete normalized observation from that trusted execution path.
Reject arbitrary uploaded reports even when their fields look correct. Bind:
repository identity, candidate SHA/tree, workflow identity and immutable revision,
run ID and attempt, fixed profile/harness digests, each command's actual outcome,
complete binding inventory and normalized report digest. Do not attest a claim
that all behavior is correct; that remains the independent review's judgment.

### Local import, review and closing

Download the observation, attestation bundle and required trust metadata in an
explicit preparation step, never in a two-second closing hook. The installed
trusted verifier checks signature, artifact digest, repository identity, expected
signer workflow/revision, source candidate and fixed profile/report contents.
Verify any numeric repository identity needed to avoid name-reuse ambiguity;
do not rely on an offline repository-name comparison alone.

Then obtain fresh qualified independent semantic coverage review over those
exact observation bytes and candidate inputs. Bind current credit to BOTH the
verified execution provenance and the authenticated review. A fresh review of
candidate-invented execution must refuse because the CI provenance is absent.

Closing stays offline and bounded: re-verify external attestation and checkpoint
signatures plus all bindings against trust roots and immutable workflow SHA
embedded in the trusted installed verifier. Candidate-supplied roots/pins and
local HMAC validation flags confer no authority. Cached report/bundle bytes are
untrusted inputs and must pass cryptographic verification at closing. Do not
substitute a mutable validation cache. If this cannot meet the host deadline,
adoption blocks pending an explicit design decision; no cache bypass is allowed.

Trust the installed verifier and embedded public roots/pins, as this repository's
existing local enforcement does. OS-level replacement of that installation is
excluded, not advertised as prevented. This does not trust candidate-written
evidence or the operator's local HMAC signing helper. A separately reviewed
installation update may change a pin; candidate metadata, branch movement,
gh push credentials and dispatch inputs cannot change the embedded accepted SHA.
Match verified signer certificate identity/revision, not predicate fields alone.

A later known failed attempt or removed/changed locally bound evidence revokes
credit. Offline closing cannot discover an unseen remote run; do not claim it
can. Require explicit synchronization before final completion and describe this
freshness limit. Never erase superseded, failed or interrupted attempts.

## Discriminating proof plan

- Actual execution plus valid attestation and independent review admits only EP9.
- A fabricated report with a fresh review but no valid trusted-workflow execution
  attestation refuses; a locally valid shared-key signature cannot substitute.
- Wrong workflow/revision/repository/candidate/profile/digest or run attempt,
  partial execution, forged artifact and arbitrary-upload signing all refuse.
- Candidate attempts to read signing credentials or change the controller cannot
  affect the signed claim. Missing isolation is a failed design prerequisite.
- Missing/expired trust inputs, altered cache or incomplete import refuse locally;
  unchanged valid imported proof remains within the existing closing deadline.
- T0FK4H's old eligibility and receipts cannot become EP9 credit. Genuine history,
  missing RED, ordinary prerequisites, installed-host walkthrough obligations,
  sibling/parent statuses and all 33 deferred cases remain unchanged.

Start with offline parser/policy fixtures and isolated synthetic forgery controls.
No CI run or paid review occurs until separately authorized. This prerequisite
must follow ordinary prospective RED/review rules and cannot certify itself.

## Tradeoff and next decision

### Current attempt and closing freshness

Use the latest execution-mode run and latest attempt for the exact candidate, fixed
workflow revision and profile, ordered by CI-service metadata. Trusted workflow
structure separates execution-mode and checkpoint-mode jobs; a caller cannot
relabel an arbitrary checkpoint as execution. Checkpoint runs never participate
in execution ordering. A newer pending,
failed or interrupted attempt blocks an older pass. An explicit successful
retry can become current only with a new observation-bound review and checkpoint;
all prior failures remain retained. No silent retry-until-green campaign.

The same trusted CI signer supplies a lightweight completion-checkpoint mode:
query latest execution state without running candidate code and sign candidate,
profile, workflow identity/revision, execution run/attempt, observation digest,
query timestamp and expiry. Expiry is five minutes after query time. Local
closing validates its signature/bindings and age, not a local HMAC timestamp.
Compare query/expiry to verified attestation timestamp and the verifier's local
UTC clock. Reject a query timestamp later than its verified signing timestamp,
a local time earlier than that signing timestamp, or local time past expiry;
do not extend expiry for skew/rollback. Five minutes remains a proposed ceiling:
measure post-sign artifact download/import/verification latency in the authorized
live proof before adopting it. Queueing before signing does not consume the
post-query window; if actual query-to-close latency fails, return for a design
decision instead of promising a usable window or enlarging it silently.

Only one trusted workflow SHA is installed per profile. A revision change
invalidates that profile's observations/reviews/checkpoints and requires renewed
review and proof. Retain older-revision failures as history; do not rank them
against a new revision or borrow their passes to qualify it.

Request this checkpoint after independent review, so a slow review does not
force full test reexecution. Renewal queries/re-attests state only; it grants
neither missing execution nor review. Offline closing guarantees a remote check
within five minutes, not awareness of unseen events during that interval.

The first live isolation boundary must test candidate access to runner-held
GITHUB_TOKEN, ACTIONS_RUNTIME_TOKEN and OIDC/artifact credentials, as well as
report replacement between execution and signing jobs. Local Docker controls
are preliminary, not proof of GitHub-specific credentials or artifact origin.

This adds a CI provenance producer/import adapter, not just one extra profile.
It avoids inventing a local privileged service, but adds workflow maintenance,
artifact/trust-data preparation and explicit online synchronization. No claim is
made about GitHub plan availability, run cost or exact execution time yet.
Confirm repository attestation support and the isolated runner feasibility
read-only before implementation planning; no paid model call is needed for that.

Read-only availability check: gh repo view reports ArcadeAI/safeword as PUBLIC.
GitHub documents artifact attestations as available for public repositories on
all current plans. This removes the private-repository Enterprise-plan concern;
it does not prove container isolation, workflow correctness or operational cost.
Source: https://docs.github.com/en/code-security/getting-started/github-security-features

Premortem: a signer could attest candidate-written bytes without trusted execution.
Make arbitrary-upload refusal and the credential/controller isolation proof the
first acceptance boundary; do not ship a signature-only solution.

## Primary sources

- GitHub CLI verification guidance distinguishes immutable certificate identity
  from workflow-controlled predicate metadata and recommends trusted builders:
  https://cli.github.com/manual/gh_attestation_verify
- Attestation workflow identity, source digest and offline bundle verification:
  https://docs.github.com/en/actions/concepts/security/artifact-attestations
  https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline

These sources establish available mechanisms, not that this repository already
has a qualified implementation. All statements above are proposed requirements.
