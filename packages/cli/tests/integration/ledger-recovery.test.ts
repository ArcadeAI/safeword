import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const roots: string[] = [];

function recoveryGate(root: string, ticket: string) {
  return spawnSync(
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
      ticket,
    ],
    { encoding: 'utf8', timeout: 10_000 },
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('bounded completion recovery through the public CLI', () => {
  it('refuses another ticket with the exact recovery scope finding', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ledger-recovery-'));
    roots.push(root);
    const result = recoveryGate(root, 'OTHER1');
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

  it('keeps the approved ticket blocked without authenticated current proof', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ledger-recovery-missing-'));
    roots.push(root);
    const result = recoveryGate(root, '5F5ZZA');
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings).toEqual([
      {
        code: 'LEDGER_RECOVERY_EVIDENCE_MISSING',
        severity: 'warning',
        message: 'Authenticated current completion evidence is required.',
      },
    ]);
    expect(envelope.changed).toBe(false);
    expect(envelope.effects.files).toEqual([]);
    expect(readdirSync(root)).toEqual([]);
  });

  it('rejects a rewritten checked historical row and retains the altered bytes', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ledger-recovery-history-'));
    roots.push(root);
    const folder = nodePath.join(
      root,
      '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy',
    );
    mkdirSync(folder, { recursive: true });
    const ledger = nodePath.join(folder, 'test-definitions.md');
    const source = readFileSync(
      nodePath.resolve(
        import.meta.dirname,
        '../../../../.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md',
      ),
      'utf8',
    );
    writeFileSync(ledger, source);
    const valid = recoveryGate(root, '5F5ZZA');
    expect(JSON.parse(valid.stdout).findings[0]?.code).toBe('LEDGER_RECOVERY_EVIDENCE_MISSING');
    const changed = source.replace('- [x] RED', '- [ ] RED');
    expect(changed).not.toBe(source);
    writeFileSync(ledger, changed);
    const result = recoveryGate(root, '5F5ZZA');
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).findings[0]?.code, result.stdout + result.stderr).toBe(
      'LEDGER_RECOVERY_HISTORY_CHANGED',
    );
    expect(readFileSync(ledger, 'utf8')).toBe(changed);
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
