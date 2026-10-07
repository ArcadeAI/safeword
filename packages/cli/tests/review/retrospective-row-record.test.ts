import type * as ChildProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReviewJob from '../../src/review/job.js';
import { attestRetrospectiveRow, retrospectiveGate } from '../../src/review/retrospective-gate.js';
import {
  RETROSPECTIVE_CUTOFF,
  RETROSPECTIVE_FEATURE,
  RETROSPECTIVE_LEDGER,
} from '../../src/review/retrospective-history.js';
import type * as Proof from '../../src/review/retrospective-proof.js';
import { scenarioBodyDigest } from '../../src/review/retrospective-scenario-body.js';

// These collaborators isolate replay-record orchestration, not actor behavior,
// review independence, historical eligibility, or the two-copy proof runner.
const replay = vi.hoisted(() => ({
  calls: 0,
  observation: {},
  feature: '',
  commit: '',
  dirty: false,
  advanceDuringReplay: false,
  absoluteTargets: false,
}));
vi.mock('node:child_process', async original => ({
  ...(await original<typeof ChildProcess>()),
  spawnSync: () => ({ status: 0, stdout: replay.feature }),
}));
vi.mock('../../src/review/job.js', async original => ({
  ...(await original<typeof ReviewJob>()),
  approvedRetrospectiveReview: (_root: string, id: string) => {
    const targets = {
      [claim.eligibilityId]: ['eligibility.json'],
      [claim.proofId]: ['proof.json', 'observation.json'],
    }[id];
    return targets?.map(target => (replay.absoluteTargets ? path.join(_root, target) : target));
  },
}));
vi.mock('../../src/review/retrospective-prerequisites.js', () => ({
  checkRetrospectivePrerequisites: () => ({ eligibleForReview: true }),
}));
vi.mock('../../src/review/retrospective-proof.js', async original => ({
  ...(await original<typeof Proof>()),
  currentProofCommit: () => {
    if (replay.dirty) throw new Error('Commit tracked changes before running retrospective proof.');
    return replay.commit;
  },
  runRetrospectiveProof: () => {
    replay.calls += 1;
    if (replay.advanceDuringReplay) replay.commit = 'b'.repeat(40);
    return replay.observation;
  },
}));

const claim = {
  ticketId: 'CKWE2D',
  ledger: RETROSPECTIVE_LEDGER,
  scenario: 'Example',
  eligibilityId: '11111111-1111-4111-8111-111111111111',
  proofId: '22222222-2222-4222-8222-222222222222',
};
const implementation = 'packages/cli/src/example.ts';
const test = 'packages/cli/tests/example.test.ts';
const digest = (content: string) => createHash('sha256').update(content).digest('hex');

