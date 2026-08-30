import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { runRecordSkillInvocation } from '../../src/commands/record-skill-invocation.js';
import { createTemporaryDirectory } from '../helpers.js';

describe('project record-skill-invocation', () => {
  it('creates missing runtime state and its precise ignore rule without installing', async () => {
    const cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword/SAFEWORD.md'), '# enrolled\n');

    const result = await runRecordSkillInvocation(cwd, 'verify', 'session-1');

    expect(result.state).toBe('changed');
    expect(readFileSync(nodePath.join(cwd, '.project/skill-invocations.log'), 'utf8')).toContain(
      'session-1 verify',
    );
    expect(readFileSync(nodePath.join(cwd, '.project/.gitignore'), 'utf8')).toContain(
      '/skill-invocations.log',
    );
    expect(existsSync(nodePath.join(cwd, '.safeword/hooks'))).toBe(false);
  });
});
