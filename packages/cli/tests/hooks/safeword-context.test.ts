import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSafewordContextResponse,
  needsSafewordContext,
  readSafewordContext,
} from '../../templates/hooks/lib/safeword-context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) removeTemporaryDirectory(root);
  roots.length = 0;
});

describe('Safeword standing context authority', () => {
  it('keeps every host payload compact while pointing to the full handbook', () => {
    const root = createTemporaryDirectory();
    roots.push(root);
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(root, '.safeword/SAFEWORD.md'),
      `# Full standing instructions\n${'details '.repeat(3000)}`,
    );

    const standingContext = readSafewordContext(root);
    const response = createSafewordContextResponse('codex', standingContext) ?? '{}';
    const context = (JSON.parse(response) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;

    expect(context.indexOf('.project/')).toBeGreaterThanOrEqual(0);
    expect(context).toMatch(/supersed|ignore/i);
    expect(context).toContain(
      `First, Read \`${nodePath.resolve(root, '.safeword/SAFEWORD.md')}\` in full, even for trivial requests or right after compaction; a summary or earlier read does not count.`,
    );
    expect(context).not.toContain('# Full standing instructions');
    expect(context.length).toBeLessThanOrEqual(1000);

    const claudeResponse = createSafewordContextResponse('claude', standingContext) ?? '{}';
    const claudeContext = (
      JSON.parse(claudeResponse) as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;
    expect(claudeContext).not.toContain('Current Safeword authority');
    expect(claudeContext).toContain('.safeword/SAFEWORD.md');
    expect(claudeContext).not.toContain('# Full standing instructions');
    expect(claudeContext.length).toBeLessThanOrEqual(1000);

    const cursorResponse = createSafewordContextResponse('cursor', standingContext) ?? '{}';
    const cursorContext = (JSON.parse(cursorResponse) as { additional_context: string })
      .additional_context;
    expect(cursorContext).not.toContain('Current Safeword authority');
    expect(cursorContext).toContain('.safeword/SAFEWORD.md');
    expect(cursorContext).not.toContain('# Full standing instructions');
    expect(cursorContext.length).toBeLessThanOrEqual(1000);
  });

  it('uses a packaged handbook as authority without exposing its contents', () => {
    const root = createTemporaryDirectory();
    roots.push(root);
    const packagedHandbook = nodePath.join(root, 'packaged-SAFEWORD.md');
    writeFileSync(packagedHandbook, '# Packaged standing instructions\nPackage-only detail');

    const previousPath = process.env.SAFEWORD_PACKAGED_CONTEXT_PATH;
    process.env.SAFEWORD_PACKAGED_CONTEXT_PATH = packagedHandbook;
    try {
      const context = readSafewordContext(root);

      expect(context).toBe(
        `First, Read \`${packagedHandbook}\` in full, even for trivial requests or right after compaction; a summary or earlier read does not count.`,
      );
      expect(context).not.toContain('.safeword/SAFEWORD.md');
      expect(context).not.toContain('Package-only detail');
      expect(context?.length).toBeLessThanOrEqual(1000);
    } finally {
      if (previousPath === undefined) {
        delete process.env.SAFEWORD_PACKAGED_CONTEXT_PATH;
      } else {
        process.env.SAFEWORD_PACKAGED_CONTEXT_PATH = previousPath;
      }
    }
  });

  it('re-instructs the read at startup, clear and compaction but not on resume', () => {
    for (const source of ['startup', 'clear', 'compact', undefined]) {
      expect(needsSafewordContext({ source })).toBe(true);
    }
    expect(needsSafewordContext({ source: 'resume' })).toBe(false);
  });
});
