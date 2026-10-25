# Impl Plan: Observe trustworthy current proof for contributors

**Status:** planned
**Planned on:** 2026-10-23

## Approach

The public CLI calls a separate bounded-observation module: shipped contract → clean committed source snapshot → isolated detached clone → fixed local proof runner → exact assertion reconciliation → authenticated external attempt store. Verification reads that store and recomputes current input identities. Neither path calls review admission, certification, ticket transitions or closing gates.

The riskiest assumption is that the existing delivery assertions can be identified completely, including parameter rows, without equating a passing file with a proved case. The cheapest proving slice is the complete-proof scenario paired with its missing-required-assertion control: run the real fixed lane on a committed fixture and reconcile all required identities. Negative integration controls rename, skip or fail required assertions in committed fixture source so the unchanged real runner produces the report. Pure grader fixtures are supporting unit proof; no production report or command override is introduced. Mapping evidence is subordinate [source assessment](evidence/design-investigation.md); unsupported mappings remain named refusals, never invented assertions.

The load-bearing positive proof must also run the shipped profile through the actual CLI against the actual clean committed Safeword repository candidate, requiring a successful observation and exact-once required results for all 37 real delivery cases, followed by successful verification. Fixture tuples cannot substitute for this run. It is a standalone verification-lane operation outside Vitest, after the contribution is committed and all enclosing test processes have exited; retain its complete artifacts and candidate identities. This proves real profile/runner/dependency/tool wiring for that candidate and local platform, not semantic certification or other-host qualification. The earlier characterization cannot satisfy this new obligation.

No observer integration proof may launch a real Vitest child from a Vitest parent. Real-run observer scenarios use Cucumber or a standalone Node harness as the parent and run sequentially; pure validators can use a separate Vitest unit run. The existing global lock serializes the single actual Vitest execution, with no override, nested acquisition or second Vitest process. Ordinary Vitest regression runs finish before the standalone actual-repository observation. Committed fixture controls remain useful for refusals and interruption, but their success is not the real-repository success proof.

| Accepted scenario                                     | Primary proof and real boundary                                                                                                       | Confidence limit and supporting proof                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fixed proof set and original inputs unchanged         | Integration: public observation CLI, real shipped profile, Git, clone, runner and store; compare original product bytes before/after  | Does not certify assertion semantics; unit profile exact-set controls                                  |
| Caller substitutes a command                          | Integration: actual CLI parser rejects extra operands/options before runner starts                                                    | Also cover unknown and known-wrong ticket inputs; unit closed-request matrix                           |
| Dirty execution configuration                         | Integration: real committed repository plus dirty config refuses before launch                                                        | Dense dirty/untracked/ignored-input variants use source-identity matrix                                |
| Candidate advances during the run                     | Integration: real CLI subprocess paused at controlled child-process boundary, original HEAD advances, final publication refuses       | Compare original and clone inputs separately; unit changed-input matrix                                |
| Complete proof produces verifiable evidence           | Integration: real CLI, fixed runner, complete raw report, private signer/store, then public verification CLI                          | This is wiring proof for both new leaves; no live reviewer or semantic certificate                     |
| Unmapped delivery case                                | Integration: installed observer distribution with a deliberately invalid shipped profile refuses before execution                     | A project-edited mapping cannot construct this condition or shrink authority; unit exact-set oracle    |
| Required assertion absent, skipped or failed          | Integration: real CLI/report parser/store and unchanged runner over committed fixture assertion changes, one result per outline row  | Unit duplicate, ambiguous, unknown, parameter-row and malformed-report matrices                        |
| Runner fails after passing assertions                 | Integration: real child process emits complete report then exits nonzero; CLI refuses                                                 | Unit signal, timeout, absent/truncated output and unhandled-error variants                             |
| Saved report altered                                  | Integration: mutate stored report bytes then call real verification CLI                                                               | Unit signature, purpose, schema, root, ID and artifact-digest negatives                                |
| Retry preserves failed attempt                        | Integration: real process interruption leaves a nonempty diagnostic; retry creates a new attempt and old bytes remain readable        | Fault injection at file/process boundaries covers incomplete publication; no internal success shortcut |
| Meaningful changes stale; audit-only changes do not   | Integration: paired committed source/scope changes and Work Log/non-input audit writes through real verification                      | Unit all retained/omitted ticket fields and loaded-input override controls                             |
| Observation grants no historical/completion authority | Integration: public success and refusal results plus before/after original scopes, ledgers, receipts, phases and all deferred objects | Distinct from the tagged demo; tests establish preservation, not human approval                        |

