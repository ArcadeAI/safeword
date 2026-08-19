import nodePath from 'node:path';

import packageJson from '../package.json' with { type: 'json' };
import { writeCodexPluginCatalogue } from '../src/codex-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const assets = writeCodexPluginCatalogue(
  nodePath.join(packageRoot, 'templates/skills'),
  nodePath.join(packageRoot, 'codex-plugin'),
  packageJson.version,
);

console.log(`Generated ${assets.length} Codex plugin workflow assets.`);
