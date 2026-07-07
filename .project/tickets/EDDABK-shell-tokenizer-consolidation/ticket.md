---
id: EDDABK
slug: shell-tokenizer-consolidation
type: task
phase: intake
status: in_progress
created: 2026-07-07T17:55:50.140Z
last_modified: 2026-07-07T17:55:50.140Z
---

# Consolidate divergent shell tokenizers across safeword's security gates

**Goal:** Decide and unify how safeword's Bash-command gates tokenize commands, so the kill-guard, ledger-write, and dependency-readiness gates segment identically instead of via two divergent implementations.

**Why:** dependency-readiness.ts carries a private splitShellSegments/tokenizeShellWords/stripExecutionPrefixes that diverges from the shared shell-segments.ts the other gates use; the same command string is segmented differently by the install gate vs the kill/ledger gates — a latent cross-gate inconsistency (the private copy predates the shared extraction in #721 and never migrated).

## Jobs To Be Done

**Primary:** When a maintainer changes how safeword parses a Bash command — to catch a newly-discovered pattern, fix a mis-segmentation, or close a gate gap — they want to change it in **one** place and have every Bash gate segment consistently, so a fix to one gate's parsing doesn't silently leave another gate on divergent, weaker behavior.

**Underlying:** safeword's Bash-command gates should **agree** on what a command's segments and command-word are, so their security decisions are consistent and the parsing is maintainable (one definition, one test surface).

**Who feels the pain:** the maintainer (two places to change, easy to miss one — the same failure mode just bit the Python-tools list, fixed in #947) and, indirectly, the user whose command is judged differently by two gates.

## Constraints (hard — do not violate)

1. **Cross-runtime boundary.** All of this lives under `templates/hooks/lib/**` — hook code that ships into customer repos and runs **standalone** under bun/node, so it **cannot import CLI `src/`**. Any shared home must itself be a hook lib. (This is why safeword already keeps intentional cross-runtime duplicates elsewhere — retro `shortHash`, `computeSkipMask`.) `shell-segments.ts` already satisfies this.
2. **Byte-parity mirror.** Every `templates/hooks/lib/*.ts` has a byte-identical `.safeword/hooks/lib/*.ts` dogfood mirror, enforced by `parser-parity.test.ts` + the schema parity contract. Every edit touches **both** copies identically.
3. **Security-gate behavior must not silently weaken.** These tokenizers feed three gates (see Data). Changing segmentation changes what each gate catches/misses. The kill-guard's stated doctrine is "close the low-friction accident path, not every adversarial path" — a unified behavior must not drop an accident-path catch. Any per-gate behavior change must be an explicit, tested decision, not a side effect.
4. **Semver.** A gate that becomes stricter and auto-upgrades silently is the versioning concern — if the decision changes any gate's behavior, it must be surfaced (changelog + correct bump), per the `versioning` skill.

## Observations

- Two implementations of the same primitive (segment a Bash command → tokenize a segment into words → strip execution-prefixes to find the command word), and they **diverge**.
- The divergence is **subtle and behavioral**, not cosmetic — it changes segmentation of real commands (see Data). Unifying is therefore **not** a behavior-preserving refactor: at least one gate's segmentation will change. This is why it was pulled OUT of the refactor pass.
- The divergence is **accidental**: the shared module was extracted in #721 (`b961bad1`); the `dependency-readiness` private copy predates it (#371, `357966f4`) and never migrated. Neither is deliberately tuned against the other.
- Surfaced 2026-07-07 by the post-v0.67.0 refactor scout; deferred from that pass (and from PRs #946/#947) as security-sensitive + a design decision.

## Data (verified 2026-07-07 at main `c1d0a00c`)

**Shared** — `packages/cli/templates/hooks/lib/shell-segments.ts` (+ byte-identical `.safeword/hooks/lib/shell-segments.ts`):
- `splitShellSegments` (L10), `parseShellWords` (L50), `commandWordIndex` (L95).
- Splits on `;`, `\n`, single `|` pipe (with a `>|` clobber-redirect exception, L38-39), `&&`. No `corepack` awareness.
- Correct consumers: `process-kill-guard.ts`, `bash-ledger-writes.ts`, `cursor/gate-adapter.ts` (+ their `.safeword/` mirrors).

**Private divergent copy** — `packages/cli/templates/hooks/lib/dependency-readiness.ts` (+ mirror):
- `splitShellSegments` (L833), `tokenizeShellWords` (L900), `stripExecutionPrefixes` (L952; `corepack` handling at L966).
- Used at L367 / L392 (segment split) and L396 / L752 (tokenize + strip).
- Observed divergences vs shared: splits on `&&` **and** `||` explicitly; different single-pipe / `>|` handling; strips a `corepack` execution prefix the shared side does not. **A full behavioral diff of both functions is NOT yet done — establishing it is the first task, not an assumption.**

**Tests that pin current behavior (inputs to the decision; keep green unless a change is deliberate):**
- `tests/hooks/dependency-readiness.test.ts`
- `tests/hooks/process-kill-guard.test.ts` + `tests/integration/process-kill-guard.test.ts`
- `tests/hooks/bash-ledger-writes.test.ts` + `tests/integration/bash-ledger-write-gate.test.ts`
- `tests/hooks/parser-parity.test.ts` (byte-parity of the mirrors)

## Open questions (for the fresh session — decisions, not code)

- What is the **exact** behavioral diff between the two tokenizers across a representative command corpus? (Establish before deciding anything.)
- For each divergence, **which gate needs which behavior, and why?** e.g. does the install gate legitimately need `||` splitting for fallback installs (`command -v bun || bun install`) that the kill/ledger gates don't? Is `corepack`-stripping needed anywhere but the install gate?
- Is a **single** unified tokenizer right for all three gates, or do they have legitimately different needs better served by a shared core with per-gate options? (Both are open — this ticket prescribes neither.)
- If unifying changes a gate's behavior, is that change acceptable (e.g. a strictly-stricter kill-guard), and how is it surfaced?

**Riskiest assumption:** that one tokenizer can serve all three gates without weakening any. **Cheapest test:** table-drive a corpus of representative commands (compound `&&`/`||`/`;`/pipes, redirects incl. `>|`, `sudo`/`env`/`corepack` prefixes, quoting) through **both** implementations and diff the outputs — that table localizes every disagreement to a specific gate and is the evidence the decision rests on.

## Out of scope

- No implementation, file layout, or which-behavior-wins decision is proposed here (per request).
- The two clean behavior-preserving dedups from the same scout shipped as #946; the Python-tools drift bug as #947. This ticket is **only** the tokenizer consolidation.

## Work Log

- 2026-07-07T17:55:50.140Z Started: Created ticket EDDABK
- 2026-07-07T17:55:50.140Z Intake authored from the post-v0.67.0 refactor scout; parked for a fresh session. Problem, JTBD, constraints, and verified file:line data captured above; no implementation proposed. Next actor starts at the "exact behavioral diff" open question.
