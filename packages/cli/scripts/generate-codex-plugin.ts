import nodePath from 'node:path';

import { writeCodexPluginCatalogue } from '../src/codex-plugin/catalogue.js';
import { VERSION } from '../src/version.js';

await import('./generate-scenario-rubric.js');
await import('./generate-plan-rubric.js');
await import('./generate-quality-rubric.js');

const packageRoot = nodePath.resolve(import.meta.dirname, '..');
const assets = writeCodexPluginCatalogue(
  nodePath.join(packageRoot, 'templates/skills'),
  nodePath.join(packageRoot, 'codex-plugin'),
  VERSION,
);

console.log(`Generated ${assets.length} Codex plugin workflow assets.`);
