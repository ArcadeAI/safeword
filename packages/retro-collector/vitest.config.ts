import { configDefaults, defineConfig } from 'vitest/config';

import { defaultVitestExclude, defaultVitestInclude } from '../../vitest.default-projects.js';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration files spawn services; keep startup checks free of
    // competing fixture processes on the four-core CI runner.
    fileParallelism: false,
    include: defaultVitestInclude('packages/retro-collector'),
    exclude: [...configDefaults.exclude, ...defaultVitestExclude('packages/retro-collector')],
  },
});
