# Verify — 2JMQMX (bdd-tdd-adherence: status-close done-gate)

## Verify Checklist

**Test Suite:** ✓ 2350/2350 tests pass (1 skipped) — full `bun run test` (144 files); +9 from this ticket (8 unit `resolve-stop-phase` + 1 integration `status-close-gate`).
**Build:** ✅ Success (`bun run build`)
**Lint:** ✅ Clean (`eslint src tests`)
**Scenarios:** All 8 scenarios marked complete (RED 03998ff0 / GREEN 5f6945d0 across AC1–AC3; cross-scenario refactor skipped)
**Dep Drift:** ✅ Clean — no dependencies added (hook lib imports only `node:*`)
**Parent Epic:** M7AZY3 (workflow-gate-hygiene) — siblings: 1GGD28 done, MT27QG pending (1/2 done; 2JMQMX makes 2/3)

## Audit

- **Dead code:** `resolveStopPhase` referenced by both `stop-quality.ts` copies + 2 tests — no dead export.
- **Duplication:** 0 clones (jscpd) across the changed lib + tests.
- **Architecture:** `lib/active-ticket.ts` is a leaf — imports only `node:fs`/`path`/`process`; no circular deps. The change adds one pure function consumed by the hook's session-scoped resolution.
- **Test quality:** 8 unit scenarios assert specific phase outcomes (`'done'` / passthrough / undefined) on isolated pure-function inputs; edge cases covered (already-done, patch, typeless, backlog, no-test-defs). The integration test asserts the real Stop hook blocks with a `verify.md` reason.

Audit passed.

## Done-when evidence

- A feature with `test-definitions.md` set to `status: done` (phase ≠ done) resolves to `phase: 'done'`; the end-to-end test proves the Stop hook then hard-blocks on missing `verify.md`. ✓
- An epic set to `status: done` resolves to `phase: 'done'` (gate self-tiers: verify.md + tests, no scenarios/skills since not `isFeature`). ✓
- `in_progress` passthrough unchanged; already-done (status+phase done) exempt (no loop); patch/typeless/scenario-less/backlog exempt. ✓ (114 gate tests across skill-gate, phase-derivation, quality-gates, hierarchy green — no regression.)
- Template + installed hook copies in sync (parity check green on every commit).
- **Self-dogfooding:** closing 2JMQMX itself now routes through this gate.

**Next:** mark 2JMQMX done; update the M7AZY3 epic table; start MT27QG (LOC-gate placement).
