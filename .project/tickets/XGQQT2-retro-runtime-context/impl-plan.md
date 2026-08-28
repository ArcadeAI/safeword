# Impl Plan: Attach useful runtime context to retros without signup

**Status:** planned
**Planned on:** 2026-08-27

## Approach

The riskiest assumptions are the released v1 compatibility boundary and the
subprocess-free Git-config reader. Characterize both before changing behavior.
Claude and Codex already ship the optional runtime fields. This slice extends
that contract to Cursor, changes every new producer to honest `hostClass:
unknown`, stops new `userIdentity` emission, adds optional-value hygiene, and
documents those exact guarantees. It does not
claim to introduce the existing Claude/Codex context fields.

Build collector-first in seven green slices to preserve deployment ordering.
Every new harness producer reports `unknown`.
Deploy and live-prove the backward-compatible collector after merge before
creating the separately controlled npm/plugin release tag.

1. Characterize the existing Claude, Codex, and Cursor retro paths without
   changing behavior. For Codex, pin the existing shared run-identity resolver,
   including its `CODEX_THREAD_ID` fallback, as the `sessionScope` authority.
   For Cursor, pin `conversation_id` through the shared run-identity resolver,
   closeout binding, and explicit `--session-id` handoff as the same authority;
   also pin that today's public route skips the literal `cursor` agent value.
   Pin the released route behavior that `CLAUDE_CODE_REMOTE_SESSION_ID` suppresses
   public delivery before source preparation.
   Characterize Cursor capture in a project installed with the explicit Cursor
   surface, including transcript stash and `SAFEWORD_RETRO_AGENT=cursor`;
   Cursor is not part of a default install. Pin a
   literal installed project identity and characterize its current healing
   behavior. Drive the existing `public-source.ts` Git-config reader through ordinary checkout,
   linked worktree, absent origin, delegated config, unsupported rewrite shapes,
   and hostile absolute/traversal/symlink `gitdir` pointers carrying a private
   sentinel. It reads the supplied project root only, selects the local
   `[remote "origin"]` URL, follows only the existing realpath- and
   backlink-verified worktree `gitdir` / `commondir` relationship, and omits
   repository for hostile pointers, includes, `includeIf`,
   `url.*.insteadOf`, missing origin, malformed config, or any unsupported
   shape. Pin the existing Git-email-to-`userIdentity` derivation before slice 4
   removes it. No general Git-config implementation is added. Also characterize the
   existing install/setup project-identity lifecycle and zero-I/O boundary.
   Existing `public-config.test.ts` and `public-source.test.ts` prove lowercase
   normalization and local generation. Keep this slice characterization-only.
   If any required behavior, Cursor path, or
   Git-reader characterization fails, stop and re-plan rather than expanding
   setup behavior ad hoc.
2. Implement and prove the six SWM1.R1 install/upgrade identity scenarios through
   the existing setup lifecycle, reusing the characterized public-config
   behavior and adding no subprocess or network dependency.
3. Pin release history: public-retro producers first shipped in v0.79.4 and the
   v0.79.4, v0.79.5, and v0.79.6 builder sources are byte-identical. Capture
   exact Claude Code and Codex envelopes from that tagged builder, including the
   released optional fields: `repository`, `agentVersion`, `model`,
   `safewordPluginVersion`, `osFamily`, and `userIdentity`. The released builder
   trims but does not byte-bound or control-check them. Capture a controlled v1
   fixture with synthetic repository and `userIdentity` sentinels and each
   released field outside the new producer bound, proving the
   collector retains its original nonempty/body-size rules. If the tagged
   sources differ, stop and re-plan the compatibility matrix. Replace the two
   flat vocabularies with one explicit compatibility matrix: `local` is valid
   only for `claude-code` and `codex`, while `unknown` is valid for
   `claude-code`, `codex`, and `cursor`. Retain the closed source keys and prove raw
   byte preservation through real HTTP and SQLite integration. This slice also
   explicitly accepts released Claude/Codex `hostClass: local` envelopes and
   re-proves the existing unknown-field, type/UUID, required-field,
   vocabulary, body-size, and first-writer rejection/dedupe scenarios unchanged.
