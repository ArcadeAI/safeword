# Impl Plan: Finish accepted changes before asking for PR review

**Status:** planned
**Planned on:** 2026-09-12

## Approach

**Riskiest assumption → cheapest proof.** The shared shell gate must distinguish a
Ready-making GitHub CLI command from Draft creation, then resolve trustworthy
delivery evidence after the active ticket binding has cleared or the agent
session has restarted.
The cheapest load-bearing proof invokes `pre-tool-quality.ts` in a temporary
Safeword project: an unfinished ticket denies `gh pr ready`, a fresh session at
the verified close commit allows it, and `gh pr create --draft` remains allowed.

Build in four slices:

1. **Ready command and evidence gate.** Add a pure hook-lib classifier for the
   named `gh pr ready` and ready-by-default `gh pr create` argv shapes, including
   shell segments, execution prefixes, `--undo`, and Draft flags. Extend quality
   state with a recent completed-ticket ID when a ticket closes, retained after
   `activeTicket` auto-clears and also used as the pending receipt-finalization
   identity. After the
   successful close commit changes HEAD, atomically finalize a worktree-durable
   namespace-root `readiness-ticket.json` receipt containing that ticket ID and
   full commit SHA. The Ready gate prefers active work; otherwise it accepts only
   a receipt whose SHA equals current HEAD and whose ticket plus `verify.md`
   revalidate from disk. Evaluation order is fixed: if a session has an active
   ticket binding, validate that ticket and do not fall through; otherwise, if
   the session has a recent completed-ticket ID, validate that ticket; otherwise,
   if a readable receipt exists, resolve its ticket before checking SHA freshness
   and evidence; otherwise deny because no delivery ticket resolves. The accepted
   "missing ticket" case therefore means no active binding, recent-completion
   identity, or readable receipt resolves a ticket.
   Missing, stale, unresolved, unfinished, or unreadable evidence denies with a
   plain recovery action.

   Add a verification-completion helper used by `/verify`: a successful initial
   verification records the ticket as pending until the existing close-commit
   observer can bind the receipt to the resulting HEAD; the observer records the
   recent-completion identity even for an externally introduced malformed
   `status: done`, so the Ready denial can name missing or unreadable verification
   after `activeTicket` has actually auto-cleared. A successful re-run on
   an already-`done` ticket atomically finalizes the receipt at the current full
   HEAD immediately, with no follow-up commit required. Thus a docs/fixup commit
   after close is denied until `/verify` is rerun, then the same unchanged HEAD is
   allowed. The transient basename is added to the schema-owned ignore/untrack
   list; install preserves it, uninstall may remove it with other transient
   state, and SHA mismatch makes stale receipts inert without eager deletion.
   Primary proof: hook-process integration tests over active, just-closed,
   fresh-session, stale-HEAD, **HEAD advanced after close then re-verified and
   allowed without another commit**, ticket-state, PR-state, and recovery-message
   cases. The done-without-verification and unreadable-verification cases run the
   real post-tool auto-clear first, then assert their exact recovery text; they
   do not hand-seed an impossible active binding. Supporting proof: fast
   classifier/receipt unit tables. The existing
   Claude pre/post-tool entry points form the wiring proof. The R3 NTB hook case
   additionally rejects denial text containing any accepted forbidden term:
   `RED`, `GREEN`, `refactor`, `reconciliation`, or `audit`.
