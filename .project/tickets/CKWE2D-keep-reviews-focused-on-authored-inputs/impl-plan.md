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
   canonical targets through `git --git-dir <temporary-bare-dir> -c
   core.attributesFile=/dev/null check-attr --source=<HEAD-commit> -z --stdin
   linguist-generated`, with the real object database supplied only as Git's
   alternate object directory, system/global configuration disabled, and
   NUL-terminated project-relative paths. The temporary bare Git directory has
   no project `info/attributes`; the `--source` tree makes committed
   `.gitattributes` immutable policy input. Parse only exact UTF-8 triples
   (`path`, `linguist-generated`, `value`) and retain only literal `true`.
   Compare each bounded eligible snapshot's digest immediately before this
   lookup, so a same-size, timestamp-restored replacement cannot reach Git.
   Re-`lstat` and re-resolve every oversized candidate after the lookup; reject
   an inode/type replacement (including atomically replaced, same-sized,
   timestamp-restored regular
   replacement) or a newly escaping path before finalizing an
   exclusion, still without reading candidate bytes.
   A typed packet failure owns every stable public code. Primary proof: focused
   `packet.test.ts` cases using temporary Git repositories and byte buffers for
   the exact tuple grammar, multibyte limits, aliases, special paths, malformed
   output, external-attribute isolation, committed-tree lookup, timeout and
   output limits,
   eligible-target lookup avoidance, a sparse target whose content read count
   remains zero, post-lookup target replacement, hard-link path semantics, and
   order-independent error priority.
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
3. **Make typed preflight failures public.** Have the public review handler
   translate packet failures into canonical failed result envelopes. Every
   coordinator result after the packet has finalized—approved, changes
   requested, timeout, route exhaustion, or degraded fallback—
   adds exact `data.excluded_targets` and a scoped explanation. Failed preflight
   results never expose partial exclusions.
   Primary proof: command integration tests invoke the built CLI with `--json`
   and assert stdout, stderr, exit status, `errors[0].code`, ordered data, and
   reviewer-launch logs.
4. **Propagate reduced scope through every successful route.** Reuse one result
   projection helper from primary, alternate-model, and degraded fallback
   success paths. Supporting proof: coordinator tests exercise the primary and
   fallback result shapes so a route cannot drop exclusions.
5. **Dogfood and document the policy.** Mark `plugin/runtime/**` as
   `linguist-generated=true`, assert the shipped attribute through Git, and add
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
before GREEN so the normal Cucumber lane does not treat the deliberate
Vitest-backed scenarios as undefined steps.

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

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- |
| Explicit generated-target classification | Batch oversized canonical paths through an isolated bare Git directory's committed `HEAD` tree, NUL-safe `check-attr`, and global/system attributes disabled; only exact committed `true` is eligible for omission | normal project Git invocation; live worktree attributes; filename/extension heuristic; Git argv paths; truncate content; always reject | normal Git inherits `.git/info` and external config; live files can drift mid-preflight; heuristics and truncation hide scope; argv paths mishandle special names; always rejecting leaves #2121 unresolved |
| Resource-bound oversized classification | Validate regularity and containment from metadata, then classify an oversized target without loading its bytes | stream/hash every target; decode a prefix; accept unbounded `readFile` | a full stream bounds memory but not I/O; a prefix cannot establish UTF-8 correctness; the withheld target has no packet content to validate |
| Preflight failure boundary | Typed packet error becomes a failed `review run --json` result before reviewer launch; attribute failure wins, then the first supplied normalized target failure supplies the code | raw thrown error; opaque aggregate error; treat Git failure as unmarked | raw errors break machine clients; target order is explicit and reproducible; misclassification hides broken repository metadata |
| Reduced-scope projection | Add ordered `data.excluded_targets` to every result after packet finalization through one shared projection helper; preflight failures have none | free-form finding only; report it only on approval; duplicate route-specific additions | prose is not stable machine data; route failures also need auditable scope; route copies drift |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- |
| Optimize for the NTB without constraining the TBU | A builder gets a clear JSON error or visible reduced scope without manually curating generated output; exact omitted paths preserve technical control | CLI command integration assertions for envelope, exit code, and `excluded_targets` | |
| Structure enforces; instructions suggest | Packet selection and typed errors make invalid input impossible to review instead of relying on reviewers to notice omissions | packet and command tests prove no reviewer launch on every rejection path | |
| Correct and safe; then clear; then simple | Reuse the existing packet/coordinator boundary, a direct Git subprocess, and a small result projection rather than heuristics or a new abstraction layer | parser, containment, source-race, and parity regressions | |

Honors the accepted **Host-owned cross-agent adversarial review coordinator** decision in `ARCHITECTURE.md`: the change stays inside `packages/cli/src/review/`, preserves bounded snapshots and typed results, and does not add a host-specific review path. No new ADR is warranted: the policy is reversible, local to the existing coordinator, and follows that recorded architecture.

## Known deviations

skip: no deviations planned. Git is a required part of the repository-reviewed workflow; if attribute lookup is unavailable or malformed, the design fails closed with a typed recovery result rather than adding a fallback classifier.

## Doc impact

- Update `packages/website/src/content/docs/reference/cli.mdx` in build step 5: explain that `review run` may omit only explicitly Git-marked oversized artifacts and reports the exact reduced scope in JSON.
- Update `packages/website/src/content/docs/reference/hooks-and-skills.mdx` in build step 5: preserve the coordinator's bounded-packet explanation while naming the transparent generated-artifact exception.

## Assessment triggers

- Git changes the documented `check-attr --stdin -z` tuple protocol or removes a supported local installation path.
- Review packets commonly contain generated artifacts that are large but intentionally need review, suggesting explicit per-command inclusion policy rather than a marker-only exception.
- Another host or a non-Git project becomes a supported review surface, requiring a repository-owned classification source other than `.gitattributes`.
- Result consumers need the excluded scope outside JSON, such as a structured review receipt or UI surface.