4. Tighten CLI source derivation: one current optional-string policy,
   credential-free repository normalization, and independent
   omission on reader failure. Keep enrichment inside the existing preparation
   flow without adding a second deadline. This tightens the existing `public-source.ts`
   reader; it does not introduce a second repository-identity authority.
   Current producer optionals use ECMAScript `String.prototype.trim` first,
   are omitted
   when empty after trimming, and then checked for control characters and the
   256-byte UTF-8 bound. Drive a shared test-fixture corpus through the
   producer boundary covering U+0007, one C1 control, non-ASCII trim whitespace,
   256/257 UTF-8 bytes, and a 4-byte non-BMP fixture. Assert invalid values are
   omitted independently and every retained boundary value round-trips through
   the released collector rules. Accept repository output only for
   `github.com` and `gitlab.com`; omit every other host so internal names cannot
   reach the public collector. Remove Git-email collection and ignore
   `GITHUB_ACTOR`; actor/cloud attribution remains #3430. Read repository identity synchronously
   from `.git/config`, following only the verified linked-worktree relationship
   without invoking `git`. Characterize missing or malformed project identity at
   retro time as a skipped public attempt with existing recovery preserved.
5. Wire Claude, Codex, and Cursor through the existing `retro run` composition
   without changing recovery or dedupe inputs. Every new producer emits
   `hostClass: unknown`; prove all three harness rows through the real
   CLI-to-collector lifecycle. In projects
   with the explicit Cursor surface installed, Cursor already reaches `retro run`
   through the installed retro skill, transcript stash, and
   `SAFEWORD_RETRO_AGENT=cursor`; this slice changes route selection, not capture.
   Cursor exposes no supported agent-version or model signal today, so both are
   omitted unconditionally rather than discovered speculatively. Its
   `safewordPluginVersion` is also omitted because Cursor has no separate
   SafeWord plugin bundle; the running package remains `safewordCliVersion`.
   This slice also preserves route eligibility: retain
   `CLAUDE_CODE_REMOTE_SESSION_ID` denial for Claude and stop that Claude-only
   signal from suppressing Codex or Cursor. The denial occurs before source
   preparation and preserves the existing silent recovery lane. The two
   harness-scoped environment scenarios, missing Cursor identity recovery, and
   Cursor-specific project opt-out are proved in this slice.
6. Add fault-injection and duplicate-session lifecycle proofs using real CLI,
   collector, and SQLite collaborators, mocking only controlled runtime/process
   boundaries. This slice owns the no-runnable-carrier,
   collector-rejection recovery, deadline, reader-failure, and dedupe scenarios.
   Cursor lifecycle rows prove the
   same `conversation_id` retains one first-writer row and distinct conversation
   identities retain two. A missing identity skips the public attempt and leaves
   existing recovery untouched; if the characterized identity is unstable, stop
   rather than inventing a fallback.
7. Update package inventory, runtime/storage boundary, private/public relay
   relationship, and unconditional public-field/opt-out documentation. Verify
   packaged CLI and collector behavior, then run full verification and audit.
   Keep the existing release mechanism. Packaged collector tests must prove the
   complete accepted matrix — `local` for Claude/Codex and `unknown` for
   Claude/Codex/Cursor — from the same validator exercised by production. Railway
   auto-deploys the merged collector from `main`; after its ordinary health check
   succeeds, the release operator confirms the green commit and only then creates
   the existing manual annotated tag. Add a release-contract assertion that the
   README documents `publicRetrospectiveCollection: false` before Cursor egress
   can ship. This is deliberately an operational sequencing gate at current low
   volume, not a new public health schema or release-orchestration subsystem.

The collector is deployed and proved before the separately releasable producer,
but both stay in one ticket because one acceptance contract and lifecycle suite
must prove their interoperation. If Cursor or repository characterizations fail,
stop and re-plan that slice rather than expanding capture or Git parsing ad hoc.

Negative proofs instrument the real existing process boundaries: the actual
child-process entry point, HTTP transport, handoff timer, worker creation, and
retry boundary used by retro preparation and delivery. Reader and transport
faults remain injected, but absence assertions are made against those existing
boundaries rather than ticket-local no-op recorders.

