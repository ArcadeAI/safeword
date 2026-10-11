import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('bounded completion recovery through the public CLI', () => {
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
    const envelope = JSON.parse(result.stdout);
    expect(envelope.findings[0]?.code, `${result.stdout}\n${result.stderr}`).toBe(
      'LEDGER_RECOVERY_SCOPE_MISMATCH',
    );
    expect(result.status).toBe(2);
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings).toEqual([
      {
        code: 'LEDGER_RECOVERY_SCOPE_MISMATCH',
        severity: 'warning',
        message: 'Completion recovery is limited to the approved 5F5ZZA scope.',
      },
    ]);
    expect(envelope.changed).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });

  it('proves the same empty-project fixture reaches the existing retrospective scope guard', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ledger-recovery-control-'));
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
        'retrospective',
        '--ticket',
        'OTHER1',
        '--scenario',
        'Example',
        '--ledger',
        'test-definitions.md',
        '--eligibility',
        '00000000-0000-0000-0000-000000000001',
        '--proof',
        '00000000-0000-0000-0000-000000000002',
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings[0]?.code).toBe('RETROSPECTIVE_GATE_BLOCKED');
    expect(envelope.changed).toBe(false);
  });
});
