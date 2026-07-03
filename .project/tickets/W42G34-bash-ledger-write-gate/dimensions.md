# Dimensions — W42G34: gate Bash-channel writes to the R/G/R ledger

Derived from the 6 ACs. All dimensions are **[hook]** — deterministic gate logic over a
command string, unit-testable as a pure predicate; no [agent] partitions.

## Behavioral dimensions

| Dimension                  | Partitions                                                                            | AC                 |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------ |
| Reference kind             | no ledger reference / read-only reference / write-shaped reference                    | SM1.AC1, SM1.AC2, SM2.AC2 |
| Write shape                | in-place editor flag (`sed -i`, `perl -i`) / redirection (`>`, `>>`) / `tee` target / `mv`-`cp` destination / `truncate` / inline interpreter naming the path | SM1.AC1            |
| Target path form           | literal path to `test-definitions.md` under tickets namespace / same basename outside the namespace / obfuscated (variable, substitution, script file) — undetectable by design | SM1.AC1, SM2.AC1, SM2.AC2 |
| Command compounding        | single segment / multi-segment (`&&`, `;`, `\|`, newline) with the write in any one segment | SM1.AC1            |
| Harness                    | Claude (direct) / Codex (adapter-translated Bash) / Cursor (`requiresFailClosedShellGate` pre-filter) | SM1.AC3            |
| Denial content             | names the Edit channel + the validation reason / (failure: bare deny)                 | TB1.AC1            |
| Limit documentation        | uncatchable forms enumerated in the predicate module / (failure: silence implies completeness) | SM2.AC1            |

## Partitions → rules

- Reference kind → **Rule: only write-shaped references deny** (no-reference and read-only pass; mention ≠ mutation).
- Write shape → **Rule: each recognized write shape denies** (the #644 `sed -i` literal is the anchor case).
- Target path form → **Rule: gate scopes to the tickets namespace**; same-basename files elsewhere pass; obfuscated forms are documented limits, not chased.
- Command compounding → **Rule: a write-shaped segment anywhere in a compound command denies** (mirrors `requiresFailClosedShellGate`'s per-segment scan).
- Harness → **Rule: one predicate, three consumers** — Claude gate is source of truth; Codex inherits via translation; Cursor's pre-filter widens to consult the gate.
- Denial content → **Rule: the denial names the sanctioned channel** (Edit/Write) and why Bash is closed.
- Limit documentation → **Rule: the module states what it cannot catch** and names the done-gate as backstop.

## Baked decisions

- **Deny, don't simulate** (from /figure-it-out): the gate never tries to compute the
  post-state of a shell write; it forces the mutation onto the Edit channel where
  `collectNewTransitions` already validates. Rejected: simulate-and-validate (statically
  impossible), PostToolUse repair (cannot deny).
- **Inline interpreters over-approximate deliberately**: an interpreter invocation with an
  inline-code flag (`python -c`, `bun -e`, `perl -e`, `node -e`, …) that names a ledger path
  denies even though the code might only read — read-vs-write inside interpreter code is
  simulation, which this design rejects. SM2.AC2's "mere mention passes" applies to
  non-interpreter contexts (git add, echo of the path). Documented in the module limits.
- **Git ops without a literal ledger write-target pass**: `git checkout`, `git merge`,
  `git stash pop` rewrite files but never name the ledger as a write target in the command
  string — no special-casing needed. `git checkout -- <ledger>` is not a write shape the
  predicate recognizes (no redirection/in-place flag); restoring committed state stays open.

## Invariant

- `packages/cli/templates/hooks/` ↔ `.safeword/hooks/` byte-identical (`bun scripts/parity-check.ts`).
