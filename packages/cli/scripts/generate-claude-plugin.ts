import nodePath from 'node:path';

import packageJson from '../package.json' with { type: 'json' };
import { writeClaudePluginCatalogue } from '../src/claude-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const repoRoot = nodePath.resolve(packageRoot, '../..');
const assets = writeClaudePluginCatalogue(
  {
    templatesRoot: nodePath.join(packageRoot, 'templates'),
    version: packageJson.version,
  },
  nodePath.join(repoRoot, 'plugin'),
);

console.log(`Generated ${assets.length} Claude plugin assets.`);
