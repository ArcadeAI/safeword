import { execFileSync } from 'node:child_process';

import { defineConfig } from 'tsup';

const buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts', 'src/presets/typescript/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  shims: false,
  // Exclude devDependencies that have native bindings from bundling
  noExternal: [],
  skipNodeModulesBundle: true,
  define: {
    __SAFEWORD_BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
});
