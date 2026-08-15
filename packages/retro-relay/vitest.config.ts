import { defineConfig } from 'vitest/config';

import { defaultVitestInclude } from '../../vitest.default-projects.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: defaultVitestInclude('packages/retro-relay'),
  },
});
