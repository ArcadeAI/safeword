# Verification

- ✓ 65/65 targeted tests pass: CLI catalog, install/uninstall planning, plan completeness, and Claude profile installation.
- Final fixture cleanup recheck: 22/22 Claude profile tests pass.
- Package build passes through the test wrapper.
- ESLint passes for all changed TypeScript files.
- `git diff --check` passes.
- Claude plugin release contract check passes after restoring the required default-install README example.
- Regenerated Claude and Codex bundled CLIs; their runtime files are byte-identical.
- Release verification: all 28 selected assertions passed across three files. One historical catalogue check exceeded the default 15-second timeout; its file passed 8/8 on rerun with a 60-second timeout and unchanged assertions.
- **Gherkin:** 102/102 Claude acceptance scenarios and 4,787/4,787 steps pass. Three old-default assertions were corrected after a failing run.
- Tart: three real Claude installer cases pass, including cross-project visibility, scope isolation, idempotency, and BDD skill discovery.
- Consumer BDD: 1/1 starter scenario passes in each of the user-scope and project-scope installed projects.
**PR Scope:** ✅ Diff matches ticket scope; install and uninstall planning use the same default scope.

## Evidence limits

Unit and Cucumber tests use isolated fake Claude executables. The installer was additionally verified with real Claude Code in a disposable Tart VM; see tart-verification.md. Authenticated BDD activation and intake passed in the VM; a second project loaded the global skill successfully, both projects produced valid hook proof and healthy status, and an incomplete phase transition was blocked. The complete feature-development lifecycle was attempted but remains unverified: the VM reviewer cannot run with its enterprise MCP configuration. Scenario authoring and implementation planning were reached; TDD and closeout were not completed. The host Claude profile was untouched. No release was published; full suite was not run.

- Authenticated follow-up: final intake session and second-project session exited successfully; real cached skill reads, populated intake artifacts, per-project hook proof, and healthy user-scope status verified from saved evidence.