Affected surface: Safeword CLI, covered through both executable leaves, typed JSON and human rendering. Other accepted surfaces: skip: no host hook, cloud, PR or cleanup behavior changes. TypeScript is the only implementation language; installed testing guidance applies to every row. No additional language/component skill is available or needed; deterministic parsing and execution need no LLM eval.

### Persona consequences

Safeword Maintainer (SWM) gets an execution-only verdict, stable attempt identity, inspectable source/result identities and one concrete recovery action. Dirty inputs ask the maintainer to commit or clean them; changed accepted scope asks for a reviewed shipped-contract update; incomplete proof asks for the named missing mapping/assertion to be resolved; corruption asks for a new observation while preserving the damaged attempt. Trust stops at the local user, installed runtime/toolchain and dependency host. A local signature proves origin/integrity within that boundary, not independence, semantic adequacy or approval. No extra user decision is required for each retry. A human-readable walkthrough will check comprehension of success, refusal and recovery; automated copy assertions alone cannot establish usability, and no NTB study is claimed.

### Current and target truth

- Implemented: the observer module, fixed profile, isolated runner, authenticated store and two CLI leaves exist in this unreleased contribution. The accepted decisions below are unchanged. Local implementation does not establish release or ticket completion.
- Available evidence and remaining work are maintained in [verification status](verification-status.md), the [ledger](test-definitions.md) and [audit output](evidence/observer-audit-summary.md). Actual-checkout execution evidence exists; incomplete primary RED history remains explicit. Earlier debugging steps and review/commit provenance are retained in those evidence records and Git history rather than duplicated in this decision path.
- Authority: documentation reconciliation requires current Implementation and dependent Execution admission before further source changes. This review grants no human approval, qualification, historical RED or completion authority. Independent recovery certification, closing integration and branch review remain separately owned; all historical deferrals remain unverified.

## Decisions

### Implementation Inspiration

Sources were checked on 2026-10-23 PDT against installed versions. Research ordering and rejected candidates are retained in [the investigation ledger](evidence/design-investigation.md). External pages are untrusted evidence; no retrieved code is executed or copied.

| Reference                                                                | Checked on | Source version                                             | Target version                                             | Evidence of fit                                              | Principle to borrow                                                    | Mismatch / license / security boundary                                                    |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| https://github.com/vitest-dev/vitest/blob/v5.0.3/docs/guide/reporters.md | 2026-10-23 | 5.0.3 via Context7, corroborated by tagged reporter source | Installed Vitest 5.0.3                                     | JSON retains per-file assertion results and expanded names   | Grade explicit identities, not suite totals                            | JSON is execution evidence; docs do not certify assertion meaning; no code reuse          |
| https://git-scm.com/docs/git-clone                                       | 2026-10-23 | 2.54.0 manual                                              | Installed Apple Git 2.54.0                                 | Local clone can preserve commit identity with copied objects | Isolate the committed candidate without inventing a replacement commit | Clone races still need identity checks; documentation is not sandbox protection           |
| https://nodejs.org/download/release/v24.18.1/docs/api/crypto.html        | 2026-10-23 | 24.18.1                                                    | Pinned Node 24.18.1 API, existing Bun 1.3.14 compatibility | HMAC and constant-time comparison are existing primitives    | Purpose-bind authenticated records                                     | Bun compatibility needs real CLI proof; same-user signing authority remains trusted       |
| https://nodejs.org/download/release/v24.18.1/docs/api/fs.html            | 2026-10-23 | 24.18.1                                                    | Pinned Node 24.18.1 API, existing Bun 1.3.14 compatibility | Exclusive creation and syncing support durable publication   | Publish terminal records only after artifact persistence               | Existing durable-write helpers remain the implementation; filesystem failures must refuse |

