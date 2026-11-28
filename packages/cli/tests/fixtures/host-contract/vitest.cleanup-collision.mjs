import path from 'node:path';

import { mergeConfig } from 'vitest/config';

import normal from '../../../vitest.config.ts';

const schema = path.resolve(import.meta.dirname, '../../../src/schema.ts');
export default mergeConfig(normal, {
  plugins: [
    {
      name: 'inject-disposable-cleanup-collision',
      transform(code, id) {
        return id === schema
          ? `${code}\nSAFEWORD_SCHEMA.deprecatedFiles.push(process.env.SAFEWORD_COLLISION_ASSET);`
          : undefined;
      },
    },
  ],
});
