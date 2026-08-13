# Spec: Make closeout preview and apply converge for merge sessions

## Intent

Let the same agent task that merged and verified a pull request complete its mandatory retrospective and exact cleanup without invalidating its own authorization, while preserving every fail-closed boundary.

## Intake Brief

- **Requested by:** Safeword maintainer through GitHub issues #2431, #1852, and #1826
- **Cost of inaction:** Clean merged worktrees remain stranded, and mandatory retrospective filing can enter a non-converging loop.
- **Reversibility:** Two-way door; the digest projection and recovery evidence can be revised without migrating user data.

## References

- https://github.com/ArcadeAI/safeword/issues/2431
- https://github.com/ArcadeAI/safeword/issues/1852
- https://github.com/ArcadeAI/safeword/issues/1826
- https://github.com/ArcadeAI/safeword/issues/1942 (closed regression contract)

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)

## Surfaces

Affected:

- OpenAI Codex
- Closeout cleanup guard
- Retro filer

Unaffected:

- Merge authority — no authorization rules change
- Claude Code and Cursor identity adapters — existing hook-bound behavior remains authoritative

## Vocabulary

- **Sealed retrospective evidence:** a bounded transcript snapshot whose extraction and filing result is recorded before cleanup authorization.
- **Bounded post-seal delta:** the append-only transcript window selected by the existing retrospective extractor from the sealed character offset through the exact end of file observed when extraction begins. Reporting emitted after an invocation returns belongs to the next invocation and cannot retroactively invalidate a completed mutation.
- **Cleanup authorization:** the digest-bound immutable pull-request identity and exact cleanup targets approved in preview.
- **Bootstrap task:** a Codex task that started before it installed or upgraded the closeout binding hook. A host session is the runtime identity boundary used to authenticate that task.
- **Canonical transcript:** the unique host-owned transcript whose embedded identity matches the authenticated current task.
- **Consumable hook binding:** a fresh, single-use host proof naming the exact task, project root, and transcript when the host supplies one. A consumed proof is never accepted again; Codex may independently recover the same task through its authenticated current-task identity.
- **Spool / drain:** a project-local sealed-draft queue and the code-owned removal of drafts only after durable filing acknowledgement.
- **Preferred filer:** the separate retro-filer agent that runs after closeout reports pending drafts; closeout itself never files tracker issues inline, so an invocation with a new draft blocks until a later authenticated filing acknowledgement.
- **Trusted continuation:** a host-authenticated recovery handoff that reports the exact canonical retro-draft spool path to the supported fallback without caller discovery. The fallback may run from another active worktree or session; the shipped helper validates the path shape, symlinks, sealed bodies, acknowledgements, and drain operation independently of the caller's working directory.
- **Repository ownership boundary:** the canonical Git common directory shared by linked worktrees. A separate clone has a different ownership boundary even when it has the same remote.
- **Validated spool:** the continuation-named canonical `.safeword/retro-drafts/*.jsonl` file after path, symlink, and sealed-body checks.
- **Finding signature:** the canonical content-derived retrospective signature used by the existing spool and acknowledgement ledger to recognize the same finding across overlapping transcript windows.
- **OpenAI Codex Desktop:** the desktop Codex host, which authenticates the current task through `CODEX_THREAD_ID` even when that task began before a consumable hook binding was installed.

## Product Inspiration

### Product Unsuccessful Search

| Customer job | Framed question | Products attempted | Source categories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Complete exact cleanup after a mandatory transcript retro | Which established tool seals mutable audit input separately from destructive target authorization? | git clean-up tooling and transaction concepts | local product contract and issue history | closeout snapshot digest transaction transcript evidence | 2026-08-11 | Existing Safeword closeout feature, issues #2431/#1852/#1826/#1942 | No comparable product combines host-session transcript evidence with exact Git worktree cleanup | Keep Safeword's compare-and-swap cleanup model and separate mutable retro progress from cleanup target authorization |

## Jobs To Be Done

### closeout-preview-apply-convergence.NTB1 — Finish a merged task without procedural dead ends

**Persona:** Non-Technical Builder (NTB)

> When my agent has merged and verified a pull request, I want the same task to finish its required retro and cleanup, so I can trust that “done” is actually done without learning recovery internals.

#### closeout-preview-apply-convergence.NTB1.R1 — Preview and apply converge on one bounded retrospective result

#### closeout-preview-apply-convergence.NTB1.R2 — Bootstrap and linked-worktree tasks receive an exact supported identity path

### closeout-preview-apply-convergence.TBU1 — Preserve exact cleanup and filing guarantees during recovery

**Persona:** Technical Builder (TBU)

> When closeout evidence or filing changes between invocations, I want immutable targets revalidated independently from bounded retro progress, so recovery remains safe and auditable.

#### closeout-preview-apply-convergence.TBU1.R1 — Authenticated filing evidence converges across worktree and session boundaries

#### closeout-preview-apply-convergence.TBU1.R2 — Repository or cleanup-target drift still prevents mutation

## Rave Moment

skip: table-stakes

## Outcomes

- A preview can be reported and then applied from the same task without a retro evidence loop.
- Successful no-finding and acknowledged-filing retros are reusable.
- Codex bootstrap sessions either bind exactly or receive a command they can execute safely.
- Cross-worktree filing retains provenance and drains only acknowledged drafts.
- Cleanup remains compare-and-swap safe.

## Open Questions

skip: the user's scenario contract resolves product behavior; implementation choices remain for the plan phase.