**Decision impact:** retained: a fixed exact-set oracle and separate attempt store are necessary; changed: prefer a detached clone over an archive because the lane contains Git-aware tests and must retain the actual commit identity.
**Decision informed:** Committed execution identity.

#### PlanEvidenceRecordV1

```json
{
  "schema_version": 1,
  "source_identity": "https://github.com/vitest-dev/vitest/blob/v5.0.3/docs/guide/reporters.md",
  "checked_version": "5.0.3",
  "source_version": "5.0.3",
  "target_version": "5.0.3",
  "supported_claim": "JSON reporter exposes named per-file assertion results; exact expanded identity must be validated against the shipped inventory.",
  "license_identifier": "none_declared",
  "attribution_notice": "none_declared",
  "redistribution_limit": "none_declared",
  "security_limit": "none_declared",
  "privacy_limit": "none_declared",
  "reuse_limit": "none_declared"
}
```

```json
{
  "schema_version": 1,
  "source_identity": "https://git-scm.com/docs/git-clone",
  "checked_version": "2.54.0",
  "source_version": "2.54.0",
  "target_version": "2.54.0",
  "supported_claim": "A local clone with copied objects can retain the original committed candidate in a detached checkout; concurrent source changes still require independent checks.",
  "license_identifier": "none_declared",
  "attribution_notice": "none_declared",
  "redistribution_limit": "none_declared",
  "security_limit": "none_declared",
  "privacy_limit": "none_declared",
  "reuse_limit": "none_declared"
}
```

```json
{
  "schema_version": 1,
  "source_identity": "https://nodejs.org/download/release/v24.18.1/docs/api/crypto.html",
  "checked_version": "24.18.1",
  "source_version": "24.18.1",
  "target_version": "24.18.1",
  "supported_claim": "HMAC authentication and constant-time tag comparison are available in the pinned Node API; compatibility proof uses the real Bun 1.3.14 source and native CLI observation/verification paths, with Node 24.18.1 for the unpacked npm path.",
  "license_identifier": "none_declared",
  "attribution_notice": "none_declared",
  "redistribution_limit": "none_declared",
  "security_limit": "none_declared",
  "privacy_limit": "none_declared",
  "reuse_limit": "none_declared"
}
```

```json
{
  "schema_version": 1,
  "source_identity": "https://nodejs.org/download/release/v24.18.1/docs/api/fs.html",
  "checked_version": "24.18.1",
  "source_version": "24.18.1",
  "target_version": "24.18.1",
  "supported_claim": "Exclusive creation and filesystem syncing support no-overwrite artifact publication; they do not replace fault tests on supported filesystems.",
  "license_identifier": "none_declared",
  "attribution_notice": "none_declared",
  "redistribution_limit": "none_declared",
  "security_limit": "none_declared",
  "privacy_limit": "none_declared",
  "reuse_limit": "none_declared"
}
```

These records describe limits declared in the retrieved API/reference material, not a license to redistribute upstream code. No source redistribution is proposed. Existing installed Vitest declares MIT; existing Node APIs and repository-owned helpers introduce no package dependency or copied implementation.

### Recorded Decisions

