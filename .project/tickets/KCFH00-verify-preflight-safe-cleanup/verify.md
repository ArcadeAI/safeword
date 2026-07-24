# Verification: Keep verification preflight runnable in restricted agent shells

## Verify Checklist

**Test Suite:** ✓ 62/62 verify-skill tests pass; ✓ 8/8 Codex catalogue release tests pass. The full aggregate Vitest suite entered after the fixed preflight but stalled locally with sleeping workers and was stopped after eight minutes.
**Gherkin:** ✅ 83 scenarios pass (986 steps)
**Build:** ✅ Success (tsup and declaration build in focused test/release/BDD lanes)
**Lint:** ✅ Clean (ESLint, Gherkin lint, TypeScript typecheck)
**Scenarios:** All 1 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ No dependency changes
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal verification plumbing
**Evidence limits:** ⚠️ Full aggregate Vitest run stalled after the preflight; the focused skill, generated-plugin, and isolated BDD lanes are product evidence, while the stalled aggregate run is not.

## Closeout reviews

**Audit:** Passes for this patch. Dependency-cruiser found no violations and config sync is current. The changed contract test has specific behavioral assertions, no mocks, no time-based waits, and exercises the actual template, dogfood, and generated-plugin files. Audit also found unrelated repository hygiene work: outdated `TheMostlyGreat/safeword` links in configured docs while `origin` is `ArcadeAI/safeword`, a Knip unlisted `feature-directories` binary plus three stale ignore entries, and two low-risk dev-tool minor updates (`@openai/codex` and `knip`). The reported `TB`/`SM` persona codes are documented legacy aliases in `ARCHITECTURE.md`, so they are audit-check false positives rather than catalog drift. No unrelated change was added to this patch.

**Quality review:** APPROVE. The current Git manual confirms `git init <directory>` creates the disposable repository being preflighted, and the GNU Findutils manual confirms depth-first deletion semantics. The exact preflight block completed locally after the change; the test is a real-files contract with no mock boundary. Sources checked: https://git-scm.com/docs/git-init and https://www.gnu.org/software/findutils/manual/find.pdf.

**Refactor:** No change. The four source copies are required delivery mirrors and the `it.each(allVerifySurfaces)` contract is already the smallest clear expression; extracting or generalizing it would add indirection without reducing maintenance risk.

The ticket stays `status: in_progress` and must not be marked done from this record.