2. **Host and install parity.** Route Ready-making commands through Cursor's
   fail-closed shell adapter; Codex and Claude already translate shell calls into
   the shared entry point. Register the new hook lib in the schema and prove
   fresh/update installs add it only for enabled hosts while preserving existing
   configuration. Amend **Deterministic Readiness Evidence Status** in
   `ARCHITECTURE.md` to distinguish this locally verifiable delivery gate from
   the rejected use of a hook as a substitute for PR-body freshness. Amend
   **Project-Default Claude Plugin Declarations and Project-Bound Proof** in
   place with a superseded-in-part note for the single host-neutral, per-worktree
   receipt and its restored ignore/untrack carve-out. Primary proof:
   install/reconciliation integration tests. Add a Cursor entry-point
   hook-process case that sends Ready through `before-shell-execution.ts` and
   asserts the shared denial is mapped to Cursor's native deny result. Add
   a Codex-shaped `Bash` hook-process case that enters through the installed
   PreToolUse adapter with `gh pr ready`, reaches `pre-tool-quality.ts`, and
   returns its denial; generated Codex-plugin parity tests separately prove that
   runtime is bundled in the profile plugin. This covers Claude Code, OpenAI
   Codex, Cursor, and Safeword CLI.
3. **Closure and recovery substrate.** Reuse the existing done gate and phase
   transition hooks for verification evidence and open/done status: extend their
   integration lane to prove successful verification permits recorded closure,
   failed or missing verification leaves the ticket open, and a close commit
   finalizes the exact-HEAD readiness receipt. Reuse dependency-readiness's
   manifest/lockfile classification for the distinction between an authorized
   repair and a dependency requiring user authority. Recovery remains the
   existing instruction-tier boundary contract: the installed workflow requires
   the agent to retain the blocked step and exact recovery action in the
   conversation or ticket work log, suppress ordinary advancement while it is
   outstanding, and resume that same step after completion. No new hook-owned
   recovery state is introduced because the accepted scenarios distinguish
   deterministic hook assertions from workflow directives. Primary proofs:
   `phase-derivation.test.ts`, `status-close-gate.test.ts`,
   `dependency-readiness.test.ts`, and a new installed-surface
   `delivery-continuation-contract.test.ts` table covering both interrupted
   steps, every recovery-state row, authorized versus unauthorized dependency
   handling, and the R4 NTB forbidden-vocabulary list (`RED`, `GREEN`,
   `refactor`, `reconciliation`, `audit`). Completed-decision recovery rows must
   assert the required decision text is absent; outstanding rows assert it is
   present, so one generic recovery string cannot satisfy all four rows.
4. **Uninterrupted delivery guidance.** Tighten the canonical BDD and
   PR-readiness skills so successful RED/GREEN work continues through refactor,
   whole-ticket review, plan reconciliation, verification, audit, closure, and
   only then readiness classification; failed checks remain at their step,
   Draft evidence returns to delivery, and genuine boundaries retain an exact
   resumable recovery action. Installed-surface contract tests assert the exact
   instruction reaches Claude's installed skill, Cursor's generated rule/command
   surface, and the generated Codex reference at TDD-step exit, Draft return,
   closeout, and prompt-time recovery. R1's unhealthy RED/GREEN rows assert the
   following step is absent as well as the current failing step being present.
   This is the highest practical proof for instruction-tier behavior:
   deterministic tests prove the exact canonical contract and its host delivery,
   while model compliance is why the irreversible Ready operation also has a
   hard gate. Regenerate the Codex plugin and
   reconcile the dogfood install after canonical template changes.

The 21 accepted scenario headings collapse into those four actor-boundary proof groups
rather than 25 duplicate implementations: slice 1 covers R3 state and command
partitions, slice 2 covers the host/install matrix, slice 3 covers R2's
verification/closure outcomes and R4's dependency/recovery partitions, and
slice 4 covers R1, R2, and R4's surfaced directive chain. Each Scenario Outline
row remains an explicit table case in its owning test.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://code.claude.com/docs/en/hooks | 2026-09-12 | Current Claude Code hooks reference | Current Safeword Claude hook plus normalized Codex and Cursor adapters | PreToolUse runs before a tool call and can deny it, matching the irreversible Ready boundary | Put the deterministic denial at the pre-tool boundary and keep recovery guidance in the returned reason | Host-specific protocol; no source code reused, and Codex/Cursor continue through existing adapters |
| `packages/cli/templates/hooks/codex/pre-tool-quality.ts` | 2026-09-12 | Repository current HEAD | Generated Codex plugin PreToolUse runtime | It translates Codex `Bash` input into the shared Claude-shaped gate and preserves denial semantics | Extend the shared gate; keep Codex as a thin transport adapter | In-repo evidence, generated into the versioned plugin; do not hand-edit generated output |
| `packages/cli/templates/hooks/cursor/before-shell-execution.ts` and `cursor/gate-adapter.ts` | 2026-09-12 | Repository current HEAD | Cursor `beforeShellExecution` runtime | Cursor already delegates selected fail-closed shell commands to `pre-tool-quality.ts` and maps denial to its native protocol | Add Ready classification to `requiresFailClosedShellGate`; do not duplicate ticket evaluation | In-repo evidence; adapter timeout/crash behavior remains independently fail-closed |

