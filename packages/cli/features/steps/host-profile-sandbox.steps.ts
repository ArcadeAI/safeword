import { BeforeAll } from '@cucumber/cucumber';

import {
  assertIsolatedHostProfile,
  hostProfileSandbox,
} from '../../tests/helpers/host-profile-sandbox.ts';

/**
 * The acceptance lane runs the real Safeword CLI against throwaway projects,
 * and Safeword's Claude install ends in `claude plugin install`. Without a
 * sandboxed profile those runs record `$TMPDIR/safeword-*` projects in the
 * developer's real `~/.claude/plugins/installed_plugins.json`, which Claude
 * Code never prunes (issue #4776).
 *
 * `BeforeAll` rather than module scope: it is order-independent across the
 * step-import globs, and it runs before the first scenario touches the host.
 */
BeforeAll(function hostProfileIsSandboxed() {
  process.env.CLAUDE_CONFIG_DIR = hostProfileSandbox();
  assertIsolatedHostProfile(process.env);
});
