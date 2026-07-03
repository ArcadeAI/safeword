# Test definitions — ticket 158

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were bulk-ticked in a single completion-time commit, with no per-step
> commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

8 rules, 31 scenarios. AODI + adversarial pass applied (changelog at bottom). Mapped from [dimensions.md](./dimensions.md).

---

## Rule: Minted IDs conform to 6-char uppercase Crockford Base32

> Rationale: Format is the whole load-bearing contract — every downstream behavior (lookup, guard, merge-conflict-on-collision) assumes IDs are uniformly shaped.

- [x] `safeword ticket new <slug>` produces an `id` whose value is exactly 6 characters
- [x] Every character of a minted ID is drawn from `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
- [x] A minted ID never contains the forbidden letters `I`, `L`, `O`, or `U`
- [x] All minted-ID letters appear uppercase on disk and in frontmatter
- [x] Calling the mint function 1000 times with a deterministic RNG seeded to a known value produces 1000 distinct IDs (asserts non-degenerate generator behavior, not collision probability — RNG is stubbed, no flake)

## Rule: ID assignment retries on EEXIST and fails loud on persistent collision

> Rationale: Intra-filesystem race is the cheap belt-and-suspenders layer underneath the uncoordinated ID design. Behavior must be observable, not statistical.

- [x] When the first chosen ID's folder already exists, the CLI retries with a fresh ID and succeeds (target folder pre-created, RNG stubbed to produce a known collision then a known success)
- [x] When the first N-1 chosen IDs all collide (N-1 target folders pre-created, RNG stubbed to a known sequence), the Nth attempt succeeds within the retry budget
- [x] When collisions exceed the retry budget (RNG stubbed to a constant + that folder pre-created), the CLI exits non-zero with a message naming the colliding ID and the retry count
- [x] When `.safeword-project/tickets/` does not exist (fresh setup), `safeword ticket new` creates it and proceeds — no error

## Rule: New tickets land at `{ID}/ticket.md` with slug only in frontmatter

> Rationale: This is the structural property that converts random ID collisions into git merge conflicts instead of silent dual-folder corruption. If slug leaks back into the path, the whole format change is defeated.

- [x] After `safeword ticket new login-bug`, a file exists at `.safeword-project/tickets/{ID}/ticket.md` where `{ID}` is the minted Crockford ID — no slug in the path
- [x] The created `ticket.md` frontmatter contains both `id: <ID>` and `slug: login-bug`
- [x] No other file or folder containing the slug in its name (`{ID}-login-bug`, `login-bug-{ID}`, etc.) is created anywhere under `.safeword-project/tickets/`

## Rule: Slugs are normalized to lowercase kebab-case before being written

> Rationale: Slug now lives in frontmatter and feeds work-log filenames + display formatting; an unnormalized slug (`Login Bug!`) would leak into filenames and display strangely. CLI normalizes at the boundary so downstream code doesn't have to.

- [x] `safeword ticket new "Login Bug"` writes `slug: login-bug` in frontmatter
- [x] `safeword ticket new "fix/auth-flow!"` writes `slug: fix-auth-flow` in frontmatter (non-alphanumerics collapsed to `-`, leading/trailing `-` stripped)
- [x] `safeword ticket new ""` (empty slug) exits non-zero with a clear error

## Rule: Active-ticket lookup resolves both legacy and new layouts

> Rationale: Grandfathering is the user-confirmed scope choice. Resolver code (currently `active-ticket.ts:43`) must handle two layouts forever, and Crockford's case-insensitivity must hold on input.

- [x] Lookup `080` resolves to the legacy folder `.safeword-project/tickets/080-ticket-id-collision/`
- [x] Lookup `102a` resolves to the legacy folder `.safeword-project/tickets/102a-gherkin-typescript/` (letter-suffix case — the existing suffixed legacy folders remain reachable)
- [x] Lookup of a newly minted uppercase ID (e.g., `7K9M3P`) resolves to `.safeword-project/tickets/7K9M3P/`
- [x] Lookup of the same ID in lowercase (`7k9m3p`) resolves to the same folder (canonical-uppercase on disk, case-insensitive on input)
- [x] Lookup of an ID that matches no folder returns a typed "not found" result (null or named error), not a wrong-folder match
- [x] If two folders are constructed synthetically that resolve to the same ID, lookup surfaces the ambiguity (throws or returns an error variant) rather than silently picking one

## Rule: Duplicate-ID guard fails loud in pre-commit AND CI

> Rationale: Random IDs have non-zero collision probability over project lifetime; manual edits and copy-paste can also produce duplicates. The guard is the safety net that catches everything regardless of mechanism. All test states are synthetic to keep tests deterministic — never depend on the host repo's actual state.

- [x] Pre-commit hook on a synthetic repo state with two NEW-format ticket folders sharing the same `id:` frontmatter exits non-zero
- [x] CI step on the same synthetic state exits non-zero
- [x] Pre-commit hook on a synthetic repo state with two LEGACY-format ticket folders sharing the same `id:` frontmatter exits non-zero (covers the "duplicate detection reads frontmatter, not folder name" property)
- [x] The guard's failure message names both offending folder paths AND the duplicated ID value
- [x] Pre-commit hook on a synthetic clean state (no duplicates, mix of legacy and new folders) exits zero
- [x] CI step on a synthetic clean state exits zero

## Rule: Skill prompt no longer carries find-max-and-increment logic

> Rationale: The behavioral hole was the prompt instruction itself. If the old guidance survives anywhere in the templates that ship to consumers, the regression returns.

- [x] `packages/cli/templates/skills/ticket-system/SKILL.md` does not contain the substring "highest" anywhere in the file
- [x] `packages/cli/templates/skills/ticket-system/SKILL.md` does not contain the substring "increment" anywhere in the file
- [x] `packages/cli/templates/skills/ticket-system/SKILL.md` contains the substring `safeword ticket new` (the new instruction surface)
- [x] No file under `packages/cli/templates/` matching `**/*.md` contains the substring "find the highest" (grep -r regression net)

## Rule: Cross-branch and cross-session creation cannot produce silent collisions in main

> Rationale: The whole point of moving to uncoordinated IDs. Two branches each minting a ticket and merging to main must either produce distinct IDs (the expected case) or a real merge conflict — never two folders that quietly share an `id:` in committed state.

- [x] Integration test: two child processes spawned via `child_process.spawn` each call `safeword ticket new` against the same `.safeword-project/tickets/` — both succeed with distinct IDs and distinct folder paths (genuine OS-level parallelism, not vitest's single-worker scheduling)
- [x] Integration test: a real `git init` fixture with two branches off the same parent, each running `safeword ticket new` independently, then merging both to main — the resulting `main` working tree contains two distinct ticket folders with distinct `id:` values
- [x] Integration test (collision-forced): the same two-branch fixture, RNG stubbed on each branch to mint the same ID — the second merge into main fails with a git folder/path conflict (proving collisions cannot land silently)
- [x] The duplicate-ID guard, run on a synthetic repo where a silent collision somehow did land in main, exits non-zero (last-line-of-defense behavior is independently testable from the prevention mechanism)

---

## AODI + adversarial-pass changelog (this revision)

- **Scenario count corrected.** Previous summary said "26 scenarios" but the file had 30; recount is 31 after additions.
- **Determinism fix (Rule 1, last scenario):** original "1000 distinct IDs from a tight loop" was probabilistic (~2×10⁻⁴ flake) — reframed to use a seeded deterministic RNG so the assertion is exact.
- **Factual fix (Rule 5):** original scenario referenced `102a` lookup resolving to `102c-native-language-step-defs/` — confirmed `102a-gherkin-typescript/`, `102b-gherkin-polyglot-ts-steps/`, `102c-native-language-step-defs/` all exist; fixed to lookup `102a` → `102a-gherkin-typescript/`.
- **Determinism fix (Rule 6, formerly "real repo" scenarios):** "pre-commit on the real repo passes" depended on host state and would break if the real repo ever had a dup. Reframed as "synthetic clean state" — never depend on host repo.
- **Atomicity split (Rule 6, formerly "covers legacy and new"):** one scenario claimed to test two cases; split into "two NEW-format dup" and "two LEGACY-format dup" scenarios.
- **Specificity fix (Rule 7):** "doesn't contain 'highest'/'increment' near ID guidance" was fuzzy ("near" is not testable). Strengthened to "substring absent from the entire file" — the substrings are themselves regressions in any context within that file.
- **New rule (Slug normalization):** adversarial pass exposed that nothing tested slug handling at the CLI boundary now that slug is frontmatter-only. Added 3 scenarios.
- **New scenario (Rule 2):** "fresh setup, no tickets dir" — adversarial pass exposed an obvious edge case not covered.
- **Cross-branch test mechanics committed:** Rule 8 scenarios now explicitly use `child_process.spawn` for genuine parallelism and a real `git init` fixture for branch tests (single integration test file, not unit). RNG-stubbing strategy committed to `IdMinter` injection at the function boundary (chose interface over env-var override — interface is easier to test cleanly and the use site is contained to one module).
