# Test Structure

The [CLI scripts](../../packages/cli/package.json) select Vitest configurations for unit, integration, smoke, live-model, and release-contract tests. Live tests exercise provider behavior. Release tests check the shipped package and generated surfaces. Gherkin scenarios exercise user-visible workflows.

The [root scripts](../../package.json) coordinate tests and builds across the CLI and retrospective services. Run repository development commands through `scripts/dev` to use the pinned toolchain.