| Decision                        | Choice                                                                                                                                                                                               | Alternatives considered                                                                  | Rejected because                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed assertion contract        | Bundle a versioned runtime-owned T3E4NS profile, independent of project registration and runner output; exact 37-case IDs/digests map to exact file/full-name assertion identities and expanded rows | Trust project .bdd-proof.json; accept passing file totals                                | Project edits or empty tests could manufacture coverage; aggregate totals hide missing parameter rows. Evidence: tagged Vitest reference and current source/result assessment                                                                  |
| Committed execution identity    | Detached local clone with copied Git objects, fixed preparation and one serialized proof run; record original and isolated identities independently                                                  | Source-checkout execution; archive plus synthetic Git history                            | Checkout writes/races contaminate inputs; archive attributes can omit inputs and synthetic history changes identity. Evidence: Git clone manual and existing retrospective source                                                              |
| Attempt authority and lifecycle | Separate observer key and runtime-owned external append-only attempt store; HMAC purpose/root/profile-bound manifests, artifact digests and exclusive terminal publication                           | Reuse retrospective-close signer; project-local signed summaries; database/job framework | Reusing close authority crosses a forbidden boundary; local outputs dirty retries; a database adds no required capability. Evidence: pinned crypto/fs references and existing durable-write helpers                                            |
| CLI and currency                | Two dedicated proof leaves in existing typed CLI; shared feature-local source projection for execution/retry/verification; execution-only purpose in every outcome                                   | Extend review kinds/closing gates; compare whole ticket or exempt it                     | Gate integration is excluded; whole-ticket hashing stales audit updates, blanket exemption hides scope changes. Evidence: configured Typed CLI and Semantically Projected Planning Review architecture records plus paired freshness scenarios |

#### Fixed assertion contract

The shipped profile contains the T3E4NS feature identity, all compiled case digests, accepted semantic ticket projection, fixed local argv/file set, supported runner schema/version, exact assertion tuples including parameter rows, and allowed audit projections. It is bundled with the observer runtime; its version and content digest are authenticated. Project registration is cross-checked, never authoritative. Flat and nested proof-registration shapes normalize to the same declared pairs. No caller ticket, command, report, filter, profile override or success flag is accepted.

At admission and current verification, independently compile the committed T3E4NS feature and grade its case IDs and semantic digests as an exact set against the shipped profile. Missing, extra, duplicated or changed cases refuse; counts alone never suffice. The hand-authored accepted feature is the case-coverage oracle, not the runner results or a sibling generated profile. A profile missing both a case and its mapping therefore cannot report completeness. Recompute the independent oracle from current bound feature bytes, and require a reviewed contract update when accepted cases change.

The complete proposed [37-case assertion map](evidence/proposed-assertion-map.json) is subordinate decision-bearing evidence for this Implementation Plan review. It enumerates exact expanded tuples, both fallback declaration orders per outcome, metadata/corruption rows, and matching/wrong-model/stale-input controls. A single exact-route assertion supports the matching and mismatched-model cases because its expected route array checks both inclusion and exclusion; no labeling-only test substitutes for that boundary. Installed-copy corruption cases require the actual installed CLI assertions plus diagnostic controls. Every source digest is retained. The registration alone is insufficient. The plan-implementation coordinator reviews the mapping now as bounded context; implementation cannot rely on it without current approval covering both plan and mapping. Later contract changes return to this same design review, not Execution Plan approval. If any row cannot be supported, retain a named unsupported refusal; do not weaken behavior, alter old tests or invent passing proof. The intended 37-case inventory is maintained independently of runner output, with missing/forbidden/duplicate/unknown case IDs refused.

Success requires process exit zero, complete parseable report with success true, no suite failure or unhandled error, exact-once required assertion identities with passed outcomes and no required skip/todo. Run with retry disabled and no watch/filter/update mode; do not let a final retry hide a failed required execution. Unexpected failed or malformed results refuse; unrelated skipped assertions are retained separately, never credited. Retain raw output and test-source digests for later semantic review. Do not claim JSON authentication proves that an assertion body has useful semantics.

Run the original eleven mapped proof files plus their existing registration check. The ten assertion-source files in the proposed map are the minimum required-result subset; execution-upstream-planning-context remains in the fixed lane as supporting evidence, with no added claim that its dependent Execution currency is the three Implementation-currency cases. Profile reuse of one assertion across two cases is intentional; exact-once applies to its single report identity, not the number of cases citing it.

Integration controls use committed fixture source at the fixed paths, executed by the unmodified fixed runner, and real OS process/file faults. They introduce no observer-recognized command, report-path, environment or success override. Negative controls show inherited override options cannot change execution/report selection. The mid-run pause and interruption operate on the actual child process; report-shape discrimination can additionally use pure parser fixtures without claiming that proves CLI wiring.

