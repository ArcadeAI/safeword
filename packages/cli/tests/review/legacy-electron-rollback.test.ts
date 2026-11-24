import { expect, it } from 'vitest';

import { legacyElectronRollback } from './legacy-electron-rollback.fixture.js';

it('the immutable previous generated bundle refuses new-policy row and closing records without modifying them', () => {
  const result = legacyElectronRollback();
  expect(result.runtimeBlob).toBe('85084cbcc4eb5fba197efe127139909f92f9346a');
  expect(result.row.data.status).toBe('blocked');
  expect(result.close.data.status).toBe('blocked');
  expect(result.unchanged).toBe(true);
});
