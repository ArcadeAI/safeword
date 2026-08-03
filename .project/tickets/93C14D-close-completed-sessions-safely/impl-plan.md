# Impl Plan: Close completed sessions safely

**Status:** implemented

## Approach

The riskiest assumption is that a user-facing coordinator skill plus one small
deterministic cleanup guard can close a session safely without becoming a second
delivery state machine. The cheapest proof is the exact-identity cleanup slice:
in a temporary real git repository, the guard must preview no deletion until a
fresh GitHub observation says `MERGED`, the retro command produced a successful
machine-readable result with an empty spool, and the worktree plus local and
remote refs still match the PR head name and OID.

Proof and build order:

1. Add RED integration tests for a preview-first
   `.safeword/scripts/closeout-cleanup.ts` guard. Use real temporary git repos
   and worktrees; mock only the `gh` process boundary. The guard resolves one PR,
   records its head name/OID, parses `git worktree list --porcelain`, collects all
   blockers, and emits a digest-bound plan. Identity includes the PR URL, head
   owner/repository, mapped git remote URL, ref, and OID—not a coincidental branch
   name. Forks, missing/multiple remote mappings, default/protected branches, and
   unknown protection state block deletion. `--yes --plan <id>` re-observes before
   every operation, changes to the surviving main worktree before teardown, then
   performs worktree → remote ref → local ref cleanup. Worktree removal never
   uses force; remote deletion is compare-and-swap with an exact lease; local
   deletion uses `git update-ref -d <ref> <old-oid>` so squash/rebase heads do not
   require an ancestry guess.
   Before emitting that plan, the guard also generates and executes the project's
   verify/build/typecheck/BDD/dependency plans through the installed Safeword CLI,
   requires every lane to pass, and proves HEAD stayed at the recorded PR head
   OID throughout. The plan also hashes tracked and untracked working-tree state;
   apply/resume re-observes it and invalidates the plan on any change even when
   HEAD is unchanged. Cleanup therefore cannot inherit a stale `/verify` claim.
2. Add RED table-driven contract tests for the canonical skill. The table maps
   every accepted scenario/example to a required observation, forbidden action,
   recovery action, or final-report field; deletion-mutation fixtures prove each
   safety-critical clause is load-bearing rather than a prose snapshot.
3. Add RED installed-project integration coverage derived from the production
   schema, Cursor wrapper catalogue, and Codex catalogue generator. Install into
   a fixture, resolve the Claude skill, follow the Cursor command pointer, and
   load the profile-layout generated Codex plugin skill (never a project-local
   imitation); each must reach the same canonical contract and cleanup guard.
   Exercise the guard from each resolved entry-point fixture
   against real git state and the mocked `gh` process boundary. This proves host
   adaptation and collaborator wiring; it does not claim to test model selection.
4. Write the concise closeout skill, cleanup guard, schema registration, and
   Cursor wrapper metadata. Invocation alone grants **no merge authority**.
   Normal or administrative authority must appear explicitly in the current
   user request; admin requires an unambiguous request to bypass repository
   requirements. Authority is consumed by the attempted merge and is never
   inferred from history or reused on resume. Queue/auto-merge resumes only
   observation. The skill never uses `gh pr merge --delete-branch` and always
   re-observes the expected PR after any merge command.
5. Make retro a natural prerequisite owned by the guard. Claude, Codex, and
   Cursor pre-shell hooks bind the host-provided exact session/conversation id to
   the imminent guard command in a short-lived, project-scoped, single-consumer
   cache (Cursor binds `transcript_path` too).
   The guard fails closed when that binding is missing or expired—there is no
   newest-file fallback. It resolves the exact transcript from the bound identity,
   proves the transcript metadata/cwd belongs to the current repository/worktree,
   derives the spool identity from that transcript, invokes
   `safeword retro run --format json`
   with either the egress-guarded findings file or supported auto-extraction,
   parses the process result directly, and reads that derived session's spool.
   Only a healthy/changed result with `data.agent_filing_needed: false` and zero
   pending drafts can produce a cleanup plan. Callers cannot supply a receipt or
   arbitrary spool/session path. A resumed cleanup reruns this idempotent proof.
6. Generate Cursor and Codex artifacts and reconcile the Claude dogfood copy.
   Tag the feature `@manual` with its evidence boundary: root `cucumber.mjs`
   excludes `@manual` from both default and live lanes. Deterministic git/guard,
   contract, and installed-wiring behavior remains automated. A fresh independent
   orchestrator first writes a review-request manifest containing SHA-256 hashes
   of the final installed Claude/Cursor/Codex artifacts, feature, and automated
   results. A fresh reviewer no weaker than the author receives those exact inputs
   plus the manifest, then returns its manifest digest and a binary verdict for
   every scenario/example. The author-side orchestrator—not the reviewer—records
   reviewer identity/model and the returned digest in `manual-review.md`. A
   deterministic test recomputes all input hashes and the manifest digest, then
   rejects a missing/mismatched reviewer-bound digest, missing rows,
   non-binary/failing verdicts, unknown reviewer metadata, or any stale hash; any
   failure blocks release. The scorer is calibrated with one representative
   deletion mutation per distinct safety mechanism/Rule.