describe('retrospective row replay record', () => {
  let root: string;
  let previousKeyRoot: string | undefined;
  const put = (relative: string, content: string) => {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'safeword-row-record-'));
    previousKeyRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
    process.env.SAFEWORD_REVIEW_KEY_ROOT = path.join(root, 'profile');
    replay.calls = 0;
    replay.commit = 'a'.repeat(40);
    replay.dirty = false;
    replay.advanceDuringReplay = false;
    replay.absoluteTargets = false;
    replay.feature =
      'Feature: Example\n  Scenario: Example\n    Given a behavior\n    Then it holds\n';
    put(RETROSPECTIVE_FEATURE, replay.feature);
    put(
      path.join(path.dirname(RETROSPECTIVE_LEDGER), 'ticket.md'),
      '---\nid: CKWE2D\nretrospective_claim: eligibility.json\n---\n',
    );
    put(implementation, 'behavior');
    put(test, 'test');
    put(
      'eligibility.json',
      JSON.stringify({
        ticketId: 'CKWE2D',
        ledgerPath: RETROSPECTIVE_LEDGER,
        featurePath: RETROSPECTIVE_FEATURE,
        cutoff: RETROSPECTIVE_CUTOFF,
        scenarios: [
          { heading: 'Example', bodySha256: scenarioBodyDigest(replay.feature, 'Example') },
        ],
        blobs: [
          {
            currentPath: implementation,
            currentBlobSha: 'committed',
            baselineExcerpts: ['behavior'],
          },
        ],
      }),
    );
    const request = {
      ticketId: 'CKWE2D',
      scenario: 'Example',
      implementationPath: implementation,
      testFile: test,
      testFullName: 'selected test',
      supportFiles: [test],
    };
    put('proof.json', JSON.stringify(request));
    replay.observation = {
      commit: replay.commit,
      request,
      argv: ['bun', 'run', 'test'],
      cwd: 'packages/cli',
      sourceSha256: digest('behavior'),
      mutantSha256: digest('removed'),
      supportSha256: { [implementation]: digest('behavior'), [test]: digest('test') },
      mutatedSupportSha256: {},
      passing: { exitCode: 0, test: 'selected test', passedTests: 1, failedTests: 0 },
      mutated: {
        exitCode: 1,
        test: 'selected test',
        passedTests: 0,
        failedTests: 1,
        failure: 'assertion',
      },
    };
    put('observation.json', JSON.stringify(replay.observation));
  });

  afterEach(() => {
    if (previousKeyRoot === undefined) delete process.env.SAFEWORD_REVIEW_KEY_ROOT;
    else process.env.SAFEWORD_REVIEW_KEY_ROOT = previousKeyRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('accepts approved absolute targets inside the project', () => {
    replay.absoluteTargets = true;
    expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
    expect(retrospectiveGate(root, claim).state).toBe('healthy');
  });

  it('accepts an additional reviewed claim without replacing the first ticket claim', () => {
    put(
      path.join(path.dirname(RETROSPECTIVE_LEDGER), 'ticket.md'),
      '---\nid: CKWE2D\nretrospective_claim: first-eligibility.json\nretrospective_claims:\n  - eligibility.json\n---\n',
    );
    expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
    expect(retrospectiveGate(root, claim).state).toBe('healthy');
  });

  it.each([
    '---\nid: CKWE2D\nretrospective_claim: first-eligibility.json\n---\n',
    '---\nid: CKWE2D\nretrospective_claims:\n  - eligibility.json\n---\n',
  ])('rejects a claim without both the primary opt-in and a matching path', ticket => {
    put(path.join(path.dirname(RETROSPECTIVE_LEDGER), 'ticket.md'), ticket);
    expect(attestRetrospectiveRow(root, claim).state).toBe('action_required');
  });

  it.each([test, implementation])(
    'checks %s after an explicit replay without executing another test',
    input => {
      expect(retrospectiveGate(root, claim).state).toBe('action_required');
      expect(replay.calls).toBe(0);
      expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
      expect(replay.calls).toBe(1);
      expect(
        retrospectiveGate(root, {
          proofId: claim.proofId,
          eligibilityId: claim.eligibilityId,
          scenario: claim.scenario,
          ledger: claim.ledger,
          ticketId: claim.ticketId,
        }).state,
      ).toBe('healthy');
      expect(replay.calls).toBe(1);
      put(input, 'changed input');
      expect(retrospectiveGate(root, claim).state).toBe('action_required');
      expect(replay.calls).toBe(1);
    },
  );

  it('cannot reuse the replay record in another project', () => {
    expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
    const other = `${root}-other`;
    try {
      cpSync(root, other, { recursive: true });
      expect(retrospectiveGate(other, claim).state).toBe('action_required');
      expect(replay.calls).toBe(1);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it.each(['commit', 'working tree'] as const)(
    'rejects undeclared source drift in the %s',
    mode => {
      expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
      if (mode === 'commit') replay.commit = 'b'.repeat(40);
      else replay.dirty = true;
      expect(retrospectiveGate(root, claim).state).toBe('action_required');
      expect(replay.calls).toBe(1);
    },
  );

  it('does not attest when the source commit changes during replay', () => {
    replay.advanceDuringReplay = true;
    expect(attestRetrospectiveRow(root, claim).state).toBe('action_required');
    expect(retrospectiveGate(root, claim).state).toBe('action_required');
  });

  it('rejects a forged record and changed reviewed observation', () => {
    expect(attestRetrospectiveRow(root, claim).state).toBe('changed');
    const records = path.join(root, '.safeword/state/reviews');
    const record = path.join(records, readdirSync(records)[0] ?? 'missing');
    const original = readFileSync(record, 'utf8');
    writeFileSync(record, 'forged');
    expect(retrospectiveGate(root, claim).state).toBe('action_required');
    writeFileSync(record, original);
    put('observation.json', JSON.stringify({ ...replay.observation, argv: ['other-command'] }));
    expect(retrospectiveGate(root, claim).state).toBe('action_required');
  });

  it('does not authorize a row when the replay differs from the reviewed observation', () => {
    replay.observation = { ...replay.observation, argv: ['changed'] };
    expect(attestRetrospectiveRow(root, claim).state).toBe('action_required');
    expect(retrospectiveGate(root, claim).state).toBe('action_required');
  });
});
