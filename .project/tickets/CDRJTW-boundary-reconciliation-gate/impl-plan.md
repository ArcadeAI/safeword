# Impl Plan: Boundary reconciliation gate — engine + local hook (CDRJTW)

**Status:** planned

## Approach

**Riskiest assumption → cheapest proof.** The design rests on: the command can
reliably determine *which ticket artifacts are in this change* at both tiers —
staged content vs HEAD's version at commit (`git diff --cached` + `git show
HEAD:path`, cheap object access, no history walk), and the outgoing range at
push (upstream when set; full unpushed history for a first push) — and feed
prior/proposed content pairs into the existing pure checks. Cheapest proof is
scenario 1, **"A staged ticket change with clean evidence passes quietly and is
recorded"**: it exercises discovery → composition → verdicts → audit append
end-to-end at the commit tier. If the change-discovery model is wrong, slice 1
fails first and cheapest.

**Proof plan.** Two layers, per `testing/SKILL.md`'s highest-practical-scope
rule:

- **Command tests (primary proof for every scenario):** `runCli(['boundary',
  '--at', ...])` against temp git repos (the `check.test.ts` + provenance-steps
  harness pattern) — real git, real staged changes, real ranges; mocking only
  the process boundary. This is the wiring proof: config → command → engine →
  git → audit file. Scenarios needing history fixtures (rebase canonicalization,
  unreachable SHA, no-upstream push, resolver failure via a corrupted objects
  path or PATH-shadowed git) get purpose-built repo fixtures.
- **Unit tests (supporting):** the pure engine — artifact-set discovery from a
  file list, check composition, verdict/audit-entry model — over fixture
  content with stub resolvers, for the combinatorial partitions the command
  layer would repeat expensively (per-check grouping, multi-ticket grouping,
  indeterminate verdicts).
- **Cucumber lane:** the .feature's step definitions shell out to the real CLI
  in temp repos (same shape as the command tests — acceptance-level duplication
  is the lane's job, kept thin).
- **Dogfood wiring:** one-line shims in this repo's `.husky/pre-commit` /
  `pre-push`; proven live by this ticket's own subsequent commits plus one
  assertion test that the shim lines exist and reference the command.

**Build order** — each slice builds on green:

1. **Engine core + clean-pass commit tier (load-bearing):** change-discovery
   (staged file list → ticket-artifact set → prior/proposed pairs), check
   composition over the existing pure functions, verdict model, audit append.
   Proves scenario 1 + silence scenarios (11–13) + audit scenarios (16–17).
2. **Commit-tier findings:** unanchored advance, born-past-intake at rest,
   unparseable frontmatter, absent ledger, malformed verify/impl-plan (outline),
   invalid ledger annotation, multi-ticket + mixed-change grouping,
   multi-finding never-block. Pure-check reuse; no new validation logic.
3. **Push tier:** outgoing-range discovery (upstream / first-push), resolver
   injection (`createLedgerShaResolver`), reachability + rebase-canonicalization
   + entered-phase-only + indeterminate-on-resolver-failure, push never-block.
4. **Tier-split guard:** the "no reachability verification at commit" scenario —
   pinned by construction (commit tier never builds a resolver) + test.
5. **Dogfood shims** in `.husky/*` + gitignore entry for the audit file.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Command surface | `safeword boundary --at commit\|push` in src/commands | standalone hook scripts; extending stop-quality | three hook-manager worlds need one-line shims over versioned logic; stop-tier events don't fire in one-shot sessions (the epic's founding finding) |
| Prior-content source at commit | `git show HEAD:path` per staged artifact | filesystem-only (no prior) | transition checks (anchors, legality) need prior vs proposed; object access is cheap and history-free |
| Push range | `@{upstream}..HEAD`, else all commits absent from any remote ref | require upstream; hook stdin parsing | first-push must still reconcile (scenario); stdin parsing is child-2 shim territory, command stays callable standalone |
| Resolver failure | indeterminate verdict + exit 0 | let it throw; treat as unreachable | exit-0 rule is absolute; unreachable would false-accuse on env failures (friction register: shallow clones) |
| Audit shape | one JSONL line per run: {boundary, ts, head, tickets:[{id, checks:[{name, verdict, detail?}]}]} | per-finding lines | one-run-one-entry matches "entries accumulate across runs" scenario and keeps dedup trivial |

## Arch alignment

Records exist in `ARCHITECTURE.md`; this implementation honors:

- **Pure, unit-testable hook libs** — the engine composes existing pure checks; new logic (discovery, composition, verdict model) is itself pure with injected git/fs seams.
- **Zero-dependency YAML parser** — frontmatter reads go through the existing `parseFrontmatter`/`frontmatterOf` helpers; no new parser.
- **Reconciliation Engine pattern (schema-driven file management)** — no schema changes this slice (dogfood-only wiring; host emission is child 2's schema work).
- **CLI Structure** — new command registered in `cli.ts` alongside existing commands, logic in `src/commands/boundary.ts` + pure core under `src/` (or shared with templates lib where a hook needs it — decided at implement by who imports it; parity duty applies only if it lands under templates/).

## Known deviations

skip: no deviations planned — composes existing checks behind an existing command pattern.

## Assessment triggers

- Child 2 (host install) needs hook-manager detection — revisit the shim shape then, not now.
- Child 3 (server-side) promotes cheap-to-attest checks to hard-block — revisit the verdict model's warn/block field then.
- Audit file growth becomes real (multi-month dogfood) — add rotation.
- #676/#666 (precedence/timing) get built — they join the engine's check composition.
