# Verify: Audit checks namespace domain docs for emptiness and drift (N0W5KG)

## Verify Checklist

**Test Suite:** ✓ 19/19 tests pass (`packages/cli/tests/skills/audit-domain-documentation.test.ts`) — full suite 5195 passed / 2 unrelated environment failures (see Evidence limits)
**Gherkin:** ⏭️ Skipped — no cucumber step lane for this skill-bash feature; the 15 scenarios are proven executably by the extracted-block integration tests (each `When audit runs the domain-docs check` runs the real bash against a fixture)
**Build:** ✅ Success (`bun run build`, tsup + dts clean)
**Lint:** ✅ Clean (eslint 0, `tsc --noEmit` 0 after fixing the TS18048 group-coercion)
**Scenarios:** All 15 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope — audit `SKILL.md` (3 byte-identical mirrors), one new test file, and ticket artifacts; no unrelated changes
**Dep Drift:** ✅ Clean — no dependencies added
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — conforms to the existing Section-3 W006 bash-block-in-skill pattern; no new pattern introduced
**Experience:** ✅ No new friction — Walked Technical Builder through running `/audit`; worst step = a TB who intentionally left a domain doc empty gets a repeating W008, but it is a warn with a one-line fix (fill from the named template) and empty-suppresses-drift prevents a pile-on; new steps vs before = 0 (audit already ran; this only adds findings). Rave Moment was `skip: table-stakes`, so no peak to walk.
**Evidence limits:** ⚠️ Full-suite had 2 failures unrelated to this change — `rust-golden-path.test.ts` Scenario 10 (clippy `--fix` char-literal autofix, toolchain-version-dependent) and a preview-server `isAlive(pid)` process-timing E2E. This diff touches only the audit skill markdown + one test file — neither failing test exercises anything in the diff; both are pre-existing/local-toolchain, not product evidence. CI's isolated suite is authoritative.

## Audit Result

Audit passed with warnings. The ticket's deliverable is clean: architecture 0 violations (610 modules), knip flags no new dead code, the new test file meets the test-quality bar, and no new clones were introduced (431 total, repo-minus-.safeword/.project baseline). Learnings W006: 0.

The new check, run against this repo (dogfooding), surfaced **2 pre-existing domain-doc drifts** — `[E008] @surface.safeword-cli` (tagged in `features/` but absent from `surfaces.md`) and `[E009] persona DEV` (named in a spec but absent from `personas.md`). Both pre-date this ticket (my diff adds neither reference) and are out of scope for "add the check" — routed to follow-up tasks (add the Safeword CLI surface; resolve the DEV persona). They are the check working as designed, not defects in this deliverable.

A latent bug in the check's own bash — a positional `$1` in a shell function, which skill/command argument-substitution clobbers to empty in a live session — was caught by dogfooding `/audit` here and fixed (commit c3272a79, named-var `$dd_file` + regression guard test).

**Next:** Mark N0W5KG done; the two spawned follow-up tasks fix the real repo drifts the check surfaced.