The unmapped-case integration control builds a correctly authenticated disposable distribution from a profile intentionally missing one required mapping. That reaches the named unmapped-case refusal rather than only detecting tampering of an already authenticated profile. Neither project edits nor caller input can select this test distribution's contract at runtime.

Assertion-source digests in the proposed mapping record the reviewed baseline; they are not an immutable test-body admission allowlist. The fixed shipped contract owns the case identities, required file/full-name/parameter tuples and accepted scope. A committed source-body change with those identities and scope intact can produce a new execution-only observation, retaining its actual new source digests. It stales the old observation and follows the accepted R4 recovery action: observe the new committed candidate. Missing or changed required identities still refuse; scope or mapping changes still require a reviewed shipped-contract update. The observer cannot determine whether a same-named test body was weakened. That risk remains explicit evidence for later independent semantic certification; no source edit is hidden or receives historical credit. The agent must not modify or weaken existing delivery tests to make this implementation pass.

#### Committed execution identity

Admission fixes the current original HEAD, canonical root, all tracked product bytes and semantic boundary inputs, rejecting dirty or unexpected untracked product/configuration inputs. Expected ignored build/dependency outputs cannot override committed configuration; any actual loaded execution input remains bound. Clone locally with independent objects and detached candidate, disable clone hooks/submodule/network checkout behavior, reject unsupported external Git inputs. Validate clone HEAD and tracked bytes against the original candidate before preparation. Require already installed pinned dependencies in the original checkout; copy their complete normalized file tree into the clone and verify identical content before running the existing build-lock runner with the exact shipped file list. Bind root and workspace dependency trees, including resolved symlink targets; refuse targets outside the repository/dependency roots. The complete fixed lane includes local Codex plugin packaging tests: the installed Codex CLI is an explicit bound input used only for local plugin marketplace/add/list operations in each test's disposable profile. No Codex model execution, provider request, qualification or shared profile/cache replacement is allowed. Observation neither installs packages from a registry nor contacts a model service. Missing/mismatched prerequisites refuse with the appropriate pinned-tool or frozen-install recovery action. Matching the lock's package versions and retaining actual bytes does not independently establish registry provenance; the local dependency installation remains trusted.

Record resolved tool executable paths, versions and digests; installed runner/dependency identity; lock/manifests, launcher/build/test configuration, shipped profile/runtime and source digests. Run with a minimal declared environment, stripping inherited Node/Bun/test override options and provider credentials; use isolated test HOME/state and only trusted pinned/system tool paths. Record effective nonsecret environment, platform and preparation outcome. Compare original and copied dependency-file identities and loaded tool/config identities before/after execution. This is trusted local execution, not a hostile-code sandbox or reproducibility claim across platforms.

The shipped execution-tool inventory includes Node, Bun, Git, Codex, mise, tar, the script interpreter and shell utilities reached by the fixed runner, its selected tests and their helpers. Resolve each to a canonical executable or interpreter/script chain and bind its bytes and version when available; a system utility with no version operation uses its binary digest and platform identity. Include absolute system-path variants used by the fixtures, even when their PATH bypasses the controlled directory. The local Codex inventory binds its launcher and actual platform binary/package contents, not just a shim. Preflight refuses a missing tool before runner launch. Use a controlled tool directory with reviewed tool names plus the clone's fixed local dependency bins; newly required persistent executables return to contract review instead of inheriting ambient PATH. Temporary reviewer stubs derive from bound fixture source, not external reviewer inputs. Hash/recheck this complete persistent-tool inventory at start, finish and current verification. The Codex exception remains bound by the same identity/freshness policy. The network claim is narrowly that this operation invokes no registry install, model/provider request or qualification; it does not claim OS network isolation or prove third-party startup telemetry is silent.

