# Impl Plan: Keep reviews focused on authored changes

**Status:** planned
**Planned on:** 2026-08-12

## Approach

The riskiest assumption is that a packet can ask Git for generated status
without weakening the existing containment, byte-limit, or source-stability
guarantees. Prove that first with a real temporary Git repository, a fake
reviewer process, and exact JSON assertions for an oversized generated target
beside an authored target. This is a command-level integration test: it
exercises the actual `safeword review run --json` entry point, filesystem,
Git, packet builder, coordinator, and result rendering while faking only the
reviewer subprocess.

1. **Define preflight result types and Git attribute parser.** In
   `packages/cli/src/review/packet.ts`, capture and validate all source targets
   before classification. For each target at or below the individual limit,
   read through a descriptor with a hard bounded byte count, then validate
   UTF-8 and retain its immutable digest. For each oversized regular contained
   target, retain only normalized path and metadata: never load, decode, or
   hash its content. Resolve the project `HEAD` commit, then classify oversized
   canonical targets through this fixed environment and argv:

   ```text
   GIT_ATTR_NOSYSTEM=1 git --git-dir <temporary-bare-dir>
     -c core.attributesFile=<platform-null-device>
     check-attr --source=<HEAD-commit> -z --stdin linguist-generated
   ```

   Run no Git child process at all when every target is within the individual
   byte limit: HEAD resolution, object-directory discovery, and `check-attr`
   are all lazy and occur only after at least one oversized regular contained
   candidate has been identified. Resolve the project `HEAD` commit and its
   object directory with direct Git children running from the canonical
   project root in an explicit allowlist-only environment. Never spread `process.env` into any Git child: omit inherited
   `GIT_DIR`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE`,
   `GIT_CONFIG_*`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, and other Git override
   variables. Supply only a controlled executable search path, the process
   platform essentials needed to launch Git, and explicit isolation settings:
   `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<platform-null-device>`, and
   `GIT_ATTR_NOSYSTEM=1`; supply `GIT_ALTERNATE_OBJECT_DIRECTORIES` only to the
   isolated bare lookup child with the resolved real object directory. The
   committed-HEAD resolution uses the same isolation. Git's own repository
   `.git/config` remains readable for locating worktrees and objects, but no
   inherited environment or global/system configuration may redirect which
   committed tree or attributes are classified. Supply NUL-terminated
   project-relative paths. Resolve `<platform-null-device>` to `/dev/null` on
   POSIX and `NUL` on Windows. Require a Git version that supports `check-attr --source`; an older
   or incompatible executable fails closed through the typed lookup error.
   The temporary bare Git directory has no project `info/attributes`; the
   `--source` tree makes committed
   `.gitattributes` immutable policy input. Parse only exact UTF-8 triples
   (`path`, `linguist-generated`, `value`) and retain only literal `true`.
   Compare each bounded eligible snapshot's digest immediately before this
   lookup, so a same-size, timestamp-restored replacement cannot reach Git.
   Re-`lstat` and re-resolve every oversized candidate after the lookup;
   compare the captured device, inode, regular-file type, and byte size, and
   reject any mismatch (including a same-inode truncate or append, or an
   atomically replaced, same-sized, timestamp-restored file) or newly escaping
   path before finalizing an exclusion, still without reading candidate bytes.
   A typed packet failure owns every stable public code. Primary proof: focused
   `packet.test.ts` cases using temporary Git repositories and byte buffers for
   the exact tuple grammar, multibyte limits, aliases, special paths, malformed
   output, `.git/info`, working-tree, global, and seeded system-attribute
   isolation (including an assertion that the child receives
   `GIT_ATTR_NOSYSTEM=1`), committed-tree lookup, timeout and output limits,
   eligible-target lookup avoidance (asserting zero Git child processes of
   any kind for an all-eligible review, including a non-Git project and an
   uncommitted repository), a sparse target whose content read count remains
   zero, post-lookup target replacement, hard-link path semantics, and
   order-independent error priority. Seed hostile `GIT_COMMON_DIR`,
   `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`,
   `GIT_CONFIG_GLOBAL`, and `GIT_ALTERNATE_OBJECT_DIRECTORIES` in the parent
   process and prove committed-tree classification still wins; assert the
   allowlist environment on both the HEAD-resolution and classification child.
   Separately prove that an in-place same-inode size change after lookup fails
   with `REVIEW_TARGET_CHANGED` before reviewer launch.
   These pure-ish integration tests are the fastest way to prove the exhaustive
   parser/limit matrix.
2. **Build the reduced packet without bypasses.** Keep normal valid targets in
   their immutable snapshot, omit only oversized literal-true targets, and
   retain ordered, canonical exclusions. Normalize and deduplicate review
   targets before any capture, size accounting, or Git lookup. Recheck bounded eligible snapshots a
   second time immediately before launch; reject empty eligible input, all
   invalid preflight, source races, and aggregate overflow before a reviewer
   runs. Source drift remains a preflight failure and therefore has no finalized
   scope; every result after reviewer launch retains the finalized scope.
   Primary proof: packet tests plus a command integration fixture that
   records both packet content and whether a reviewer process was launched.
   Assert first-supplied canonical survivor order and one aggregate count for
   each repeated eligible target and lexical alias. Assert lexical normalization
   occurs before intermediate symlink traversal for both in-project and
   outside-pointing links in `link/../generated/output.js`, and reject
   `link/generated/output.js` when `link` is an intermediate symlink
   directory resolving outside the project, before any Git lookup.
3. **Make typed preflight failures public and update the published contract.**
   Have the public review handler translate packet failures into canonical
   failed result envelopes. Every coordinator result after packet
   finalization adds exact `data.excluded_targets` and a scoped explanation,
   regardless of verdict or route state. This includes approval, changes
   requested, timeout, route exhaustion, degraded fallback, recoverable
   authentication handoff, configured-model rejection, invalid reviewer output,
   and source or snapshot drift after preparation. Failed preflight results
   never expose partial exclusions.
   Update `packages/cli/schemas/cli-result-v1.schema.json` and the `review run`
   entry in `packages/cli/src/cli-protocol/catalog.ts` to describe the new
   result field and stable `REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE` and
   `REVIEW_NO_ELIGIBLE_TARGETS` errors. The v1 schema review-result branch
   requires `data.excluded_targets` when packet scope has finalized, including
   an explicit empty array; preflight failures retain no such field. Primary
   proof: command integration
   tests invoke the built CLI with `--json` and assert stdout, stderr, exit
   status, `errors[0].code`, ordered data, and reviewer-launch logs. Validate
   successful non-empty and zero-exclusion (`excluded_targets: []`) envelopes
   and each new failure-code envelope against the published v1 JSON Schema;
   catalog tests assert the
   public command documents these contract additions.
4. **Project reduced scope at one coordinator return boundary.** Every packet
   preparation records its finalized ordered exclusions in run-local state;
   the one `runReview` return wrapper projects that state onto its result,
   including primary, alternate-model, ranked, degraded, authentication,
   invalid-output, timeout, route-exhaustion, configuration-failure, and
   post-preparation source/snapshot-drift paths. Preflight throws before a
   packet finalizes and therefore bypasses the projection. No route-specific
   result constructor applies or removes scope. Supporting proof: coordinator
   tests force each named outcome independently with a finalized packet and
   assert an exact non-empty exclusion list; a separate in-limit approval
   asserts the field is present as `[]`. A branch-coverage check lists every
   return from the coordinator and fails if any post-finalization return
   bypasses the wrapper. Command tests cover approval, authentication handoff,
   and post-launch route failure envelopes.
5. **Dogfood and document the policy.** Keep both `plugin/runtime/**` and
   `packages/cli/codex-plugin/runtime/**` marked
   `linguist-generated=true`. Include a fixture project with an oversized
   unmarked `plugin/runtime/cli.js` and prove it still fails with
   `REVIEW_TARGET_TOO_LARGE` before reviewer launch. Run the public review command with each oversized
   shipped runtime beside an authored target and assert that it reviews the
   authored target while reporting the generated exclusion. Add
   the CLI reference note that an explicitly generated oversized artifact is
   excluded and reported rather than silently reviewed. Run the generated
   plugin parity check after the source changes. This covers Safeword CLI,
   Claude Code, and OpenAI Codex because each invokes the one shared command;
   Cursor stays on the same CLI contract without a host-specific change.

Use two complementary test boundaries: temporary real Git repositories prove
the isolated committed-tree `check-attr -z --stdin` executable, argv, stdin,
output framing, and immunity to working-tree, `.git/info`, global, and system
overrides; an injected Git
process-result boundary produces exit failures and malformed byte streams that
real Git cannot safely generate. The latter is the sole mocked process
boundary, never a packet or coordinator mock. A sparse-file fixture proves an
oversized generated target is classified from metadata without an unbounded
read.

The feature file remains the behavior source; its dense byte, process, and
security matrix is proven by focused Vitest command and packet tests rather
than duplicating process fixtures in Cucumber step glue. Add `@proof.vitest`
only after the accepted scenario has an exact Vitest path and test-name
binding in `test-definitions.md`; retain Cucumber glue for any scenario
without an executable binding. Before GREEN, check all 46 scenario definitions
and every outline row have a matching executable proof, including both lexical
normalization/symlink rows, the unmarked runtime-shaped negative control, and
repeated/aliased eligible-target ordering and aggregate-count proofs. A missing
binding fails the scenario ledger check instead of silently skipping a scenario.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [Git check-attr manual](https://git-scm.com/docs/git-check-attr) | 2026-08-12 | Git 2.52.0 manual | local Git CLI | documents `--stdin -z` input and the exact NUL-delimited path/attribute/value output tuple | use the tool's machine protocol rather than path arguments or line parsing | documentation only; execute local Git with captured bounded buffers, never source external code |
| [Node child_process documentation](https://nodejs.org/api/child_process.html) | 2026-08-12 | Node 26.7 docs | Node 24.16 runtime | distinguishes direct process invocation from shell-based `exec` | pass fixed argv and bytes directly, never interpolate target paths in a shell | API docs only; no new dependency and no externally supplied command |

**Decision impact:** changed: packet selection now delegates explicit generated classification to Git's NUL-safe protocol while retaining Safeword-owned containment and result contracts.
**Decision informed:** Explicit generated-target classification

### Recorded Decisions

| Decision                                 | Choice                                                                                                                                                                                                                                         | Alternatives considered                                                                                                                | Rejected because                                                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit generated-target classification | Batch oversized canonical paths through an isolated bare Git directory's committed `HEAD` tree, NUL-safe `check-attr`, `GIT_ATTR_NOSYSTEM=1`, and a platform null global-attributes path; only exact committed `true` is eligible for omission | normal project Git invocation; live worktree attributes; filename/extension heuristic; Git argv paths; truncate content; always reject | normal Git inherits `.git/info` and external config; live files can drift mid-preflight; heuristics and truncation hide scope; argv paths mishandle special names; always rejecting leaves #2121 unresolved |
| Resource-bound oversized classification  | Validate regularity and containment from metadata, then classify an oversized target without loading its bytes                                                                                                                                 | stream/hash every target; decode a prefix; accept unbounded `readFile`                                                                 | a full stream bounds memory but not I/O; a prefix cannot establish UTF-8 correctness; the withheld target has no packet content to validate                                                                 |
| Preflight failure boundary               | Typed packet error becomes a failed `review run --json` result before reviewer launch; attribute failure wins, then the first supplied normalized target failure supplies the code                                                             | raw thrown error; opaque aggregate error; treat Git failure as unmarked                                                                | raw errors break machine clients; target order is explicit and reproducible; misclassification hides broken repository metadata                                                                             |
| Reduced-scope projection                 | Add ordered `data.excluded_targets` to every result after packet finalization through one shared projection helper; preflight failures have none                                                                                               | free-form finding only; report it only on approval; duplicate route-specific additions                                                 | prose is not stable machine data; route failures also need auditable scope; route copies drift                                                                                                              |

## Design alignment

| Principle                                         | Consequence                                                                                                                                              | Proof                                                                   | Conflict |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| Optimize for the NTB without constraining the TBU | A builder gets a clear JSON error or visible reduced scope without manually curating generated output; exact omitted paths preserve technical control    | `packages/cli/features/keep-reviews-focused-on-authored-inputs.feature` |          |
| Structure enforces; instructions suggest          | Packet selection and typed errors make invalid input impossible to review instead of relying on reviewers to notice omissions                            | `packages/cli/tests/review/packet.test.ts`                              |          |
| Correct and safe; then clear; then simple         | Reuse the existing packet/coordinator boundary, a direct Git subprocess, and a small result projection rather than heuristics or a new abstraction layer | `packages/cli/tests/review/packet.test.ts`                              |          |

Honors the accepted **Host-owned cross-agent adversarial review coordinator** decision in `ARCHITECTURE.md`: the change stays inside `packages/cli/src/review/`, preserves bounded snapshots and typed results, and does not add a host-specific review path. No new ADR is warranted: the policy is reversible, local to the existing coordinator, and follows that recorded architecture.

## Known deviations

skip: no deviations planned. Git is a required part of the repository-reviewed workflow; if attribute lookup is unavailable or malformed, the design fails closed with a typed recovery result rather than adding a fallback classifier.

## Doc impact

- Update `packages/website/src/content/docs/reference/cli.mdx` in build step 5: explain that `review run` may omit only explicitly Git-marked oversized artifacts and reports the exact reduced scope in JSON.
- Update `packages/website/src/content/docs/reference/hooks-and-skills.mdx` in build step 5: preserve the coordinator's bounded-packet explanation while naming the transparent generated-artifact exception.

## Assessment triggers

- Git changes the documented `check-attr --stdin -z` tuple protocol or removes a supported local installation path.
- The supported Git baseline no longer includes `check-attr --source`, requiring a different immutable-tree lookup.
- Review packets commonly contain generated artifacts that are large but intentionally need review, suggesting explicit per-command inclusion policy rather than a marker-only exception.
- Another host or a non-Git project becomes a supported review surface, requiring a repository-owned classification source other than `.gitattributes`.
- Result consumers need the excluded scope outside JSON, such as a structured review receipt or UI surface.