**Decision impact:** changed: readiness moves from skill guidance alone to the
existing deterministic pre-tool boundary, while authority and Draft behavior
remain in the skill contract.
**Decision informed:** Ready promotion enforcement

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Ready promotion enforcement | One pure GitHub CLI classifier and ticket-evidence evaluator behind the shared pre-tool gate | Guidance only; a new wrapper command; blocking every PR command | Guidance is bypassable; a wrapper misses direct `gh`; blocking every PR command removes the accepted Draft evidence path. Current hook guidance: https://code.claude.com/docs/en/hooks |
| Completed-delivery evidence | Finalize an exact-HEAD, worktree-durable namespace-root receipt after the verified close commit; `/verify` immediately refreshes it at unchanged current HEAD for an already-done ticket; active work takes precedence over the session's recent completion, which takes precedence over a readable receipt | Store under a user-profile/plugin data directory; keep completed tickets active; keep only session state; globally scan for the newest done ticket; allow when no active ticket exists | Readiness is worktree and HEAD scoped, so profile/plugin state would need another identity mapping and cleanup protocol; keeping it active breaks new-ticket binding; session-only state strands restart; a global scan crosses branches and sessions; fail-open absence violates the accepted readiness invariant |
| Post-GREEN continuation | Express one explicit canonical chain in the existing BDD and PR-readiness skills, backed by their current phase artifacts and hooks | Add a new workflow state machine; duplicate host-specific instructions | Existing ticket phase, ledger, verification artifact, and host adapters already represent the state; another machine or three copies would add drift without new enforcement |

No dependency is added; the design uses Bun/TypeScript, Node standard-library
filesystem APIs, and the repository's existing shell tokenizer and hook adapters.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Denials say the change is unfinished and name one next action; Draft evidence and direct technical controls remain available | `packages/cli/tests/integration/pr-readiness-delivery-gate.test.ts` | |
| 1. Structure enforces; instructions suggest | Ready-making `gh pr` commands are denied before execution unless exact-HEAD ticket evidence is verified done. The trust root is the existing done gate's agent-authored `verify.md` contract: this makes forgetting deterministic, not a defense against a malicious agent already inside that trust boundary. | `packages/cli/tests/integration/pr-readiness-delivery-gate.test.ts` | |
| 2. Fire at boundaries, not every turn | The added gate runs only for Ready-making shell commands; ordinary shell and non-Ready `gh pr` commands bypass it, while delivery guidance advances only at named workflow transitions | `packages/cli/tests/hooks/pr-readiness-guard.test.ts` and `packages/cli/tests/skills/delivery-continuation-contract.test.ts` | |
| 3. Add, never replace | Installation registers the shared lib and extends enabled-host lifecycle configuration without replacing customer configuration | `packages/cli/tests/integration/pr-readiness-install.test.ts` and `packages/cli/tests/parity.test.ts` | |
| 5. Correct and safe; then clear; then simple | One classifier and one evaluator serve all hosts, with no new dependency or duplicate host logic | `packages/cli/tests/hooks/pr-readiness-guard.test.ts` | |

