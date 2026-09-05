import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts', 'src/worker.ts', 'src/worker-main.ts'],
  clean: true,
  dts: true,
  format: ['esm'],
  platform: 'node',
  removeNodeProtocol: false,
  sourcemap: true,
  target: 'node24',
});