Before success, original HEAD must equal its request-start commit even if a concurrent commit only changed bookkeeping. Original product/boundary/input projections must be unchanged and clean; clone HEAD, product and loaded-input identities must equal their pre-run identities. Build outputs live only in the clone. A real subprocess pause proves the original check is not accidentally performed on the detached clone. Any discrepancy prevents success; available artifacts remain retained.

#### Attempt authority and lifecycle

Use a separate feature-local signing helper and 32-byte private key with exclusive creation, directory mode 0700/file mode 0600, under the user's Safeword state directory, outside every bound checkout. Never modify or call retrospective-close signing authority. Namespace attempts by canonical-root digest and UUID; reject unsafe IDs, symlink components and cross-root access. No public key-root/store override or arbitrary report-path input. Test redirection exists only at the actual filesystem/process fixture boundary, never as a public shortcut.

Legal states are reserved → running → one terminal manifest: observed, refused or interrupted. Immutable authenticated start identity is persisted before preparation; append available stdout/stderr and stage diagnostics to that attempt's artifacts. A terminal manifest authenticates schema/purpose `bounded-delivery-observation:v1`, T3E4NS, root, attempt ID, profile/runtime, candidate, source/environment identities, command, timestamps, outcome, required results and exact raw artifact digests. Stable ordered serialization excludes only its tag. Use existing durable-file helpers for synced staging and exclusive no-overwrite terminal publication. A crash before start publication creates no verifiable observation; a crash afterward leaves incomplete evidence, never success. Terminal publication is the only success boundary.

Handled interruption records an interrupted manifest. Unhandled death leaves start/log artifacts readable and verification reports incomplete/interrupted with a diagnostic derived from the persisted stage and observed process liveness; it never promotes that state to observed. Retry always allocates a new ID and never edits an earlier attempt, including incomplete or corrupted records. Concurrent requests receive distinct IDs; the existing global test lock serializes actual Vitest processes. A repeated verification is read-only and idempotent. Lost success output is recovered by verifying its retained ID; repeated observation intentionally executes a new attempt. Filesystem-full, partial write, key failure and unsupported schema all refuse. Losing/replacing the key invalidates prior authentication; preserve records and run anew, with no re-signing or migration that invents provenance.

Do not infer running state from a PID alone. Without a terminal manifest report incomplete/unknown; a diagnostic can report a live worker only when PID and process-start identity match. Liveness never establishes successful evidence.

#### CLI and currency

Expose `safeword proof observe-bounded-delivery` and `safeword proof verify-bounded-delivery <attempt-id>`. Both use the existing catalog/result/rendering/discovery machinery with JSON/no-input support. The caller is the trusted local checkout owner; resource scope is the current canonical Safeword repository and its own root-bound attempt. Observe declares local filesystem/process effects and no network; offline operation is supported with installed prerequisites. Verify has no network or mutation. Existing commands and review kinds remain unchanged.

An observed/current result uses the healthy typed envelope with domain status observed and explicit execution-only purpose; failures use stable observation-specific codes with one concrete recovery action and an attempt reference when one exists. Distinguish invalid request/scope, dirty source, unsupported mapping, preparation/runner failure, incomplete assertions, integrity failure, stale inputs and incomplete attempt. Human rendering leads with the consequence and one next action. Retained bytes remain readable by the owner even when authentication/currency refuses. There is no certification, completion, approval or RED field that another gate can consume.

The source-identity integration matrix also enters through the actual observation CLI with a committed accepted-scope edit: no runner starts and the result requests review of an updated shipped contract, rather than commit/clean or rerunning the old contract. Refused/interrupted history matrices assert the execution-only label and a nonempty diagnostic as well as unchanged files.

