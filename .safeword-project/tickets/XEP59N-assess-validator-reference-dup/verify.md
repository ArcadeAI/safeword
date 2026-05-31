# Verify: XEP59N — Assess validator-reference duplication

## Verify Checklist

**Test Suite:** ✓ 108/108 tests pass (personas + glossary + check; comment +
assessment only, no behavior change)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + tsc)
**Scenarios:** ⏭️ N/A — assessment task
**Dep Drift:** ✅ Clean — no new dependencies

## Figure-it-out verdict (per candidate)

Decision rule: Clarity > marginal dedup; Rule of Three (extract at the 3rd, not
the 2nd); don't force an abstraction over divergent logic. All candidates are
2-occurrence persona/glossary parallels.

- **`validate*Reference` read-half** — identical try/catch read, but only 2
  sites and wrapped by divergent parse+lookup → **leave**.
- **`lookup*`** — same control flow, different match fields (persona `code/name`
  vs glossary `name/alias`); unifying needs accessor lambdas → wrong abstraction
  → **leave**.
- **`find*Issues`** — divergent parse+validate fns and message prefixes →
  **leave**.
- **`find*Advisories`** — logic identical, data-only difference, but a
  multi-param helper for 2 call sites would cost clarity → **leave**.

**Outcome: no extraction warranted.** JZXVKN already took the one genuinely-clean
lift (the real jscpd clone). Documented the intentional parallelism in
`check.ts` so audits stop re-flagging it; the prior "deferred to M6D315"
misattribution is dead (corrected in WQ4RH3).

**Next:** Mark XEP59N done.
