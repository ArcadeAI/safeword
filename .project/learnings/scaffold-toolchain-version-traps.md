# Scaffolded Toolchain Version Traps

Covers: TypeScript 6 types default, typescript-eslint TypeScript peer range, npm depcruise placeholder, bunx bare bin names, dependency-cruiser zero modules.

Three facts that each broke a fresh install or a quality check silently
(issues 6966 and 7514). Re-check them against the registry before changing the scaffold. They
move with releases.

## TypeScript 6 defaults `types` to `[]`

Before 6.0, every visible `@types/*` package was loaded automatically. From
6.0, nothing is, so steps importing `node:` modules fail to typecheck unless
the tsconfig sets `"types": ["node"]`. The scaffolded tsconfig adds it whenever
the BDD lane (which installs `@types/node`) is present.

## typescript-eslint caps the TypeScript version

`typescript-eslint` declares `typescript: >=4.8.4 <6.1.0` (8.73, Nov 2026),
while npm's latest TypeScript is 7.x. Install pins `typescript@~6.0.0` and
never re-pins a TypeScript the project already declares or resolves (hoisted
monorepo workspaces count). Check `npm view typescript-eslint peerDependencies`
before raising the pin.

## `bunx depcruise` runs a placeholder

dependency-cruiser's bin is `depcruise`, but the npm package named
`depcruise` is an empty dependency-confusion placeholder. With no local
install, `bunx depcruise` downloads it and reports nothing. Never resolve a
bare bin name through `bunx`/`npx`; run `node_modules/.bin/<bin>` or name the
package explicitly. Even `bunx --package dependency-cruiser` cruises **0
modules** in a TS project, because a temp install can't resolve the project's
`typescript`. The audit treats "(0 modules" as manual evidence, not a pass.
