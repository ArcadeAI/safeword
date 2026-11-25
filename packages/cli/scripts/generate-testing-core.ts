import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { TESTING_CORE_LAYOUT } from '../src/schema-layouts.js';
import { withTestingCore } from '../src/testing/shared-core.js';
import {
  isDirectGeneratorInvocation,
  reconcileGeneratedFile,
} from './lib/reconcile-generated-file.js';

/** Canonical materialization precedes both raw-template installs and host renderers. */
export function generateTestingCore(check = false): void {
  for (const template of TESTING_CORE_LAYOUT.templates) {
    const outputPath = nodePath.resolve(import.meta.dirname, '../templates', template);
    const content = withTestingCore(readFileSync(outputPath, 'utf8'));
    if (reconcileGeneratedFile({ check, content, outputPath }) === 'stale')
      throw new Error(
        `${template} essential testing core is stale; run scripts/generate-testing-core.ts`,
      );
  }
}

if (isDirectGeneratorInvocation(import.meta.filename))
  generateTestingCore(process.argv.includes('--check'));
