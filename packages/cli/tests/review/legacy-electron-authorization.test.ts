import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import {
  attestElectronRetrospectiveRow,
  electronRetrospectiveGate,
} from '../../src/review/retrospective-electron-gate.js';
import { runElectronProof } from '../../src/review/retrospective-electron-proof.js';
import { SOULLESS_RETROSPECTIVE_POLICY } from '../../src/review/retrospective-policy.js';
import { runCliWithLiteralArguments } from '../helpers.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';
import { electronRequest } from './legacy-electron-runner.fixture.js';

it('requires both independent reviews for the enrolled Electron row at the public boundary', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-authorization-'));
  try {
    const result = await runCliWithLiteralArguments(
      [
        '--cwd',
        root,
        '--json',
        '--no-input',
        'review',
        'attest',
        'retrospective',
        '--ticket',
        SOULLESS_RETROSPECTIVE_POLICY.ticketId,
        '--ledger',
        SOULLESS_RETROSPECTIVE_POLICY.ledger,
        '--scenario',
        SOULLESS_RETROSPECTIVE_POLICY.scenarios[2],
        '--eligibility',
        '11111111-1111-4111-8111-111111111111',
        '--proof',
        '22222222-2222-4222-8222-222222222222',
      ],
      { cwd: root },
    );
    expect(result.exitCode).not.toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      ok: true,
      data: { command: 'review attest retrospective', status: 'blocked' },
    });
    expect(payload.findings[0].message).toContain('Both current, independent review receipts');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.runIf(process.platform !== 'win32')(
  'revokes prior credit after a same-HEAD failed replay until a fresh proof review',
  async () => {
    const fixture = await electronAuthorizationFixture();
    try {
      const request = {
        ticketId: SOULLESS_RETROSPECTIVE_POLICY.ticketId,
        ledger: SOULLESS_RETROSPECTIVE_POLICY.ledger,
        scenario: SOULLESS_RETROSPECTIVE_POLICY.scenarios[2],
        eligibilityId: await fixture.review('retrospective-eligibility'),
        proofId: await fixture.review('retrospective-proof'),
      };
      const initial = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(initial.state).toBe('changed');
      const head = fixture.git('rev-parse', 'HEAD');
      vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', 'surviving-mutation');
      const failed = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(failed.state).toBe('action_required');
      expect(fixture.git('rev-parse', 'HEAD')).toBe(head);
      expect(electronRetrospectiveGate(fixture.root, request).state).toBe('action_required');
      vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', '');
      const count = fixture.events().length;
      const retry = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(retry.state).toBe('action_required');
      expect(fixture.events()).toHaveLength(count);
      const observed = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
      fixture.write(fixture.observationPath, JSON.stringify(observed));
      fixture.git('add', fixture.observationPath);
      fixture.git('commit', '-qm', 'retain fresh proof observation');
      const renewed = { ...request, proofId: await fixture.review('retrospective-proof') };
      expect(renewed.proofId).not.toBe(request.proofId);
      const attested = await attestElectronRetrospectiveRow(fixture.root, renewed);
      expect(attested.state, JSON.stringify(attested)).toBe('changed');
      expect(electronRetrospectiveGate(fixture.root, renewed).state).toBe('healthy');
      const directory = path.join(fixture.root, '.safeword/state/reviews');
      const states = readdirSync(directory)
        .filter(file => /^electron-replay-.*\.json$/u.test(file))
        .map(file => JSON.parse(readFileSync(path.join(directory, file), 'utf8')).record.state);
      expect(states).toContain('failed');
      expect(states).toContain('passed');
    } finally {
      fixture.cleanup();
    }
  },
);

it
  .runIf(process.platform !== 'win32')
  .each(['eligibility', 'proof', 'declined', 'author'] as const)(
  'refuses %s-only or nonindependent approval before replay',
  async mode => {
    const fixture = await electronAuthorizationFixture();
    try {
      const eligibilityId =
        mode === 'proof'
          ? '11111111-1111-4111-8111-111111111111'
          : await fixture.review('retrospective-eligibility');
      const reviewMode = mode === 'author' || mode === 'declined' ? mode : 'independent';
      const proofId =
        mode === 'eligibility'
          ? '22222222-2222-4222-8222-222222222222'
          : await fixture.review('retrospective-proof', reviewMode);
      const result = await attestElectronRetrospectiveRow(fixture.root, {
        ticketId: SOULLESS_RETROSPECTIVE_POLICY.ticketId,
        ledger: SOULLESS_RETROSPECTIVE_POLICY.ledger,
        scenario: SOULLESS_RETROSPECTIVE_POLICY.scenarios[2],
        eligibilityId,
        proofId,
      });
      expect(result.state).toBe('action_required');
      expect(result.findings[0]?.message).toContain('Both current, independent review receipts');
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(2);
    } finally {
      fixture.cleanup();
    }
  },
);

it.runIf(process.platform !== 'win32')(
  'attests an enrolled row using real authenticated reviews and isolated external process replay',
  async () => {
    const fixture = await electronAuthorizationFixture();
    try {
      const request = {
        ticketId: SOULLESS_RETROSPECTIVE_POLICY.ticketId,
        ledger: SOULLESS_RETROSPECTIVE_POLICY.ledger,
        scenario: SOULLESS_RETROSPECTIVE_POLICY.scenarios[2],
        eligibilityId: await fixture.review('retrospective-eligibility'),
        proofId: await fixture.review('retrospective-proof'),
      };
      expect(electronRetrospectiveGate(fixture.root, request).state).toBe('action_required');
      const result = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(result.state, JSON.stringify(result)).toBe('changed');
      expect(electronRetrospectiveGate(fixture.root, request).state).toBe('healthy');
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(4);
      expect(fixture.observation().commit).not.toBe(fixture.git('rev-parse', 'HEAD'));
    } finally {
      fixture.cleanup();
    }
  },
);

it.runIf(process.platform !== 'win32')(
  'requires real replay at a metadata HEAD while preserving the producing observation',
  async () => {
    const fixture = await electronAuthorizationFixture();
    try {
      const request = {
        ticketId: SOULLESS_RETROSPECTIVE_POLICY.ticketId,
        ledger: SOULLESS_RETROSPECTIVE_POLICY.ledger,
        scenario: SOULLESS_RETROSPECTIVE_POLICY.scenarios[2],
        eligibilityId: await fixture.review('retrospective-eligibility'),
        proofId: await fixture.review('retrospective-proof'),
      };
      const producingCommit = fixture.observation().commit;
      const initial = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(initial.state).toBe('changed');
      fixture.write('metadata.md', 'A later metadata commit\n');
      fixture.git('add', 'metadata.md');
      fixture.git('commit', '-qm', 'advance only metadata');
      expect(electronRetrospectiveGate(fixture.root, request).state).toBe('action_required');
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(4);
      const replay = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(replay.state, JSON.stringify(replay)).toBe('changed');
      expect(electronRetrospectiveGate(fixture.root, request).state).toBe('healthy');
      expect(fixture.events().filter(event => event.event === 'test')).toHaveLength(6);
      expect(fixture.observation().commit).toBe(producingCommit);
    } finally {
      fixture.cleanup();
    }
  },
);
