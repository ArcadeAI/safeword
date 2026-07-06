# Spec: Boundary reconciliation gate — engine + local hook (slice 1 of #810)

Issue #810 · epic #808 keystone. Slice 1 of 3: the reconciliation engine, the
`safeword boundary` command, and dogfood wiring in safeword's own repo.
Children to follow: host-repo installation (setup/upgrade emission); server-side
required check (workflow template + `--at pr` hard-block + ruleset docs).

## Intent

At the moments work leaves the machine — commit and push — reconcile workflow
state against its committed evidence (phase legality, anchors, ledger, verify.md)
and warn-and-record. One versioned engine behind one CLI command, so the git
hooks (now) and the server-side required check (child ticket) are thin callers
of the same code path.

## Intake Brief

- **Requested by:** alex (TheMostlyGreat) — epic #808's G5 keystone ("the one moment a one-shot session cannot skip").
- **Cost of inaction:** #809's anchors are evidence nobody checks — forgery-resistance currently ends at a zero-exit advisory, and a one-shot session still ships unreconciled or forged workflow state exactly as in the #644 audit.
- **Reversibility:** Mixed. Engine + command + dogfood hook lines are two-way doors. The audit-record shape is one-way-adjacent (future tooling parses it) — kept minimal JSONL. Host-repo installation (the genuinely one-way surface) is deliberately NOT in this slice.

## References

- #810 (issue: mechanism, folded checks, warn-vs-block rule) · #808 (epic constraints) · #644 (the audit this all answers).
- Friction register on #810 (2026-07-06): squash-merge orphaning, prior-HEAD anchor semantics, shallow-clone fetch depth, re-advance last-wins — all constraints on this engine's checks.
- #809 substrate: `detectUnanchoredPhaseTransition` + injected `ShaResolver` seam (built for this gate, currently uncalled); `detectUnanchoredPhaseState`; `validateLedger` + `createLedgerShaResolver`; `evaluateTicketWrite`.
- Design research (this session): husky v9 `core.hooksPath` (one-line-shim requirement); GitHub rulesets required-workflow GA (child 3's home); hook-perf budgets (sub-second pre-commit, heavier pre-push, minutes → CI only).

## Personas

- Safeword Maintainer (SM) — needs the epic's enforcement promise to hold on safeword's own repo first.
- Technical Builder (TB) — their repos eventually get this gate (child 2); this slice must honor the standing promise: guardrails fire during agent sessions and **never block their own hand-written commits**.

## Surfaces

Affected:

- skip: none tagged — the engine is a CLI command + git-native hooks, identical across agent runtimes; slice 1 wires only safeword's own repo. (Rides-on/environment coverage handled in dimensions.md per #888's method.)

Unaffected:

- Claude Code / Cursor / Codex per-harness hooks — this gate is deliberately harness-independent (git-native), per the epic's mechanism constraint.

## Vocabulary

- **Boundary** — a moment work leaves the machine: commit, push, PR. Slice 1 covers commit + push.
- **Reconciliation** — re-running the workflow's evidence checks against the repo's committed/staged state, as opposed to trusting write-time gates or local logs.
- **Warn-and-record** — the local tier's behavior: report findings, append them to the audit record, never exit non-zero.
- **Audit record** — `.safeword/boundary-audit.jsonl`, gitignored, append-only; context for humans and retro, never trusted as evidence (the server tier re-derives instead).

## Jobs To Be Done

### boundary-reconciliation-gate.SM1 — Catch unreconciled workflow state before it ships

**Persona:** Safeword Maintainer (SM)

> When a session commits or pushes work involving a ticket, I want the
> workflow's evidence checks re-run at that boundary and any gaps reported and
> recorded, so a divergent session leaves a visible trace at the one moment it
> cannot skip — instead of shipping silently as in #644.

#### boundary-reconciliation-gate.SM1.AC1 — A commit touching ticket artifacts gets its evidence reconciled and gaps reported

Pre-commit, sub-second: for staged ticket artifacts, phase legality (including
born-past-intake at rest), anchor presence + format, ledger annotation shape,
and verify.md shape are re-checked; findings print as warnings and append to
the audit record. The commit is never blocked.

#### boundary-reconciliation-gate.SM1.AC2 — A push additionally verifies evidence against git history

Pre-push adds the history-backed checks: the entered phase's anchor and the
ledger's step SHAs must be real commits reachable from what's being pushed —
and evidence recorded before an ordinary rebase still verifies rather than
false-flagging (the friction register's squash/rebase and entered-phase-only
constraints). Warn-and-record; never blocks.

#### boundary-reconciliation-gate.SM1.AC3 — Every finding lands in a durable local audit record

Each boundary run appends one JSONL entry (boundary, timestamp, HEAD, per-check
verdicts) to `.safeword/boundary-audit.jsonl`; the record accumulates across
sessions and is inspectable by humans and retro.

### boundary-reconciliation-gate.TB1 — Never pay for the gate on ordinary work

**Persona:** Technical Builder (TB)

> When I commit my own hand-written changes that touch no ticket artifacts, I
> want the boundary gate silent and effectively free, so safeword's guardrails
> keep their promise of never taxing or blocking my own commits.

#### boundary-reconciliation-gate.TB1.AC1 — A commit with no ticket artifacts staged is silent and fast

No warnings, no audit entry (or a no-op entry at most), sub-second exit 0 —
regardless of what else is in the diff.

#### boundary-reconciliation-gate.TB1.AC2 — The gate never turns a warning into a block

Exit code is 0 on findings at both commit and push boundaries; `--no-verify`
therefore never needs to be reached for. (Hard-blocking is the server-side
child's job, on cheap-to-attest committed evidence only.)

## Rave Moment

skip: inherited — the epic-level moment belongs to #808 (an agent's forged
"done" caught red-handed at the PR boundary); this slice is its plumbing.

## Outcomes

- `safeword boundary --at commit|push` runs the reconciliation engine over the staged/committed ticket artifacts and reports per-check verdicts.
- Safeword's own `.husky/pre-commit` and `.husky/pre-push` invoke it as one-line steps (dogfood).
- Findings append to `.safeword/boundary-audit.jsonl`; ordinary non-ticket commits stay silent and sub-second.
- The engine reuses the existing pure checks + injected resolvers — no duplicated validation logic; the #809 resolver seam gains its intended caller.
- Friction-register constraints hold: entered-phase-only anchor validation, prior-HEAD semantics documented, re-advance last-wins pinned by test.

## Open Questions

- defer: exact JSONL entry schema beyond (boundary, timestamp, HEAD, verdicts) — settled at implement against jsonl-spool.ts's existing shape; additive later, per the minimal one-way-door posture.
