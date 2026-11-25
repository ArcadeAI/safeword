# Dependencies

The [CLI manifest](../../packages/cli/package.json) lists the dependencies and their supported versions.

## Runtime (`dependencies`)

The CLI edits Claude settings with a range-aware JSONC parser to preserve unrelated comments and formatting. Before sending a retrospective, the CLI scans it for secrets in the same process.

## Dev (`devDependencies`)

Build, test, and release tools belong to the package that runs them. The root workspace owns the loader for its TypeScript ESLint configuration.

## Peer

Projects consuming the ESLint preset supply a compatible ESLint runtime. The CLI manifest declares its peer range.
