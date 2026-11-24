import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import {
  attestElectronRetrospectiveClose,
  electronRetrospectiveCloseGate,
} from '../../src/review/retrospective-electron-close.js';
import { attestElectronRetrospectiveRow } from '../../src/review/retrospective-electron-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { runCliWithLiteralArguments } from '../helpers.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it('refuses closing before every enrolled historical row has separate verified credit', async () => {
  const fixture = await electronAuthorizationFixture();
  try {
    const result = await runCliWithLiteralArguments(
      [
        '--cwd',
        fixture.root,
        '--json',
        '--no-input',
        'review',
        'attest',
        'retrospective-close',
        '--ticket',
        policy.ticketId,
        '--ledger',
        policy.ledger,
      ],
      { cwd: fixture.root, env: fixture.environment },
    );
    expect(result.exitCode).not.toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.data).toMatchObject({
      command: 'review attest retrospective-close',
      status: 'blocked',
      ticketId: policy.ticketId,
      ledger: policy.ledger,
    });

    expect(payload.findings[0]?.message).toContain('Missing required Electron VERIFIED row');
    expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(2);
  } finally {
    fixture.cleanup();
  }
});

it('replays exactly all 17 approved rows before signing the current closing view', async () => {
  const fixture = await electronAuthorizationFixture(true);
  try {
    const claims = await fixture.completeRows();
    const before = fixture.events().filter(event => event.event === 'test').length;
    const result = await attestElectronRetrospectiveClose(
      fixture.root,
      policy.ticketId,
      policy.ledger,
    );
    expect(result.state, JSON.stringify(result)).toBe('changed');
    const executions = fixture
      .events()
      .filter(event => event.event === 'test')
      .slice(before);
    expect(executions).toHaveLength(34);
    expect(executions.map(event => event.scenario)).toEqual(
      claims.flatMap(claim => [claim.scenario, claim.scenario]),
    );
    const gate = await runCliWithLiteralArguments(
      [
        '--cwd',
        fixture.root,
        '--json',
        '--no-input',
        'review',
        'gate',
        'retrospective-close',
        '--ticket',
        policy.ticketId,
        '--ledger',
        policy.ledger,
      ],
      { cwd: fixture.root, env: fixture.environment, timeout: 120_000 },
    );
    expect(gate.exitCode, `${gate.stdout}\n${gate.stderr}`).toBe(0);
    expect(JSON.parse(gate.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        command: 'review gate retrospective-close',
        status: 'approved',
        ticketId: policy.ticketId,
        ledger: policy.ledger,
      },
    });
  } finally {
    fixture.cleanup();
  }
}, 600_000);

it('refuses a previously signed aggregate after a same-HEAD row replay fails', async () => {
  const fixture = await electronAuthorizationFixture(true);
  try {
    const claims = await fixture.completeRows();
    const first = claims[0];
    if (first === undefined) throw new Error('The complete fixture has no rows.');
    const initial = await attestElectronRetrospectiveClose(
      fixture.root,
      policy.ticketId,
      policy.ledger,
    );
    expect(initial.state, JSON.stringify(initial)).toBe('changed');
    const record = path.join(
      fixture.root,
      '.safeword/state/reviews/electron-retrospective-close-v1.json',
    );
    const signed = readFileSync(record, 'utf8');
    const commit = fixture.git('rev-parse', 'HEAD');
    vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', 'surviving-mutation');
    const failed = await attestElectronRetrospectiveRow(fixture.root, first);
    expect(failed.state).toBe('action_required');
    vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', '');
    expect(fixture.git('rev-parse', 'HEAD')).toBe(commit);
    expect(readFileSync(record, 'utf8')).toBe(signed);
    const gate = electronRetrospectiveCloseGate(fixture.root, policy.ticketId, policy.ledger);
    expect(gate.state).toBe('action_required');
    expect(gate.findings[0]?.message).toContain(first.scenario);
    const count = fixture.events().length;
    const retry = await attestElectronRetrospectiveClose(
      fixture.root,
      policy.ticketId,
      policy.ledger,
    );
    expect(retry.state).toBe('action_required');
    expect(fixture.events()).toHaveLength(count);
  } finally {
    fixture.cleanup();
  }
}, 600_000);
