import { readFileSync, writeSync } from 'node:fs';
import path from 'node:path';

import { migrateClaudeLegacyAutomatically } from '../../../src/claude-plugin/cleanup.js';
import { historicalCatalogueDigest } from '../../../src/claude-plugin/historical-ownership.js';
import { claudeProjectStatePath } from '../../../src/claude-plugin/migration-state.js';

const project = process.cwd();
const identity = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../../../../plugin/identity.json'), 'utf8'),
);
migrateClaudeLegacyAutomatically(project, {
  pluginVersion: identity.plugin_version,
  hookManifestSha256: identity.hook_manifest_sha256,
  catalogueSha256: historicalCatalogueDigest(),
  deadline: Date.now() + 60_000,
  beforeApply() {
    writeSync(1, claudeProjectStatePath(project, 'transaction'));
    process.kill(process.pid, 'SIGKILL');
  },
});
throw new Error('The cleanup never reached its before-apply boundary');
