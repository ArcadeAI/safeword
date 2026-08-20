# Figure It Out: Bound generated review inputs without hiding scope

- [x] Phase 1: Frame the decision in one sentence
- [x] Phase 2: Generate 2-3 concrete options
- [x] Phase 3a: Enumerate relevant research domains (multiple)
- [x] Phase 3b: Research each named domain
- [x] Phase 4: Debate, steelman both sides, commit to one

## Frame

Should `safeword review run` reject every oversized target, or omit only
repository-declared generated targets while making the reduced review scope
visible? The choice is wrong if it weakens the packet bound or lets a caller
mistake an omitted file for a reviewed one.

## Options

1. **Keep rejecting every oversized target.** The packet builder keeps its
   current one-rule limit and a generated runtime artifact still blocks the
   entire review.
2. **Omit only explicitly generated oversized targets (recommended).** Read
   Git's `linguist-generated=true` attribute for an oversized target, retain
   every eligible target, and publish the omitted paths in the result.
3. **Truncate or guess.** Include a prefix of oversized files or infer
   generated status from paths, extensions, or sizes.

## Research plan and evidence

| Domain | Question | Evidence | Finding |
| --- | --- | --- | --- |
| Review correctness and scope traceability | Can a review be useful while some changed files remain visible as unreviewed? | [GitHub review guidance](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request) | A review must remain accountable for its file scope, so the result must name every omission. |
| Generated-artifact classification | Is there a stable, project-owned source of truth rather than a filename heuristic? | [Git attributes](https://git-scm.com/docs/gitattributes); [GitHub generated files](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) | `linguist-generated=true` is explicit, path-scoped, and already used by this repository. |
| Packet containment and resource bounds | Can an omission preserve the security and size invariants of the current review system? | `DR6M6N` scope and `packages/cli/src/review/packet.ts` | The individual and aggregate limits stay unchanged; unmarked oversized input remains a hard rejection. |
| Operational recovery | What happens when no eligible source remains? | `packages/cli/src/review/coordinator.ts` routing contract | An empty packet must fail before a reviewer launches; it cannot earn an approval. |

## Debate and decision

**Steelman option 1:** It is the smallest and safest policy: every supplied
target is either in the packet or causes a hard stop. It loses because a known
deterministic output blocks independent review of the authored inputs without
improving review accuracy.

**Steelman option 3:** Truncation or a heuristic would make more commands
complete. It loses because a partial source has no honest review meaning, while
filename guesses make exclusion non-deterministic and easy to misuse.

Option 2 is correct because it preserves both existing byte limits and the
unmarked-file failure; it is elegant because one Git-owned marker decides the
exception; and it has low ongoing cost because the result already has findings
and machine-readable data.

> Recommend **explicit attribute-based omission** because it is the only
> option that keeps bounded packets while making every exception auditable.
> The hard-reject option was close on simplicity but loses on reviewing real
> authored changes. Cite: [Git attributes](https://git-scm.com/docs/gitattributes).
>
> **Premortem:** A maintainer marks real source as generated and it is skipped;
> mitigate by accepting no heuristics, reporting every excluded path, rejecting
> all-excluded input, and proving unmarked oversized input still fails.
>
> **Next:** Add packet-selection tests in `packages/cli/tests/review/packet.test.ts` before changing `packages/cli/src/review/packet.ts`.

## Follow-up: isolation and resource bounds

Plan review found that a normal `git check-attr`, including `--cached` and
`--source=HEAD`, still lets `.git/info/attributes` override a checked-in
`.gitattributes` marker. The final boundary is a disposable bare Git directory
with the real repository's object database supplied as an alternate and
`check-attr --source=<HEAD-commit>`. Its empty `info/attributes`, disabled
system/global configuration, and committed tree make the policy input
immutable: neither local Git overrides nor a working-tree attribute rewrite
can alter classification. A local experiment on 2026-08-12 proved the
isolated query returns committed `true` when both the live `.gitattributes`
and real repository info attribute say `false`.

For content safety, reading and hashing every oversized target would keep
memory bounded but leaves I/O unbounded for a sparse or arbitrarily large
artifact. The chosen policy therefore uses `lstat`/containment metadata before
classification and never reads an oversized target that is ultimately omitted.
UTF-8 validation applies to content that enters the packet, not a file whose
bytes are deliberately kept outside the reviewer boundary. This keeps the
existing 256 KiB per-target resource bound meaningful while retaining the
regular-file, containment, committed explicit-marker, and visible-scope
safeguards.
