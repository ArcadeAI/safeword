import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('bounded completion recovery through the installed CLI', () => {
  it('refuses another ticket with the exact recovery scope finding', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ledger-recovery-'));
    roots.push(root);
    const result = spawnSync(
      process.execPath,
      [
        cli,
        '--json',
        '--no-input',
        '--cwd',
        root,
        'review',
        'gate',
        'ledger-recovery',
        '--ticket',
        'OTHER1',
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.status).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings).toEqual([
      {
        code: 'LEDGER_RECOVERY_SCOPE_MISMATCH',
        severity: 'warning',
        message: 'Completion recovery is limited to the approved 5F5ZZA scope.',
      },
    ]);
    expect(envelope.changed).toBe(false);
  });
});
