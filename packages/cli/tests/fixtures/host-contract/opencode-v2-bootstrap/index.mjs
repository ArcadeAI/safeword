// Host-loadable RED carrier only. It supplies no guard or permission decision.
/* eslint-disable import-x/no-unresolved -- the exact native OpenCode host supplies this SDK */
import { Plugin } from '@opencode/plugin';
/* eslint-enable import-x/no-unresolved */

export default Plugin.define({
  id: 'safeword-opencode-v2-bootstrap',
  setup() {
    // Intentionally missing the production guard: this carrier is the RED baseline.
  },
});
