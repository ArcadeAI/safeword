import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSafewordContextResponse,
  readSafewordContext,
} from '../../templates/hooks/lib/safeword-context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

describe('Safe Word standing context authority', () => {
  it('puts current paths and the legacy-path override before the full standing instructions', () => {
    const root = createTemporaryDirectory();
    roots.push(root);
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(root, '.safeword/SAFEWORD.md'), '# Full standing instructions');

    const standingContext = readSafewordContext(root);
    const response = createSafewordContextResponse('codex', standingContext) ?? '{}';
    const context = (JSON.parse(response) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;

    expect(context.indexOf('.project/')).toBeGreaterThanOrEqual(0);
    expect(context.indexOf('.safeword/guides/')).toBeGreaterThanOrEqual(0);
    expect(context).toMatch(/supersed|ignore/i);
    expect(context.indexOf('.project/')).toBeLessThan(
      context.indexOf('# Full standing instructions'),
    );

    const claudeResponse = createSafewordContextResponse('claude', standingContext) ?? '{}';
    const claudeContext = (
      JSON.parse(claudeResponse) as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;
    expect(claudeContext).not.toContain('Current Safe Word authority');

    const cursorResponse = createSafewordContextResponse('cursor', standingContext) ?? '{}';
    const cursorContext = (JSON.parse(cursorResponse) as { additional_context: string })
      .additional_context;
    expect(cursorContext).not.toContain('Current Safe Word authority');
  });
});