## Decisions

Implementation inspiration and evidence are recorded once in `spec.md`; the
implementation-specific delta is the widened-source decision below.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Widen the existing source authority | Add Cursor to the closed v1 contract and keep released value rules | Add v2; add a source-level revision; add a `context` wrapper | Producer bounds and the existing body limit are sufficient; the alternatives add permanent contract authority without user value |
| Preserve the collector trust boundary | Independently validate the exact closed contract and persist original canonical bytes | Share producer validation code; normalize at ingestion | Producer code is not a trust boundary; ingestion rewriting would violate byte authority and legacy round-trip |
| Stop new identity emission without breaking installed clients | New producer emits neither Git email nor cloud-only actor signals; collector continues accepting released `userIdentity` | Reject old producers; rewrite legacy envelopes | Rejection breaks installed clients; rewriting violates raw-body authority; actor classification belongs with #3430 |
| Keep wire keys stable | V1 continues using required `harness`, `hostClass`, `projectUUID`, and `safewordCliVersion`, plus the released optional keys | Rename or duplicate fields | Renames add no user value and create avoidable operator/schema drift |
| Report only proven execution class | Preserve `local` at ingestion and emit `unknown` for every new harness producer | Keep Claude/Codex emitting `local` and use `unknown` only for Cursor; Cursor filesystem proof; device attestation | Keeping the old claim would knowingly preserve false local attribution and create harness-dependent semantics; proof/attestation add complexity or registration |
| Validate harness and host class together | Accept `local` only for Claude/Codex and `unknown` for Claude/Codex/Cursor, without a version gate | Two independent allowlists | This closes an impossible vocabulary pairing; it protects schema/dataset integrity, not producer authenticity |
| Keep new hygiene producer-owned | Defer all free-form value hygiene to the coordinated v1 sunset in #3440 | Enforce the new limits only for Cursor or `hostClass: unknown` | Unlike closed vocabulary pairings, per-harness bounds on free-form values would create implicit v1 revisions and two value contracts; this slice keeps one released ingestion policy and one stricter current-producer policy |
| Sequence collector before producer release | Keep the existing manual annotated-tag step after packaged matrix tests pass and Railway reports the merged collector healthy | New public health schema; synthetic production probes; automated tag workflow | Those mechanisms add permanent API/workflow surface or pollute operator data. At current volume we accept an operator gate; if it is skipped, upgraded retros may be rejected until the collector deploy is corrected, without affecting local capture or recovery |
| Reuse existing durability and deadline | Keep project UUID, session-scope claim, SQLite raw-body store, existing preparation deadline, and recovery lane; add no metadata timer | Add a metadata store, queue, retry, or background worker | The existing path already supplies identity, durability, dedupe, and nonblocking recovery |
| Preserve every released producer shape | Treat v0.79.4-v0.79.6 as one byte-identical v1 contract and keep every released optional field under its original nonempty/body-size rules without a sunset in this slice | Tighten collector limits or time-based rejection | Either would silently reject fire-and-forget installed producers without a coordinated migration event |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Enrichment is invisible, optional, and requires no registration while exact evidence remains operator-readable | `features/retro-runtime-context.feature` | |
| 1. Structure enforces; instructions suggest | Collector closed validation enforces shape, required fields, vocabulary, and compatibility; the new producer enforces email exclusion and optional-value hygiene | `packages/retro-collector/tests/public-retro.integration.test.ts` | |
| 2. Fire at boundaries, not every turn | Context is derived once at the existing retro delivery boundary | `packages/cli/src/commands/retro.ts` | |
| 5. Correct and safe; then clear; then simple | Reuse one envelope, one store, one dedupe path, and the existing deadline instead of adding concurrency or another timer | `features/retro-runtime-context.feature` | |

This honors `ARCHITECTURE.md`'s published-CLI composition root, retro-domain
ownership, private/public service separation, and durable retro relay boundary.

## Known deviations

