# Host-owned cross-agent adversarial review coordinator

**Status:** Accepted
**Date:** 2026-08-02

The host-owned coordinator snapshots bounded inputs, launches eligible local reviewers with structured arguments, and records the actual outcome. A neutral workspace gives reviewers the same immutable coordinator packet. Host-native delegation alone could not select the opposite agent deterministically. Direct provider calls would add credential handling to Safeword.

**Superseded in part by the 2026-09-20 planning fallback decision.** [Authenticated continuation](authenticated-reduced-independence-planning-review-fallback.md) can finish a sealed planning review. [Current routing policy](independent-review-never-blocks.md) defines eligibility and reduced independence.

**Bounded large-lockfile review (2026-10-18).** Oversized existing `bun.lock`
quality-review targets keep their original logical path and carry a complete Git
patch with explicit baseline and full-source identity. The serialized view must
fit the existing 256 KiB file and 1 MiB packet budgets; source and baseline each
have a separate 8 MiB capture bound. Generated exclusions retain priority.
Full source, baseline and patch receive the usual credential and UTF-8 checks.
The first available remote default reference, then local main/master, supplies
the merge-base; an unusable selected reference fails closed. Checkout refs and
the host Git executable remain trusted inputs.

Private, isolated Git operations produce the patch and must reconstruct the
exact captured bytes and executable mode from the displayed patch before review.
Temporary full-byte files are removed after capture. Signed job identity binds
representation metadata under a separate fingerprint domain; later source,
snapshot or resolved-baseline drift invalidates approval. Legacy full-text
fingerprints remain unchanged. The reviewer sees the representation explicitly
and requests more context when needed. Packet capture owns projection and
freshness; the job layer owns signed identity, without a new persistence store.

The whole-file cap would otherwise prevent review of routine release changes to existing lockfiles.
Increasing global limits would spend review input on unchanged dependency graphs;
generated annotations would hide meaningful resolution changes. Complete bounded
patches preserve review coverage at the cost of a Git baseline and reconstruction
step. New, deleted, renamed or unchanged oversized locks remain unsupported.
Ticket `319VCW` records the regression and adversarial boundary proofs.

**OpenCode extension (2026-09-01, superseded in part 2026-09-02).** The coordinator's
default remains the three-runtime route plan: Claude-authored work prefers Codex, Codex-authored
work prefers Claude, and either may use OpenCode as the next independent route
before reduced-independence review. OpenCode-authored work prefers Claude and
then Codex; its own fallback remains explicitly non-independent. The OpenCode
adapter uses the trusted executable boundary, stdin prompt, completed JSON text
events, `--pure`, deny-all permissions, shared deadlines, closed provenance,
and post-run integrity checks.

**Ranked local routes (2026-09-02).** `crossAgentReviewRoutes[author]` can replace
that default with one exact ordered list of reviewer and optional model pairs.
For each author, a project entry in
`.safeword/config.json` replaces the user entry in the Safeword profile config,
which replaces the built-in route plan. Lists are indivisible and never merged.
Effective reads validate both scopes, while set/reset operations read and write
only their selected scope so damage in one file cannot block repair of the other.
The coordinator derives independence from reviewer versus author identity,
never from position, and cached status observations are descriptive only.
After a runtime-wide failure, the coordinator skips later models on that runtime. A failure specific to an attempt leaves later models on that runtime eligible. Exact runtime/model (or explicit runtime-default)
identity binds durable proof. Reassess this design when a fourth concrete
review runtime is requested or OpenCode changes this stable-1.x contract.

**Executable RED attestation extension (2026-09-06).** The `executable-red` kind extends the same
durable job and review routes. Its integrity-sealed request contains exact JSON argv, a
project-contained cwd, evidence class, literal failure matcher, timeout, and declared proof inputs.
The trusted worker executes once without a shell, hashes complete stdout/stderr while retaining
bounded excerpts, and gives every reviewer route the same attestation. Reviewers may approve only
an intended missing-behavior failure at the actor boundary; syntax, import, fixture, configuration,
infrastructure, unrelated assertions, timeouts, signals, pasted output, and stale inputs remain
unapproved. Scenario and project-relative ledger identity are part of the request. Identical fresh
approved proof identities can reuse one receipt. The public receipt gate recomputes the current
declared-input fingerprint and accepts only an integrity-valid cross-agent approval for that exact
scenario and ledger; the shared pre-tool hook invokes it at the
actual `[ ] GREEN` to `[x] GREEN` ledger transition for Claude Code, Codex, OpenCode, and Cursor.
Direct CLI integrations call the same gate. Missing, stale, incomplete, mismatched, fabricated, or
non-independent evidence therefore cannot earn GREEN credit.
Proof commands run with the current user’s privileges and no OS security sandbox. The
worker removes internal review variables from their environment, terminates remaining descendants,
and invalidates preemptively completed jobs; hostile-code isolation would be a separate design.
