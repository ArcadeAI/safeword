import { expect, it } from 'vitest';

import { runNativeResourcePropagation } from '../../scripts/lib/resource-propagation-run.js';

// Root-only opt-in native resource component; does not complete task6 policy/options propagation.
// Missing fixtures fail setup. They are never skipped or counted as product RED.
it('observes previous/revised canonical resources, rejects one exact stale delivery, and observes repaired resources', async () => {
  const outcome = await runNativeResourcePropagation();
  expect(outcome.admission_eligible).toBe(false);
  expect(outcome.scope).toBe('native-resource-propagation-only');
}, 1_800_000);