Architecture decisions honored: **Registry-Driven Agent Integrations with Native
Trust Boundaries** keeps one shared project gate with native adapters;
**Active ticket resolution** remains session-scoped and disk-revalidated while
the recent completion preserves session-local diagnostic identity after
auto-clear and the completed receipt is worktree-scoped and exact-HEAD;
**Deterministic
Readiness Evidence Status** is amended in place to carry the complete decision
for the new local boundary: its context and alternatives distinguish the
unverifiable PR-body-freshness proposal it rejected from this disk-verifiable
ticket-completion gate, and its decision/consequences record exact-HEAD receipt
trust, precedence, scope, and recovery. It remains the PR-head freshness
observer and is not replaced by this local delivery gate. A separate ADR would
split one readiness trust decision across two records, so the accepted record
is expanded rather than duplicated. Shared hook libraries stay pure where
practical; schema remains the installation source of truth; generated Codex
plugin files remain generated rather than hand-edited. The receipt is an
additive transient record finalized by the existing post-tool commit observer,
not a second workflow state machine. No ADR is warranted because this is a
reversible extension of those accepted mechanisms.

## Known deviations

- Enforcement is intentionally limited to the accepted local `gh pr ready` and
  ready-by-default `gh pr create` argv shapes. `gh api`, direct REST/GraphQL,
  GitHub web UI, and cloud-agent mutations remain outside this local hook's
  boundary; the skill still requires explicit authority for any Ready change.
  This does not reverse **Deterministic Readiness Evidence Status**: that ADR
  rejected a CLI hook as a substitute for observing freshness of
  attacker-controlled PR-body attestation text. This gate instead validates
  local ticket status and verification artifacts the hook can read, and its
  accepted scope is local agent CLI execution. The existing commit status keeps
  covering PR-head evidence freshness and the UI-visible surface; neither
  mechanism claims the other's job.
- `readiness-ticket.json` deliberately lives under the project namespace root,
  even though it is transient, because the authority it represents belongs to
  one checkout's ticket corpus and exact Git HEAD. This consciously revives one
  narrowly scoped working-tree transient mechanism retired by **Project-Default
  Claude Plugin Declarations and Project-Bound Proof**. That record's profile
  state is Claude-specific, while this proof must be host-neutral; a profile or
  plugin data location would cross worktrees and require a second worktree-
  identity and garbage-collection protocol. Exactly one receipt file exists per
  worktree and each successful finalization atomically replaces it. Schema-owned
  ignore/untrack handling keeps it out of customer commits.
- Exact-HEAD binding is intentionally stricter than the broad accepted “verified
  done” allow scenario: a later docs/fixup commit makes prior verification stale
  even though the ticket still says `done`. Ready is denied until `/verify`
  succeeds again and atomically refreshes the receipt at the unchanged current
  HEAD. This conservative deviation prevents old evidence from authorizing new
  bytes and requires no extra commit.
- The scenario packet includes preservation and disabled-host installation
  checks because a gate that damages unrelated lifecycle configuration would
  violate the project's install contract, even though those checks are broader
  than R3's narrow Ready invariant.
- OpenCode remains able to run these Ready-making commands because this ticket's
  accepted host set excludes it. Add it when its stable local pre-shell adapter
  can run the shared classifier and hook-process parity proof.

## Doc impact

- Update the shipped BDD and PR-readiness skill text in
  `packages/cli/templates/skills/`; those files are the customer-facing workflow
  documentation for this behavior.
- `README.md` and `packages/website/src/content/docs` need no change: this ticket
  changes an internal delivery invariant and existing hook behavior, not the
  installation surface or a user-invoked command.

## Assessment triggers

- GitHub CLI introduces another first-class Ready mutation under `gh pr` or
  changes Draft flag semantics.
- A supported host stops exposing a blockable pre-shell/pre-tool boundary.
- Readiness must survive a different worktree, clone, or machine; the local
  exact-HEAD receipt intentionally survives sessions only within one worktree.
- A supported local REST/GraphQL entry point enters accepted scope; replace argv
  classification with an operation-level boundary rather than growing aliases.
- Hook latency shows ticket/evidence reads are material at Ready invocation; add
  measured caching only with invalidation proof.
