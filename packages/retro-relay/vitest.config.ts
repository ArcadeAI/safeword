import { defineConfig } from 'vitest/config';

import { defaultVitestExclude, defaultVitestInclude } from '../../vitest.default-projects.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: defaultVitestInclude('packages/retro-relay'),
    exclude: defaultVitestExclude('packages/retro-relay'),
  },
});
