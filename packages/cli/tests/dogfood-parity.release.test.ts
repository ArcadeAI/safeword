/**
 * Release gate: dogfood parity check.
 *
 * Ensures dogfood files (repo root) match their canonical templates.
 * Excluded from `bun run test` so template iteration doesn't block the main suite.
 * Run with: bun run test:release
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const templatesDirectory = nodePath.join(import.meta.dirname, '../templates');

describe('dogfood parity', () => {
  it('should have dogfood files identical to their canonical templates', async () => {
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

    const mismatches: string[] = [];

    for (const [destinationPath, definition] of Object.entries(SAFEWORD_SCHEMA.ownedFiles)) {
      if (!definition.template) continue;

      const templateFile = nodePath.join(templatesDirectory, definition.template);
      const dogfoodFile = nodePath.join(repoRoot, destinationPath);

      // Skip if dogfood file doesn't exist (e.g. .jscpd.json may not be in dogfood)
      if (!existsSync(dogfoodFile)) continue;

      const templateContent = readFileSync(templateFile, 'utf8');
      const dogfoodContent = readFileSync(dogfoodFile, 'utf8');

      if (templateContent !== dogfoodContent) {
        mismatches.push(`'${destinationPath}' differs from template '${definition.template}'`);
      }
    }

    if (mismatches.length > 0) {
      expect.fail(
        `Dogfood files differ from templates. Copy dogfood → templates to sync:\n  - ${mismatches.join('\n  - ')}`,
      );
    }
  });
});
