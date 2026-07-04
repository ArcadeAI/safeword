---
id: FHKHBW
slug: upgrade-deferred-major-deps
type: task
phase: intake
status: in_progress
created: 2026-07-04T05:59:04.879Z
last_modified: 2026-07-04T05:59:04.879Z
epic: "730"
external_issue: https://github.com/ArcadeAI/safeword/issues/730
---

# Upgrade deferred major deps: eslint-plugin-unicorn 70 + typescript 6

**Goal:** Adopt the two major bumps deferred by the audit follow-up —
`eslint-plugin-unicorn` 68 → 70 and `typescript` 5.9 → 6.0 — safely.

**Why:** Both were held out of the low-risk batch (commit 4d7570c) because
majors need migration research. Unicorn is now researched and ready with one
guardrail; TypeScript 6 still needs its own spike.

---

## Part A — eslint-plugin-unicorn 68 → 70  (READY, one guardrail)

**No hard blockers.** All 14 unicorn rules safeword names in
`packages/cli/src/presets/typescript/eslint-configs/base.ts` survive intact in
v70 (zero renames/removals across 68→70). Version reqs are unchanged
(`node >=22`, `eslint >=10.4`) — exactly safeword's floor. Single-step 68 → 70
is safe config-wise (skip 69).

Recommended set grew 306 → 328 (+22 rules). Only 3 fire on `packages/cli/src`
(14 violations); 19 are silent.

### The gotcha — `unicorn/prefer-error-is-error` (must disable)

It flags `x instanceof Error` and **autofixes to `Error.isError(x)`**, which is
a **V8 12.5 / Node 24+** API. safeword's `engines` supports `node >=22`, so the
autofix emits code that throws `TypeError: Error.isError is not a function` on
Node 22 — for safeword's own 9 `catch`-block sites AND for customer agent code
we lint. Turn it **off** until safeword's Node floor is 24.

### Steps

1. Bump `eslint-plugin-unicorn` 68 → 70 in `packages/cli/package.json` (exact
   pin, consistent with sibling plugins). No engines/peer change.
2. Add `'unicorn/prefer-error-is-error': 'off'` to the `safeword/unicorn-rules`
   block with a comment: Node 24+ API; autofix unsafe on our `node >=22` floor;
   re-enable when the floor moves to 24.
3. `eslint --fix` the 2 trivial new rules and commit:
   `unicorn/no-unnecessary-array-flat-map` (×4) and `unicorn/prefer-set-methods`
   (×1) — all in-repo, low risk. Leave at recommended severity.
4. Judgment call: `unicorn/no-non-function-verb-prefix` (new, recommended,
   error-level, ships to customer code) overlaps the boolean-naming overreach
   that made us disable `consistent-boolean-name`. Doesn't fire on our code;
   decide whether its v70 `ignore` option suffices or it should also be off.
5. Update the 68-tracking inline comments in `base.ts` to cover the 68→70
   additions + the `prefer-error-is-error` rationale.

### Done when (Part A)

- unicorn at 70; `prefer-error-is-error` off with rationale; 2 trivial fixes in.
- `bun run lint` + full suite green.
- `no-non-function-verb-prefix` decision recorded (keep/disable).

---

## Part B — typescript 5.9 → 6.0  (NEEDS ITS OWN SPIKE)

Not yet researched. TypeScript 6.0 is a major on the deprecate-then-remove
cadence, and lands in the context of the Go-based native compiler ("TS 7")
work — so this deserves a dedicated spike, not a drive-by bump.

### Open questions for the spike

- What does 6.0 actually remove/break vs 5.9 (deprecations coming due)?
- `typescript-eslint` compatibility with TS 6 (we ship it; peer range?).
- `tsup` / `tsc --noEmit` / our `typecheck` under TS 6.
- Does anything in the bundled ESLint preset assume 5.x type APIs?

### Done when (Part B)

- TS 6 breaking-change surface enumerated; `typescript-eslint` peer confirmed.
- Either bumped with green lint+build+suite, or a documented reason to hold.

---

## Links

- Parent milestone: ArcadeAI/safeword#730 (Safeword 1.0). Dependency currency;
  no single goal owns "keep majors current" — attach directly to #730.
- Origin: audit follow-up, commit 4d7570c deferred both majors.

## Work Log

- 2026-07-04T05:59:04.879Z Started: Created ticket FHKHBW
- 2026-07-04 Filed: Part A (unicorn) researched — no hard blockers, one Node-22
  guardrail (`prefer-error-is-error` autofixes to Node-24-only `Error.isError`).
  Part B (TS 6) still needs a spike. GitHub nesting under #730 pending re-auth.
