## Verify Checklist

**Test Suite:** 100/100 focused tests passed across the planning fallback, finish-review contract, and review job suites. GitHub’s full package test step passed on both Node versions for the implementation in d32ddd500.
**Gherkin:** The planning fallback has executable CLI integration coverage. The repository-wide acceptance lane runs in Node 24 CI.
**Build:** CLI build passed.
**Lint:** CI lint passed. All five generated surfaces regenerated and verified.
**Typecheck:** CLI TypeScript check passed.
**Scenarios:** An exhausted planning review returns instructions with the planning evidence requirement and the current dispatch ID.
**Refactor:** The rubric, output schema, and continuation use the same sealed packet.
**PR Scope:** ✅ Diff matches ticket scope. Coordinator, reviewer instructions, regression tests, generated distributions and fixtures, and delivery evidence.
**Dep Drift:** No dependency changes relative to the merge base. Dependency audit passed in CI.
**Parent Epic:** N/A.
**Reconcile:** Uses the existing validator schema and packet contract.
**Experience / Surface Evidence:** Ran the packaged CLI against a repository implementation plan with headless reviewers absent from PATH. The command returned continuation_required. Parsed the schema from the returned instructions and verified evidence_records is required and the dispatch ID enum equals the packet dispatch ID.
**Independent review:** Approved by Claude, receipt e99cb1db-99a7-477e-bac7-25b22cfb06da. Findings about degraded-route recovery and metadata, network effects, budget diagnostics, retry iteration, and duplicated routing logic concern code shared with main. This patch changes only the instructions supplied for a fresh host continuation.
**Evidence limits:** The first full local CLI run had 12,050 passes, 14 skips and five failures. Lock serialization and process termination checks passed on targeted retry. Both remaining routing timeout cases and the OpenCode startup failure reproduced on the unmodified merge base, 408343fbb. Both CI package-test matrices passed on this implementation. No live model verdict was needed for the manual fallback walkthrough.

### Cursor fallback review

The Cursor integration case failed when it required the advertised reviewer identity to match the submitting host. After binding the schema to the host author, the packaged CLI returned exactly `["cursor"]` and the sealed dispatch ID for a Cursor planning fallback. The CLI build and typecheck passed. The fallback, runtime, job and finish-review suites passed 170 tests with two skipped. All five generated surfaces verified. All seven tracked reviewer guide copies have the same SHA-256 digest as the Claude historical catalogue and the bundled runtimes.
