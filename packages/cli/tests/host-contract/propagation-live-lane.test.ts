import { expect, it } from 'vitest';

import smoke from '../../vitest.live.config.js';
import propagation from '../../vitest.propagation.config.js';

it('keeps the required eight-delivery propagation proof out of the unrelated default model smoke', () => {
  expect(smoke.test?.exclude ?? [], 'PROPAGATION_REQUIRED_GROUP_LEAKS_INTO_SMOKE').toContain(
    'tests/host-contract/propagation.live.test.ts',
  );
  expect(propagation.test?.include).toEqual(['tests/host-contract/propagation.live.test.ts']);
});
