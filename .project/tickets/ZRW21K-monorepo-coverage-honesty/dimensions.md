# Dimensions: Monorepo coverage honesty (ZRW21K)

| Dimension                 | Partitions                                                                 | Source  |
| ------------------------- | -------------------------------------------------------------------------- | ------- |
| Workspace config          | pnpm-workspace.yaml · package.json `workspaces` · none (single repo)       | TB1     |
| Package introspectability | has `src/` (introspected, gets leaf) · no `src/` (un-introspected, marked) | TB2     |
| Regression surface        | single-repo output · npm-workspaces output (must be unchanged)             | TB1.AC2 |

## Partition → scenario mapping

- pnpm config × has-src → TB1.AC1 (root index + leaf).
- none × has-src → TB1.AC2 (single doc, no leaves; regression).
- npm config × has-src → TB1.AC2 (still discovered; regression).
- pnpm/npm × no-src → TB2.AC1 (listed + "not introspected" marker, no leaf).
- pnpm/npm × has-src → TB2.AC2 (listed, no marker).

## Boundary notes

- pnpm precedence: `package.json workspaces` wins when present; pnpm-workspace.yaml
  is the fallback (so a repo with both is unchanged from today).
- "no recognized source layout" = empty skeleton from `extractSkeleton` — covers
  both a JS package without `src/` and a non-JS package, honestly, without
  claiming language support (that's WBM8JE).
- Out of scope here: flow-style pnpm YAML, `!`-exclusions, dirs without package.json.