After execution, current verification compares content projections rather than requiring the old commit SHA: an equivalent-content commit can remain current. Default bind the entire tracked product tree. The explicit audit exception list is limited to the owning T3E4NS and observer tickets' Work Log and bookkeeping fields (phase, status and timestamps), plus a named observer audit-summary output under this ticket. In both tickets bind ID, slug, type, scope, out_of_scope, done_when, parent/job/milestone, phase anchors and every other frontmatter field; bind all body text except the Work Log. Reject malformed/duplicate keys. Any listed output actually loaded by execution is byte-bound instead of exempt. Ignore no whole ticket, directory or filename pattern. Unexpected untracked product/loaded-input changes refuse; external attempt storage is never projected as product. Historical scopes, ledgers, receipts, phases and all 33 deferred objects are preserved and compared independently, including refused/interrupted paths; the observer never writes them. Obtain observations after planning artifacts settle: later plan, delivery-ledger or review-ledger edits conservatively stale current evidence and require another observation.

The same versioned projection computes initial cleanliness, retry admission and current verification. Verification re-resolves and compares every tool in the shipped execution inventory, including the local Codex launcher and platform package, as well as effective environment/platform, observer runtime bytes/profile digest, runner version and the original checkout's full normalized installed dependency-file tree. Missing prerequisites, any changed identity or an unreadable tree refuses current success with a named input and preparation/rerun action. No network, installation or clone is needed to read these current inputs. The observation retains the copied execution-tree digest; equality of original/copied trees before and after execution links that digest to the read-only verification comparison. A later registry change alone has no effect on already installed bytes; replacing installed bytes, even under the same lockfile, does. Source/tool/dependency equivalence across another host or moved path is not claimed. Add all external tools, including Codex, to the freshness integration controls. Required scope/profile changes need a reviewed new shipped contract through plan-implementation and a new observation; a project edit cannot amend authority. Old records stay historical. Unknown schema or any runtime/profile byte change refuses current success rather than silently upgrading or borrowing receipts.

Rollout: add the command leaves and profile atomically to the ordinary versioned npm CLI and regenerate both native plugin bundles, which embed that same CLI/profile; the existing generators remain authoritative. Commands are available by default on explicit invocation after the normal release, with no automatic hook invocation, profile enrollment or existing cache replacement. Initial exposure is source/disposable installed-distribution proof, then ordinary release only under separate release authority. No release is authorized by this plan. Use the runtime the caller explicitly invokes; its own bundled profile is authoritative and its exact runtime bytes/version are recorded. npm and bundled plugin entrypoints each need local generated-distribution contract proof; this is no claim of native host lifecycle qualification. Mixed versions leave earlier evidence readable but cannot claim current success unless exact bound identities match. Withdraw faulty leaves via an ordinary reviewed release and preserve existing attempts/key; never migrate old records into new success. Existing review/closing commands and historical records require no cutover.

### Data applicability

Data applicability: new local attempt evidence, source snapshots and a purpose-specific key; no change to ticket/review-ledger ownership.

| Subject                  | Decision, reason and consequence                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                  | Retain authentic execution and failures for a later decision; never produce historical RED or approval                                                                                                                                                                    |
| Store and model          | External private filesystem directories, immutable start/artifact/terminal records; reuse exclusive durable writes, no database                                                                                                                                           |
| Schema and relationships | Version-1 manifest links one root, fixed ticket/profile, candidate and many required assertion outcomes/artifact digests to one attempt UUID; retry is a distinct sibling                                                                                                 |
| Source of truth          | Shipped runtime owns required contract; committed source owns observed product; runtime-produced raw artifacts own actual outcomes; tickets retain existing historical authority                                                                                          |
| Ownership and access     | Local user owns private key/store; observer is sole supported writer; verifier is read-only; same-user deliberate forgery is outside the trust claim                                                                                                                      |
| Identity and integrity   | Purpose/root/profile/version-bound HMAC and source/artifact digests; exact case/result sets; symlink/path and cross-root refusals                                                                                                                                         |
| Cross-system flow        | Checkout → disposable clone → external private store → local CLI; no provider, remote upload, review receipt or closing-system flow                                                                                                                                       |
| Lifecycle and retention  | Keep failed and successful attempts indefinitely, no automatic expiry/deletion; interrupted artifacts remain incomplete. Temporary clone is removed only after retained artifacts persist; abrupt death can leave a named orphan, which has no authority                  |
| Migration and backfill   | None from historical/review records; old records are not imported or re-signed. Unknown versions refuse. Future schema migration requires its own reviewed compatibility design                                                                                           |
| Compliance               | Local execution logs/source identities can expose proprietary filenames or test text; private storage, no remote transmission or inherited credentials. No new jurisdiction/residency or legal retention promise is made; no production/customer data fixture is required |
| Rollback                 | Withdraw new commands without changing original records; keep key and attempt files, supported version reader can inspect them. No automatic data rewrite/deletion and no historical rollback                                                                             |

