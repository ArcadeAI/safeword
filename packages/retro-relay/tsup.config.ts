import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts'],
  clean: true,
  dts: true,
  format: ['esm'],
  platform: 'node',
  sourcemap: true,
  target: 'node22',
});
