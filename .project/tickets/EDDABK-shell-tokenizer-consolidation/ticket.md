---
id: EDDABK
slug: shell-tokenizer-consolidation
type: task
phase: implement
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

**Who feels the pain:** the maintainer (two places to change, easy to miss one — the same failure mode just bit the Python-tools list, filed as #947, in review) and, indirectly, the user whose command is judged differently by two gates.

## Constraints (hard — do not violate)

1. **Cross-runtime boundary.** All of this lives under `templates/hooks/lib/**` — hook code that ships into customer repos and runs **standalone** under bun/node, so it **cannot import CLI `src/`**. Any shared home must itself be a hook lib. (This is why safeword already keeps intentional cross-runtime duplicates elsewhere — retro `shortHash`, `computeSkipMask`.) `shell-segments.ts` already satisfies this.
2. **Byte-parity mirror.** Every `templates/hooks/lib/*.ts` has a byte-identical `.safeword/hooks/lib/*.ts` dogfood mirror, enforced by the schema `ownedFiles` parity contract (`src/schema.ts`). Every edit touches **both** copies identically.
3. **Security-gate behavior must not silently weaken.** These tokenizers feed three gates (see Data). Changing segmentation changes what each gate catches/misses. The kill-guard's stated doctrine is "close the low-friction accident path, not every adversarial path" — a unified behavior must not drop an accident-path catch. Any per-gate behavior change must be an explicit, tested decision, not a side effect.
4. **Semver.** A gate that becomes stricter and auto-upgrades silently is the versioning concern — if the decision changes any gate's behavior, it must be surfaced (changelog + correct bump), per the `versioning` skill.

## Observations

- Two implementations of the same primitive (segment a Bash command → tokenize a segment into words → strip execution-prefixes to find the command word), and they **diverge**.
- The divergence is **subtle and behavioral**, not cosmetic — it changes segmentation of real commands (see Data). Unifying is therefore **not** a behavior-preserving refactor: at least one gate's segmentation will change. This is why it was pulled OUT of the refactor pass.
- The divergence is **accidental**: the shared module was extracted in #721 (`b961bad1`, which created `shell-segments.ts` out of the cursor gate-adapter); the `dependency-readiness` private copy predates it — all three private functions were introduced together in #230 (`603d2c15`, 2026-06-15) — and never migrated. Neither is deliberately tuned against the other.
- Surfaced 2026-07-07 by the post-v0.67.0 refactor scout; deferred from that pass (and from PRs #946/#947) as security-sensitive + a design decision.

## Data (verified 2026-07-07 at main `c1d0a00c`)

**Shared** — `packages/cli/templates/hooks/lib/shell-segments.ts` (+ byte-identical `.safeword/hooks/lib/shell-segments.ts`):

- `splitShellSegments` (L10), `parseShellWords` (L50), `commandWordIndex` (L95).
- Splits on `;`, `\n`, single `|` pipe (with a `>|` clobber-redirect exception, L37-38), `&&`. No `corepack` awareness.
- Correct consumers: `hooks/lib/process-kill-guard.ts`, `hooks/lib/bash-ledger-writes.ts`, `hooks/cursor/gate-adapter.ts` (the last imports `../lib/shell-segments`) — plus their `.safeword/` mirrors.

**Private divergent copy** — `packages/cli/templates/hooks/lib/dependency-readiness.ts` (+ mirror):

- `splitShellSegments` (L833), `tokenizeShellWords` (L900), `stripExecutionPrefixes` (L952; `corepack` handling at L966).
- Used at L367 / L392 (segment split) and L396 / L752 (tokenize + strip).
- Observed divergences vs shared: splits on `&&` **and** `||` explicitly; different single-pipe / `>|` handling; strips a `corepack` execution prefix the shared side does not. **A full behavioral diff of both functions is NOT yet done — establishing it is the first task, not an assumption.**

**Tests that pin current behavior (inputs to the decision; keep green unless a change is deliberate):**

- `tests/hooks/dependency-readiness.test.ts`
- `tests/hooks/process-kill-guard.test.ts` + `tests/integration/process-kill-guard.test.ts`
- `tests/hooks/bash-ledger-writes.test.ts` + `tests/integration/bash-ledger-write-gate.test.ts`
- `tests/cursor-shell-gate.test.ts` — found during implementation: a seventh pinned file (21 tokenizer-sensitive commands, `command`/`env`/`VAR=` git-commit routing) missing from the original inventory.
- **Known gap:** no test directly exercises `shell-segments.ts` or the private tokenizer — their behavior is pinned only *indirectly*, through the gate tests above. Mirror byte-identity is enforced by the schema `ownedFiles` contract (`src/schema.ts`), not a tokenizer test. A fresh session likely needs to add direct tokenizer tests as part of establishing the behavioral diff.

## Open questions (for the fresh session — decisions, not code)

- What is the **exact** behavioral diff between the two tokenizers across a representative command corpus? (Establish before deciding anything.)
- For each divergence, **which gate needs which behavior, and why?** e.g. does the dependency-readiness gate legitimately need `||` splitting for fallback installs (`command -v bun || bun install`) that the kill/ledger gates don't? Is `corepack`-stripping needed anywhere but there?
- Is a **single** unified tokenizer right for all three gates, or do they have legitimately different needs better served by a shared core with per-gate options? (Both are open — this ticket prescribes neither.)
- If unifying changes a gate's behavior, is that change acceptable (e.g. a strictly-stricter kill-guard), and how is it surfaced?

**Riskiest assumption:** that one tokenizer can serve all three gates without weakening any. **Cheapest test:** table-drive a corpus of representative commands (compound `&&`/`||`/`;`/pipes, redirects incl. `>|`, `sudo`/`env`/`corepack` prefixes, quoting) through **both** implementations and diff the outputs — that table localizes every disagreement to a specific gate and is the evidence the decision rests on.

## Out of scope

- No implementation, file layout, or which-behavior-wins decision is proposed here (per request).
- The two clean behavior-preserving dedups from the same scout are filed as #946, and the Python-tools drift bug as #947 (both open/in review, not yet merged). This ticket is **only** the tokenizer consolidation.

## Work Log

- 2026-07-07T17:55:50.140Z Started: Created ticket EDDABK
- 2026-07-07T17:55:50.140Z Intake authored from the post-v0.67.0 refactor scout; parked for a fresh session. Problem, JTBD, constraints, and verified file:line data captured above; no implementation proposed. Next actor starts at the "exact behavioral diff" open question.
- 2026-07-07T18:30 /quality-review pass (independent reviewer): fixed two misattributed citations — the private tokenizer originated in #230 (`603d2c15`), not #371; and mirror byte-parity is enforced by the schema `ownedFiles` contract, not `parser-parity.test.ts` (which pins the markdown parser). Added the "no direct tokenizer test" known-gap. Reviewer confirmed the three divergences real (corpus-checked) and the no-implementation constraint honored.
- 2026-07-07T22:40 Picked up (fresh session). **Behavioral diff established** (open question 1): 45-command corpus through both implementations (verbatim extraction of the private functions), 21 diverge, clustering into 9 classes: (1) `||` boundary — *behaviorally neutral*: shared splits it accidentally as two `|` splits; identical non-empty word lists both sides. (2) `>|` clobber redirect — shared keeps in-segment (required by the ledger-gate pinned test `echo '- [x] RED' >| <ledger>` and `redirectionTarget`'s fused/standalone `>|` parsing); private splits, manufacturing phantom "commands" from redirect targets (`echo cfg >| vitest` counts as dependency-backed). (3) `corepack` strip — private only; required by dep-gate pinned tests. (4) `env` by basename + flags (`-i`, `-u X`, `--`) — private only; shared resolves `env -i … pnpm install` to command word `-i`, a miss for every gate. (5) `command` prefix skip — shared only. (6) `(`/`{` opener skip — shared only (`( bun ci )` invisible to dep gate). (7) backslash-in-single-quotes — shared treats as escape (non-POSIX), so `echo 'a\'; pkill node` keeps the quote open and masks the kill from the kill-guard; private is POSIX-literal and unmasks it. (8) multi-prefix chains — private loops, shared single-pass. (9) trim/empty-drop — cosmetic. Repo-wide sweep confirms exactly two implementations + the documented consumers. Adversarial 3-lens design panel (gate-weakening / per-gate-options / test-flips) running on the proposed single-superset-tokenizer semantics.
- 2026-07-07T22:47:03.096Z Phase: intake → implement
- 2026-07-07T22:50 **Decision (open questions 2–4 resolved), adversarial-panel-verified** (3 lenses: gate-weakening, per-gate-options steelman, pinned-test flips; every claim bun-verified against the real modules): **One unified tokenizer in `shell-segments.ts`, no per-gate options** — no divergence exists where two gates need different behavior; the two would-be conflicts are non-overlapping (only the ledger gate pins `>|`, and no-split also *fixes* dep-gate phantoms; only the dep gate pins `corepack`/`env`-flags, strictly stricter for the others). Unified semantics: boundaries `;` `\n` `&&` `||`(explicit) `|` with the `>|` no-split exception; POSIX backslash-literal-in-single-quotes; `commandWordIndex` becomes a looping superset resolver — `(`/`{` openers, `VAR=val`, `command`, `env` (basename match + flags via ENV_OPTIONS_WITH_VALUES, which moves in), `corepack` (basename). `sudo`/single-`&` stay out (neither impl handles them; out of scope). **Zero pinned-test flips across all 7 files** (46 dep pins, 150+ total). Panel found 2 regressions the consolidation would ship without companion fixes, both fixed in-change at the *gate* layer, not the tokenizer: (a) kill-guard `bareName` must also strip leading backslash-escapes — `pkill '\java'` is a real machine-wide kill (ERE `\j`=literal `j`) caught today only via the non-POSIX quote mangling; (b) dep-gate classic-yarn rule must treat report-only flags (`--version`/`-v`/`--help`/`-h`) as non-installs — the new `command`-skip widens a pre-existing `yarn --version` false-stamp. Semver: gates get strictly stricter + false-positive removals → surface as minor at next release; full new-denial list goes in the PR body. Constraint 4 discipline: every behavior change gets a new pin (direct `shell-segments.test.ts` + gate-level pins); comment drift fixed in shell-segments header, commandWordIndex docstring, bash-ledger-writes boundary list, cursor gate-adapter note.
- 2026-07-07T23:35 **High-effort code review (8 angles → verify) → 2 regressions fixed.** Review produced 24 verified findings; triaged regression-vs-pre-existing. Two were **genuine regressions the consolidation introduced**, both fixed here: (a) the POSIX single-quote rule delivers *interior* backslashes intact, so `pkill 'n\ode'` (ERE literal → `node`) evaded — the first `bareName` fix stripped only *leading* `\`; corrected to strip all backslashes (at base the non-POSIX rule ate the backslash → detected, so this was a real weakening, now re-caught + pinned). (b) the report-only-flag false-stamp fix was yarn-only; `npm ci --help`/`bun install --help`/`pnpm install -h` still stamped false-ready — generalized `REPORT_ONLY_INSTALL_FLAGS` to every manager (under-stamping is fail-safe), pinned. Cleanups: exported a `commandWords(segment)` helper killing the duplicated `parseShellWords`+`commandWordIndex` idiom at the two dep call sites; hoisted a double `basename`. **Correction to the 22:40 entry:** "exactly two implementations" was wrong — the review found two MORE private shell tokenizers in adjacent (non-gate) subsystems, `cursor-run-identity.ts` (stamp-proof recording; real functional gap on `command`/`env`-prefixed invocations) and `branch-staleness.ts` (`parseCheckoutTarget`, warn-only). Both out of EDDABK's scope (the four security *gates*) → filed as follow-up. Second follow-up: the review's pre-existing (verified identical at base, non-regression) gate-evasion cluster — gates exact-match the command word while the tokenizer basename-matches env/corepack, so absolute-path forms (`/usr/bin/pkill node`, `/usr/bin/tee <ledger>`, `/usr/bin/git commit`), `command -p git commit`, and tokenizer edge cases (`\`+newline, `|&`, glued `(cmd`, escaped `\>|`) evade — each a deliberate gate-behavior change needing its own semver call.
