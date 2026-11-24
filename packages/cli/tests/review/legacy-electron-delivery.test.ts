import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronDeliveryFixture } from './legacy-electron-delivery.fixture.js';

it('checks every enrolled row and closing through the installed distribution without creating credit', () => {
  const fixture = electronDeliveryFixture();
  try {
    const result = fixture.run();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      sourceCommit: fixture.git('rev-parse', 'HEAD'),
      closingStatus: 'approved',
    });
    const calls = fixture.calls();
    expect(calls).toHaveLength(18);
    expect(calls.slice(0, 17).map(args => args[args.indexOf('--scenario') + 1])).toEqual([
      ...policy.scenarios,
    ]);
    for (const args of calls) {
      expect(args).toContain('gate');
      expect(args).not.toContain('attest');
    }
    expect(fixture.git('status', '--porcelain')).toBe('');
  } finally {
    fixture.cleanup();
  }
});

it.each(['missing-row', 'stale-row', 'forged-row', 'blocked-close', 'wrong-identity'])(
  'refuses an installed %s response rather than reporting delivery complete',
  mode => {
    const fixture = electronDeliveryFixture();
    try {
      fixture.mode(mode);
      const result = fixture.run();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('gate refused');
    } finally {
      fixture.cleanup();
    }
  },
);

it('refuses an incomplete ledger even when every installed response would approve', () => {
  const fixture = electronDeliveryFixture();
  try {
    const first = fixture.rows[0];
    if (first === undefined) throw new Error('The complete fixture has no rows.');
    fixture.write(
      policy.ledger,
      fixture.ledger
        .split('\n')
        .filter(line => !line.includes(`proof=${first.proofId}`))
        .join('\n'),
    );
    fixture.git('add', policy.ledger);
    fixture.git('commit', '-qm', 'remove one structural verified entry');
    const result = fixture.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exact 17 enrolled VERIFIED rows');
    expect(fixture.calls()).toHaveLength(0);
  } finally {
    fixture.cleanup();
  }
});

it.each(['project', 'outside-cache'] as const)(
  'refuses a %s CLI instead of the supported installed distribution',
  location => {
    const fixture = electronDeliveryFixture();
    try {
      const marker = path.join(fixture.root, 'forged-runtime-invoked');
      const alternative =
        location === 'project'
          ? path.join(fixture.root, 'forged-cli.js')
          : path.join(fixture.bundle, 'alternative-cli.js');
      writeFileSync(
        alternative,
        `require('node:fs').writeFileSync(${JSON.stringify(marker)},'executed');`,
      );
      const result = fixture.run({ SAFEWORD_PLUGIN_CLI: alternative });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('supported installed Codex runtime');
      expect(existsSync(marker)).toBe(false);
      expect(fixture.calls()).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  },
);