Freshness is content-based, not time-expiring: timestamps diagnose ordering only; there is no clock cutoff, equality/TTL boundary or scheduled erasure. Exact projection equality determines currency. Artifact copies consist of retained start/log/report/terminal data and disposable clone outputs; only the latter are cleanup candidates. This feature introduces neither relational storage, encrypted fields nor a live data migration.

### Measurement applicability

Measurement applicability: skip: Product promises correctness and exact-set completeness, not a latency, throughput, adoption or production KPI. The 37-case inventory is a correctness oracle, not an inferred performance target.

## Design alignment

| Principle                                         | Consequence                                                                                                             | Proof                                                                | Conflict |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Optimize for the NTB without constraining the TBU | Plain-language verdict/recovery with inspectable exact evidence; maintainer walkthrough, no generalized usability claim | features/observe-bounded-delivery-proof.feature                      |          |
| 1. Structure enforces; instructions suggest       | Runtime-owned profile and retained authenticated execution replace success flags                                        | features/observe-bounded-delivery-proof.feature                      |          |
| 3. Add, never replace                             | Separate attempts preserve original history and earlier failures                                                        | features/observe-bounded-delivery-proof.feature                      |          |
| 4. Discover decisions before prescribing work     | Resolve identity, retention and mapping without expanding certification scope                                           | .project/tickets/PPHQN5-observe-bounded-delivery-proof/dimensions.md |          |
| 6. Correct and safe; then clear; then simple      | Reuse durable writes/CLI protocol, no database, new dependency or general recovery framework                            | .project/tickets/PPHQN5-observe-bounded-delivery-proof/impl-plan.md  |          |

These are proof obligations; their current outcomes are recorded separately. Architecture applicability: a new public evidence contract and local data owner are significant; the durable record is [Bounded observation preserves completion authority](../../../ARCHITECTURE.md#bounded-observation-preserves-completion-authority). Honor Typed CLI Execution and Discovery, Semantically Projected Planning Review Provenance, separate planning gates and CKWE2D-only retrospective authority without extending them. Architecture records describe the local implementation without granting completion or release authority.

## Known deviations

skip: no accepted architecture deviation. A separate key follows existing integrity primitives because reusing the retrospective-close signer would cross an excluded authority boundary; no shared signer refactor is required.

## Doc impact

Configured README.md: briefly describe the fixed observer, execution-only meaning and historical limitations. Configured packages/website/src/content/docs: generated CLI reference/discovery must include the two leaves, stable refusals, private evidence retention, offline/preparation behavior and recovery. No description may imply ticket closure, reviewer qualification, native/cloud parity or historical RED. No skills/hooks or template workflow edits are planned.

## Assessment triggers

Revisit if any mapping cannot identify the required existing assertion or parameter row; the proof lane loads an unbound input; clone preparation changes a bound file; runner report schema/retry behavior changes; a dependency/runtime version changes; retention volume needs deletion; a certification consumer writes tracked plan, ledger or review files and thereby stales its own evidence; or portability/host support expands. A consumer asking to use observation as certification/closure needs separate authority. Those conditions return the affected decision to planning and review rather than adding exceptions. Most likely failure in six months: a new execution input bypasses the projection; mitigate through default whole-product binding and loaded-input-overrides-audit negative controls.

Branch coverage, omissions and review freshness stay with 1AHFZS. Send this proposed boundary for coordination; do not treat its receipt as observation, historical RED or completion. No stale-branch merge, shared-gate repair, cache replacement or paid qualification is authorized by this plan.
