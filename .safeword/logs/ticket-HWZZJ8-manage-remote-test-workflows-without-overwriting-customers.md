# Work Log: HWZZJ8

## 2026-08-15 — Plan-boundary split

- Re-read the plan, feature, specification, project principles, architecture,
  ticket guidance, BDD planning guidance, and split checkpoint.
- Current research favored small independently useful batches; the existing
  release-contract gate proved read-only status can ship without exposing a
  partial writer.
- Narrowed this ticket to immutable identity, observation, classification,
  read-only planning, and status. H136BP now owns every write.
- Replaced the combined 12-step plan and mutation-heavy feature with a six-step
  read-only plan and matching executable scenarios.
- Degraded independent review requested changes. Removed recovery-evidence
  interpretation and false publication-required claims, moved the real Git/EOL
  proof first, strengthened the one-way module gate, and made every relevant
  replacement invalidate the plan precondition digest.
- A second degraded pass found remaining authority gaps. Made opaque recovery
  data customer-owned, corrected half-present paths, added the complete
  state/request plan matrix, expanded the first proof across all historical and
  attribute variants, and specified coherent pin/read/revalidate plus detectable
  ABA coverage.
- A third degraded pass tightened proof mechanics: slice one is now an
  independent identity probe; EOL portability has a bounded Git/OS matrix and
  literal oracle; fingerprints are diagnostic rather than write authority;
  portable ancestry limits and race/error classification are explicit; and all
  exhaustive registries require set equality.
- A fourth degraded pass resolved identity-oracle and repeatability ambiguity:
  exact authorized CRLF is converted to canonical LF before no-filter hashing;
  public fingerprints exclude volatile metadata; every command performs two
  complete internally revalidated passes; public types freeze only afterward;
  and the actual Git/OS CI claim is bounded to runner-provided versions plus a
  separate minimum-version gate.
- A fifth degraded pass split absence by local versus remote-preferred intent,
  removed recovery-version parsing from HWZZJ8, made the EOL oracle total and
  independently value-checked, and separated path from attribute precedence.
- A sixth degraded pass preserved opaque recovery evidence and routed it to a
  recovery-aware upgrade, replaced unsupported Git-version claims with runtime
  capability checks, and extended two-pass identity barriers to every bounded
  preference, recovery, Git-admin, attribute, and config input.
- A seventh degraded pass made HWZZJ8 dark-launched until H136BP makes every
  advertised action real, added closed Git-config origin tokens, grounded source
  mechanisms in Git's effective query result with scrubbed environment config,
  and reduced race proof to a finite behavioral barrier registry.
- The recombined review replaced multi-file atomic-visibility claims with
  journaled recoverable consistency, made exact-candidate equality the sole CRLF
  authority, specified the reserved Git-ref lock protocol, removed proof flags,
  added a black-box disk oracle, and completed recovery-aware status precedence.
- The next pass restored the retained spec's single forward decision at durable
  journal publication, mapped the exact Git-lock deadline/error states, narrowed
  filesystem claims to detectable barriers, moved black-box composition before
  public freeze, and made manifest admission a generated release gate.
- The following pass made forward recovery conditional on unchanged journal
  sides, moved registry generation before identity work without consuming a
  runtime admission flag, modeled rename/fsync ambiguity, added CR-free
  reversible manifest invariants, and bound every release check to the exact
  built graph.
- The next pass specified journal-parent-fsync failure and its two later disk
  observations, added a fail-closed Git transaction capability probe, restated
  enforceable architecture constraints in the review packet, and delayed schema
  freeze until real crash/lock composition passes.
- The final security pass made every Git lock probe/acquisition hook-free with a
  validated empty hooks directory, final command-line override, scrubbed config
  injection, and zero-execution hook sentinels.
- The contract-completion pass added every retained recovery token, specified
  bounded lock retry/backoff and cleanup, made the Git environment allow/deny
  algorithm literal, clarified per-member old/target recovery authority, and
  narrowed cross-platform checkout claims to certified fixtures.
- The prerequisite pass moved Git-lock and filesystem-durability feasibility
  ahead of transaction design, separated build probes from lightweight runtime
  acquisition, added the unsupported-platform result, bound recovery to exact
  per-worktree identities, and made the Git child environment platform-literal.
- The lock-and-proof pass added `option no-deref` plus symbolic-ref race checks,
  separated ownership expectations into a checked-in literal oracle, constrained
  black-box tests with an enforced import boundary, specified the private hooks
  directory lifecycle, and consolidated publication gating into one normative
  managed-workflow release contract.
- The journal-simplification pass removed separate staging entirely: the bounded
  journal carries target bytes, incomplete first publication is preserved as an
  explicit repair conflict, runtime storage failures use recovery rather than a
  false no-write capability promise, Git lock residue is observable, and defect
  seeding proves the black-box oracle catches semantic ordering errors.
- The provenance pass stopped treating persisted journal bytes as authority after
  restart. Status now asks the builder to repeat the intended setup; that explicit
  command independently recomputes its target and may repair only closed old/new
  values. Platform/version filesystem heuristics were removed, preference repair
  received an explicit old/new/third-value table, schema v1 freezes before
  cross-process work, and model-based plus defect-seeded tests supplement literals.
- The realizability pass replaced the impossible rename/no-replace combination
  with two exact entries and an exclusive-create, file-fsync, atomic hard-link,
  directory-fsync protocol. It split unsupported versus malformed recovery
  results and closed Git lock failures into spawn/protocol, ref conflict,
  contention, deadline, and Git-owned-residue classes.
- The portability pass made direct bytes the sole ownership authority across
  SHA-1/SHA-256 repositories, made post-success hooks-directory cleanup failure
  a truthful non-fatal warning, mapped ambiguous post-prepare lock races to
  conservative retry, and replaced release-gated checkpoint cardinalities with
  model properties, mutation tests, and a small regression set.
- After catching up 462 commits to main, the review-contract pass scoped the host
  Git binary as an explicit trusted dependency, made Windows environment scrubbing
  case-insensitive, removed checkpoint cardinalities from behavioral gates,
  defined universal packaging with a closed unavailable-platform result, and
  separated immutable journal and receipt publication protocols.
- The race-boundary pass added pre/post-prepare config and hooks-path identity
  checks with an honest same-user limitation, froze exact SHA-1/SHA-256 prepared
  transaction bytes and acknowledgements across files/reftable, and designated
  one machine-readable public transition/result contract with literal independent
  black-box expectations.