- Existing accepted legacy rows and ongoing submissions from installed
  v0.79.4-v0.79.6 producers may contain email-derived `userIdentity`. This slice
  stops email emission only in the new producer and deliberately continues
  accepting the legacy contract to prevent silent client breakage. It does not
  rewrite or purge raw stored bytes; retention/sunset policy is tracked in #3440
  and explicitly outside this ticket's launch scope. User docs must
  describe the new-producer guarantee rather than historical
  or universal absence.
- Installed v0.79.4-v0.79.6 producers may also emit self-hosted or internal
  repository hostnames that the new producer omits. The collector preserves
  those legacy bytes; README language must describe the public-host allowlist as
  a new-producer guarantee, and #3440 owns any coordinated legacy-value sunset.
- Operator authentication and authorization are unchanged. Existing integration
  coverage continues to prove unauthorized reads are refused; widening the
  stored source shape does not add a read route or reader role.
- Email exclusion and the 256-byte/control-character hygiene rules are
  producer-enforced only. The collector deliberately retains released v1 value
  rules until #3440 defines a coordinated sunset; it still enforces the closed
  shape, required fields, types, UUID format, harness/host vocabulary, canonical
  bytes, and body-size limit.
- After the new producer release tag is published, rolling the collector back to
  a version that predates this widened source contract is unsupported because it
  would reject `unknown` host class from every newly upgraded producer and the
  new `cursor` harness. This is one-way after the first producer upgrade;
  restore the widened collector contract rather than relying on a producer
  rollback.
- Collector-before-producer ordering remains an explicit operator gate. If the
  tag is created before Railway has deployed the green collector build, upgraded
  public submissions can be rejected until deployment catches up; local capture
  and the existing recovery lane remain intact. Automating this low-frequency
  release boundary is deferred until release volume justifies permanent workflow
  machinery.
- GitLab repository paths preserve case by design because the CLI does not
  assume GitLab paths are case-insensitive. Operator grouping for GitLab is
  therefore case-sensitive.
- Cursor context applies only to projects whose explicit Cursor surface is
  installed; this ticket does not change the product's default agent selection.
- Cursor projects with that explicit surface gain public retro delivery for the
  first time. The existing project-level `publicRetrospectiveCollection: false`
  control remains the opt-out, and the same release notes that enable Cursor
  delivery must make that control discoverable.
- Existing Claude Remote suppression means Claude cloud retros remain absent
  while Codex and Cursor submissions carrying the same environment signal can
  arrive as `unknown`. Operators must not interpret that absence as evidence of
  lower Claude-cloud friction; #3430 owns closing the carrier/classification gap.
- Zero-registration clients cannot cryptographically attest that any supported
  harness runs on a physical user machine. They therefore report `unknown`; #3430
  owns exact cloud classification. Adding device registration or machine
  attestation now would violate the zero-signup goal and overbuild the low-volume
  launch.
- Stored `hostClass` has a release seam: v0.79.4-v0.79.6 Claude/Codex rows say
  `local`, while new producer rows say `unknown`. Operators must treat that split
  as a producer-version boundary, not evidence that execution moved between
  local and cloud.

## Doc impact

- Update `ARCHITECTURE.md` package inventory, public collector runtime/storage
  boundary, raw-byte authority, and relationship to the private relay.
- Update `README.md` and the release PR notes with the public source fields,
  Cursor's first public delivery, privacy exclusions, producer hygiene, the
  `publicRetrospectiveCollection: false` opt-out, and the temporary `unknown`
  execution class until #3430.
  Call out the legacy `local` versus new `unknown` dataset seam explicitly.

## Assessment triggers

- A supported cloud discriminator and carrier are proven; #3430 may replace
  `unknown` with an exact cloud value for that route.
- A harness exposes a supported, non-spoofable execution-class signal; reassess
  `unknown` through #3430 before widening producer vocabulary.
- A second producer language needs the same normalization semantics, making a
  versioned shared contract package cheaper than deliberate duplication.
- The public envelope requires a breaking required-field or semantic change,
  which would require a new envelope version rather than another optional field.
- Operators need retention, cross-project identity, or analytics; those require
  separate product/privacy decisions and are not implicit extensions here.