7. Document `/closeout` in README.md and the configured website reference,
   including local-host invocation, no-authority default, admin boundary,
   merge-queue and partial-success handling, mandatory retro, exact cleanup,
   report fields, and recovery actions. Then run generation/parity checks,
   targeted tests, the feature-level quality/refactor pass, full suite,
   lint/typecheck, verification, and audit.

Scenario-to-proof matrix:

| Rule | Automated primary proof | Independent semantic proof |
| --- | --- | --- |
| NTB1.R1 | Guard executes current head-bound local verification; contract rows cover stale/failing evidence, hosted checks/reviews, draft/queue state, exit-zero unconfirmed merge, and every final report field | NTB report clarity and no false completion |
| NTB1.R2 | Retro JSON and empty-spool integration cases for zero findings, filed findings, extraction/file/spool failures, and skip requests | No prose bypass around the prerequisite |
| NTB1.R3 | Resume table for every completed prefix, remote-success/local-error, unknown results, simultaneous blockers, and completed reruns | Recovery action is complete and understandable |
| TBU1.R1 | Authority table for none/normal/admin, blocked normal merge, historical admin, and consumed authority | Current-request language is unambiguous and does not reduce TBU control |
| TBU1.R2 | Guard tests for missing/multiple/unmerged PRs, head-repository/remote mismatch and fork ambiguity, default/protected branches, worktree-first order, remote/local OID drift, absent targets, no-worktree cleanup, squash/rebase heads, and exact compare-and-swap deletion | Skill invokes the guard with PR identity, never raw deletion targets |
| TBU1.R3 | Guard tests for main, dirty, locked, detached/ambiguous, stale/prunable, and other-worktree use; every case asserts no force and no deletion | Blocker report names the preserved target and recovery |
| TBU1.R4 | Production-derived install/generator integration for Claude, Cursor, and Codex plus drift mutations at all four artifact surfaces | Independent per-host artifact walkthrough confirms the same staged behavior |

