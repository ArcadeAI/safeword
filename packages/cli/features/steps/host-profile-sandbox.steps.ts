import { BeforeAll } from '@cucumber/cucumber';

import {
  assertIsolatedHostProfile,
  codexHomeSandbox,
  hostProfileSandbox,
} from '../../tests/helpers/host-profile-sandbox.ts';

/**
 * The acceptance lane runs the real Safeword CLI against throwaway projects,
 * and Safeword's Claude install ends in `claude plugin install`. Without a
 * sandboxed profile those runs record `$TMPDIR/safeword-*` projects in the
 * developer's real `~/.claude/plugins/installed_plugins.json`, which Claude
 * Code never prunes (issue #4776).
 *
 * CODEX_HOME is sandboxed for the same reason with a different symptom: the
 * lane's commands read safeword's own ~/.codex proof records, whose
 * `recorded_at` a live Codex hook rewrites mid-run.
 *
 * `BeforeAll` rather than module scope: it is order-independent across the
 * step-import globs, and it runs before the first scenario touches the host.
 */
BeforeAll(function hostProfileIsSandboxed() {
  process.env.CLAUDE_CONFIG_DIR = hostProfileSandbox();
  process.env.CODEX_HOME = codexHomeSandbox();
  assertIsolatedHostProfile(process.env);
});
