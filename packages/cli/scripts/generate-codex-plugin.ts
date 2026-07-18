import nodePath from 'node:path';

import { writeCodexPluginCatalogue } from '../src/codex-plugin/catalogue.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const assets = writeCodexPluginCatalogue(
  nodePath.join(packageRoot, 'templates/skills'),
  nodePath.join(packageRoot, 'codex-plugin'),
);

console.log(`Generated ${assets.length} Codex plugin workflow assets.`);
