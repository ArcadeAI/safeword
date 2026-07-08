---
id: HRDN42
slug: gate-basename-hardening
type: task
phase: implement
status: in_progress
created: 2026-07-08T03:40:00.000Z
last_modified: 2026-07-08T03:40:00.000Z
---

# Harden Bash gates: basename-match the command word + tokenizer edge cases

**Goal:** Close the cluster of gate evasions the EDDABK code review found: gates exact-match the resolved command word while the shared tokenizer basename-matches env/corepack — an asymmetry that lets absolute-path forms (`/usr/bin/pkill`, `/usr/bin/tee`, `/usr/bin/git`) slip. Plus two tokenizer-correctness gaps.

**Why:** Follow-up from ticket EDDABK / PR #959. All items were verified PRE-EXISTING (identical at base d5905a72) — not EDDABK regressions — so deferred out of the consolidation. Each changes gate behavior → semver-surfaced.

## Scope (this pass)

Every gate becomes strictly stricter (more forms caught); no gate loses a catch. Fixes:

1. **kill-guard** (`process-kill-guard.ts`): basename the killer word — `/usr/bin/pkill node` now detected.
2. **ledger** (`bash-ledger-writes.ts`): basename the command word — `/usr/bin/tee <ledger>`, `/usr/bin/sed -i … <ledger>`, `/bin/cp x <ledger>` now detected.
3. **cursor git** (`gate-adapter.ts`): basename before comparing to `git` — `/usr/bin/git commit` now fail-closed-routed.
4. **`command -p`** (`shell-segments.ts commandWordIndex`): skip `command`'s `-p` (runs the command with default PATH) so the real command resolves — `command -p git commit` / `command -p pkill node` now caught. `command -v`/`-V` (DESCRIBE, don't run) are left in place, so `command -v git` stays a non-commit (verified `false`).
5. **line-continuation** (`splitShellSegments`): `\`+newline collapses (bash line continuation) instead of fusing a literal newline onto the next word — `pkill \<newline>node` now detected.
6. **`|&`** (`splitShellSegments`): the stdout+stderr pipe is a boundary whose trailing `&` is consumed — `tail -f log |& pkill node` now detected (was: `&` became a phantom command word).

Basename matching mirrors dep-readiness's established `nodePath.basename(binary)` pattern — no new shared abstraction; the shared tokenizer already resolves the command word, each gate basenames it at its name comparison.

## Deferred (NOT in this pass — documented, needs its own effort)

- **5c glued subshell `(pkill node)`**: `(`/`)` are bash metacharacters that should tokenize as their own words, but splitting them in `parseShellWords` has broad blast radius (`$(…)` command substitution, `x=(…)` array assignment, `<(…)` process substitution) that could *weaken* a gate — a risky shared-tokenizer change deserving its own corpus-diffed effort like EDDABK. The spaced form `( pkill node )` IS caught. Adversarial-path (deliberate space-omission); kill-guard doctrine is "accident path, not every adversarial path".
- **5d escaped `\>|`** (`echo x\>| pkill node`): the `>|` no-split exception's `command[index-1] !== '>'` lookback is escape-blind. Fixing it needs new escape-state tracking in the hot splitter loop; adversarial construction (escaping a `>` right before a pipe). Left with 5c.

## Constraints

1. Stacks on EDDABK #959 (needs the unified tokenizer + `commandWords`). Branched off `frosty-yonath-9f2adb`, parallel to KQ3MRV #961 (different files, no conflict).
2. Byte-parity mirrors under `.safeword/hooks/` (schema `ownedFiles`).
3. No silent weakening: `command -v git` must stay a non-commit; the `>|` ledger pin must stay denied; `sudo /usr/bin/pkill node` must be caught (sudo-skip + basename compose).
4. Semver: strictly-stricter gate behavior → minor; new-detection list in the PR body.

## Work Log

- 2026-07-08T03:40 Created from the EDDABK follow-up chip. All 16 evasions re-verified reproducing on #959 HEAD, then all 6 in-scope fixes verified landing (basename ×3, command -p, line-continuation, `|&`) with the `command -v git` query guardrail preserved and 5c/5d deliberately still evading. Scope call: 1–4 + 5a/5b are accident-path or clear tokenizer-correctness; 5c/5d are adversarial + risky shared-tokenizer changes, deferred with backstops.
