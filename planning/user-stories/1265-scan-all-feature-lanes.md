# Issue 1265: Scan all feature lanes for surface-tag drift

## User story

As a maintainer of a monorepo, I want the audit's E008 check to inspect every executable feature lane so that an undefined `@surface.<slug>` tag cannot be reported as clean merely because it resides outside root `features/`.

## Acceptance criteria

- E008 uses the same feature-directory set as the CLI's Gherkin discovery.
- An undefined tag in `packages/<package>/features/` produces E008.
- The audit skill remains byte-aligned across its shipped copies.
