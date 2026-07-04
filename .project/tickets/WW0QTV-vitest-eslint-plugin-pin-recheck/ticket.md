---
id: WW0QTV
slug: vitest-eslint-plugin-pin-recheck
type: task
phase: intake
status: in_progress
created: 2026-07-04T05:57:29.445Z
last_modified: 2026-07-04T05:57:29.445Z
epic: "730"
external_issue: https://github.com/ArcadeAI/safeword/issues/762
---

# Re-check @vitest/eslint-plugin pin (held at 1.6.20)

**Goal:** Unpin `@vitest/eslint-plugin` back to a caret range once a release
past 1.6.21 fixes the `vitest/valid-expect` regression.

**Why:** We ship this plugin in the bundled ESLint preset, so a false-positive
hits downstream users, not just us. We currently hold an exact pin as a
stopgap; that pin should not become permanent.

## Context

Commit `a3895e1` pinned `@vitest/eslint-plugin` to exact `1.6.20` in
`packages/cli/package.json` (was `^1.6.20`). 1.6.21's new "Chai-style expect
chains" support made `vitest/valid-expect` misparse the standard asymmetric
matcher `expect.any(Object)` as an unknown `expect` modifier, flagging valid
test code (surfaced by `packages/cli/tests/presets/eslint-overrides.test.ts`
and the CLI's own lint). 1.6.21 was the latest at pin time; no fixed release
existed yet.

## Done when

- A `@vitest/eslint-plugin` release > 1.6.21 no longer flags `expect.any(...)`
  / asymmetric matchers under `vitest/valid-expect` (verify against
  `eslint-overrides.test.ts` and a quick repro).
- The exact pin is relaxed back to a caret (`^`) range in
  `packages/cli/package.json`.
- `bun run lint` + full suite green; no new `vitest/valid-expect` violations.

## Riskiest assumption / cheapest test

Assumption: the upstream will fix the `expect.any` parse. Cheapest test: on
each recheck, `npm view @vitest/eslint-plugin version`, install the candidate
in a scratch dir, and lint a file containing `expect(x).toEqual(expect.objectContaining({ y: expect.any(Object) }))`.

## Links

- Parent milestone: ArcadeAI/safeword#730 (Safeword 1.0). Loosely under Goal 5
  (#736, dependency signal) — the pin is intentional debt to un-take.
- Upstream: vitest-dev/eslint-plugin-vitest (valid-expect / Chai-style chains
  change in 1.6.21).

## Work Log

- 2026-07-04T05:57:29.445Z Started: Created ticket WW0QTV
- 2026-07-04 Filed: documented the 1.6.20 hold from audit follow-up; awaiting an
  upstream fix release to relax the pin. GitHub sub-issue nesting under #730
  pending GitHub re-auth.
