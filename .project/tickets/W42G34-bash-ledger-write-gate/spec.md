# Spec: Gate Bash-channel writes to the R/G/R ledger (#644 G3)

## Intent

The SHA-or-skip annotation rules for `test-definitions.md` are enforced only on the
Edit/Write/MultiEdit path (`pre-tool-quality.ts` → `collectNewTransitions`). The Bash branch
of the same hook inspects nothing but `git commit`, so `sed -i 's/^- \[ \] /- [x] /'` mutates
the ledger unvalidated. This feature closes that channel: a Bash command that writes to a
ledger file is denied at PreToolUse and directed to the Edit channel, where the existing
transition gate can see and validate the change. Read-only references pass untouched.

The gate is honest about its limits: shell cannot be statically validated (variables, eval,
substitution, script files escape any parser), so the design forces mutations onto the
inspectable channel rather than simulating shell. What the predicate cannot catch is
documented in the module, and the done-gate's distinct-SHA validation remains the backstop.

## Intake Brief

- **Requested by:** Safeword Maintainer (issue #644 G3, session audit of GH628F) — remediation
  item delegated to this session with intent pre-approved.
- **Cost of inaction:** the write-time ledger gate is decorative. Any session can tick every
  R/G/R checkbox with one `sed -i` and commit a counterfeit ledger — which already happened
  (#644: 24 boxes, no SHAs, pushed). Unenforced ledgers train future sessions to fake them (G8).
- **Reversibility:** two-way door. A hook predicate + denial message; removing it restores
  today's behavior. No data model, no public API, no migration.

## References

- Issue #644 (G3; G8 precedent-normalization; #586 RED-commit friction context).
- Design decided via `/figure-it-out` (2026-07-03): deny Bash-channel ledger writes
  (channel-forcing) over simulate-and-validate (shell static analysis is provably incomplete —
  HotOS'25 "Static Analysis for Unix Shell Programs") and over PostToolUse detect-and-repair
  (cannot deny; damage already on disk and committable, which is exactly how G3 shipped).
- Load-bearing source: `pre-tool-quality.ts:249` (Bash branch), `lib/checkbox-transitions.ts`
  + `lib/parse-annotation.ts` (the Edit-path verdicts being protected),
  `cursor/gate-adapter.ts:247` (`requiresFailClosedShellGate` — the Cursor pre-filter that
  must widen, and the in-repo precedent for conservative shell segmentation).
- Structural template: the phase-provenance gate (lib module + hook wiring +
  `tests/hooks/*.test.ts` + `features/*.feature`, template↔dogfood parity) — shipping on the
  parallel G1/G4 branch; pattern followed here, no code dependency.

## Personas

- **Technical Builder (TB)** — their agent sessions get a ledger that can't be bulk-ticked;
  when the gate fires on a legitimate command they can reroute in one step.
- **Non-Technical Builder (NTB)** — cannot audit the diff; the ledger IS their evidence that
  TDD happened. They never see the gate; they inherit a trustworthy ledger.
- **Safeword Maintainer (SM)** — owns the gate; wants one shared predicate across the three
  harnesses and documented detection limits, not a shell interpreter to maintain.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Claude Code on the Web — same hook wiring as Claude Code; no cloud-lifecycle-specific
  behavior in this gate.
- OpenAI Codex Cloud / Cursor Cloud Agents — same repo-local hook configs as their local
  counterparts; nothing in this gate depends on the container lifecycle.

## Vocabulary

- **Ledger file** — a `test-definitions.md` under the project namespace's `tickets/` tree:
  the R/G/R record whose checkboxes carry SHA-or-skip annotations.
- **Write-shaped reference** — a command construct that names a ledger file as a mutation
  target: in-place edit flags (`sed`/`gsed`/`perl -i`), output redirection (`>`, `>>`,
  `&>`, `>|`, fd-prefixed), `tee`, a move/copy/install destination (positional or
  `-t <dir>`), `truncate`, or an inline interpreter invocation that names the path.
- **Channel-forcing** — denying the uninspectable channel (Bash) so mutations must travel
  the channel whose payload the gate can validate (Edit/Write/MultiEdit).

## Jobs To Be Done

### bash-ledger-write-gate.SM1 — Ledger discipline survives channel choice

**Persona:** Safeword Maintainer (SM)

> When an agent session marks R/G/R progress, I want the write-time annotation rules to hold
> no matter which tool channel touches the ledger, so a one-line shell command can't
> counterfeit the evidence trail my gates and reviews stand on.

#### bash-ledger-write-gate.SM1.AC1 — A Bash command that writes to a ledger file is denied at write time

#### bash-ledger-write-gate.SM1.AC2 — Read-only and unrelated Bash commands are unaffected

#### bash-ledger-write-gate.SM1.AC3 — The same enforcement reaches all three harnesses (Claude, Codex, Cursor)

### bash-ledger-write-gate.SM2 — Honest detection limits

**Persona:** Safeword Maintainer (SM)

> When I audit what this gate can and cannot catch, I want its blind spots stated in the
> module and its verdict conservative (deny only on evidence of a write target), so I trust
> the gate's silence to mean "nothing detectable" rather than "nothing happened".

#### bash-ledger-write-gate.SM2.AC1 — Detection limits are documented where the predicate lives

#### bash-ledger-write-gate.SM2.AC2 — Only write-shaped references deny; mere mention of the path does not

### bash-ledger-write-gate.TB1 — A block that unblocks

**Persona:** Technical Builder (TB)

> When the gate denies my shell command, I want the denial to name the sanctioned channel and
> why the Bash channel is closed, so I can complete the same intent immediately without
> reverse-engineering the gate.

#### bash-ledger-write-gate.TB1.AC1 — The denial message names the Edit channel as the next action and the validation reason

## Rave Moment

skip: table-stakes — an enforcement gate correctly denying a bypass is expected behavior;
nobody screenshots a hook doing its job.

## Outcomes

- The exact command from #644 (`sed -i 's/^- \[ \] /- [x] /' …/test-definitions.md`) is
  denied at PreToolUse on all three harnesses.
- `grep`/`cat`/`git diff` and commands not referencing a ledger file pass with zero added
  friction.
- One pure, unit-tested predicate module shared by the Claude gate (source of truth for
  Claude + Codex) and the Cursor `requiresFailClosedShellGate` pre-filter.
- The module documents uncatchable forms (variable paths, eval, substitution, script files)
  and names the done-gate as backstop.

## Open Questions

(none — design converged via /figure-it-out before scope; remediation prompt pre-answered
intent, scope boundary, and branch coordination)
