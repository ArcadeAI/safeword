import { createRequire } from 'node:module';

import { expect, it } from 'vitest';

it('keeps brace patterns working in the ESLint accessibility plugin glob matcher', () => {
  const require = createRequire(import.meta.url);
  const pluginRequire = createRequire(require.resolve('eslint-plugin-jsx-a11y'));
  const minimatch = pluginRequire('minimatch') as (path: string, pattern: string) => boolean;

  expect(minimatch('button.jsx', '*.{jsx,tsx}')).toBe(true);
  expect(minimatch('button.tsx', '*.{jsx,tsx}')).toBe(true);
  expect(minimatch('button.js', '*.{jsx,tsx}')).toBe(false);
});