This is seven build tasks across four major components (skill contract, cleanup
guard, host distribution, and tests/docs). The user already declined splitting
this 25-scenario feature because all Rules form one ordered closeout contract.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Execution shape | One low-freedom action skill plus a preview-first exact-cleanup guard | Prose-only skill; new SafeWord closeout CLI/state machine | Prose alone is too weak for destructive git operations; a full state machine duplicates delivery lifecycle ownership and is outside scope. Agent Skills explicitly supports bundled scripts for low-freedom operations ([Agent Skills specification](https://agentskills.io/specification)). |
| Merge truth | Use structured `gh pr view --json` observations before and after any merge attempt; a command exit code never proves merge completion | Trust `gh pr merge` exit status; combine merge with branch deletion | GitHub CLI exposes PR head, merge, review, and check state as structured fields, while merge queues and auto-merge can defer completion ([gh pr view](https://cli.github.com/manual/gh_pr_view), [gh pr merge](https://cli.github.com/manual/gh_pr_merge)). |
| Cleanup truth | A digest-bound guard binds deletion to a fresh merged PR head repository/remote/ref/OID and fresh `git worktree list --porcelain`, then uses exact compare-and-swap ref deletion | Guess by similar branch/path; `gh pr merge --delete-branch`; force worktree cleanup | Git documents porcelain as the stable machine-readable worktree format and preserves dirty/locked/main worktrees unless safeguards are explicitly overridden ([git-worktree](https://git-scm.com/docs/git-worktree.html)). Combined deletion would hide the independent identity boundary. |
| Host delivery | Canonical Claude skill plus schema-managed dogfood copy, generated Cursor command, and generated Codex plugin skill | Hand-maintained host-specific workflows | The repository architecture makes templates and production catalogues the shared contract; generated adapters prevent semantic drift. |
| Scenario proof | Automated real-git guard and installed-wiring tests plus a calibrated fresh-context artifact eval | Fake Cucumber state machine mirroring the prose; self-recorded walkthrough | A parallel step implementation could pass while the shipped skill remained unsafe; self-review is correlated. Root Cucumber config intentionally excludes `@manual`, while the independent binary eval covers semantic guidance. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | One natural-language closeout request yields a plain final state report, while merge authority and technical evidence remain explicit and no administrative action is inferred. | features/close-completed-sessions-safely.feature | |
| 1. Structure enforces; instructions suggest | A digest-bound helper re-observes exact PR/ref/worktree state and refuses unsafe deletion; schema and generator tests independently prove distribution. | packages/cli/tests/closeout-cleanup.test.ts | explicit-conflict |
| 2. Fire at boundaries, not every turn | The workflow activates only when a user closes a completed session and re-observes state at merge, retro, and cleanup transitions. | packages/cli/templates/skills/closeout/SKILL.md | |
| 3. Add, never replace | The new skill is added through existing schema/reconciliation and generated-host mechanisms without replacing customer-owned configuration. | packages/cli/src/schema.ts | |
| 5. Clarity before correctness | A short staged contract delegates only the irreversible suffix to one purpose-built guard; no second lifecycle state machine is introduced. | packages/cli/templates/skills/closeout/SKILL.md | |

Architecture decisions honored: Schema as Single Source of Truth, Reconciliation
Over Copy, Agent Parity, Template Separation, and the instruction to keep
correctness-critical fallback guidance local because skill composition is soft.
No ADR is warranted: this is a reversible use of established extension points.

## Implementation reconciliation

- The deterministic guard shipped as planned, with current-HEAD verification,
  exact transcript provenance, fail-closed concurrent session binding, anchored
  GitHub remote parsing, and compare-and-swap cleanup. Refactoring separated
  binding and cleanup-planning concerns without changing the staged contract.
- Installed-host proof is derived from production schema/catalogues. Claude and
  Cursor are installed into a fixture, Codex is generated into its real profile
  layout, and all three resolve the same installed guard contract. The installed
  guard is process-exercised through its fail-closed binding boundary; separate
  real-Git tests exercise its destructive path, and production hook-adapter tests
  exercise host binding. Model interpretation of each prose entry point remains
  inside the declared hash-bound manual evidence boundary.
- Runtime adversarial review found and repaired destructive and provenance gaps before verification:
  subprocesses now survive worktree removal, remote-observation errors are
  unknown rather than absent, lookalike GitHub URLs are rejected, and concurrent
  bindings cannot overwrite or adopt another session. NUL-delimited worktree
  observation also preserves paths containing newlines or blank lines.
- The independent semantic gate is hash-bound to the final Claude, Cursor,
  Codex, guard, feature, and automated-result artifacts. Its deterministic test
  rejects stale inputs, unknown reviewers, missing or non-binary rows, and any
  failing verdict.
- The planned authority, mandatory-retro, exact-cleanup, documentation, schema,
  and host-parity decisions all held. No new state machine or ADR was introduced.

## Known deviations

`1. Structure enforces; instructions suggest`: interpreting whether the current
natural-language request grants normal or administrative merge authority remains
model-mediated. Repository policy still hard-gates normal merges, the cleanup
suffix is deterministic, admin is never inferred, and the final report exposes
the exact action. Hard transcript-to-authority enforcement would require the
excluded lifecycle state machine; reassess after the first observed authority
misclassification or before automating closeout without an interactive user.

The planned installed-host test does not run three real model sessions through
their prose entry points against one mocked GitHub process. A deterministic test
cannot make the hosts interpret prose without replacing the model with a second
implementation. Instead, production-derived installation/profile resolution,
real hook binding, real-Git guard execution, and hash-bound per-host semantic
review triangulate that boundary. Reassess if the hosts expose a deterministic
skill-invocation harness suitable for CI.

### Final refactor ledger

- Resolved independently and test-by-test: extracted retrospective failure
  classification; extracted fresh binding-record parsing and one runtime guard;
  shared mutable cleanup-target observation; centralized Cursor allow-path
  identity bookkeeping; cleaned temporary project/root fixtures; and renamed
  binding tests to the behavior they actually prove.
- Retained `pullRequests` cardinality and the two `completed` result meanings:
  multiple-match rejection is an explicit feature example, while renaming plan
  and apply result fields changes the serialized digest/output contract rather
  than preserving behavior.
- Deferred plan-level operation context and verification-lane centralization:
  both change the installed guard contract, and the standalone deployed script
  cannot import package-private protocol state without a new shipped dependency.
- Deferred extraction of the CLI main block and larger real-Git/scripted-observer
  test helpers. Current helpers are directly characterized; these extra layers
  would primarily move code and risk hiding the destructive operation order.
- Deferred a stricter typed parser for the manual Markdown evidence. Malformed
  shapes already fail closed in the release test; moving machine evidence to a
  new file format is an evidence-contract change, not a behavior-preserving
  refactor. Small fixture constants were retained where their repetition keeps
  adversarial cases locally legible.

## Doc impact

- `README.md`: document `/closeout`, the no-authority default, normal/admin
  boundary, queued and partial-success states, mandatory retro, safe cleanup,
  report fields, and recovery behavior.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: document
  Claude/Cursor invocation and Codex's scoped name, plus the same safety and
  recovery contract in a concise reference section.

## Assessment triggers

Revisit the design if SafeWord supports non-GitHub forges, cloud-session cleanup,
needs hard enforcement rather than agent guidance, loses stable structured fields
from GitHub CLI or git worktree porcelain, or observes agents violating the
staged contract despite the contract/eval gate.
