import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReviewJob from '../../src/review/job.js';
import {
  attestRetrospectiveClose,
  retrospectiveCloseGate,
} from '../../src/review/retrospective-close.js';
import type * as History from '../../src/review/retrospective-history.js';
import { RETROSPECTIVE_LEDGER } from '../../src/review/retrospective-history.js';

const eligibilityId = '70d17bbe-4174-4f02-a45f-5e58e3990761';
const proofId = '316b1708-61e4-486d-87ad-693b393a8e87';
const claimPath = '.project/tickets/SBSJ40-verify-implemented-scenarios-honestly/eligibility.json';
const proofPath = '.project/tickets/SBSJ40-verify-implemented-scenarios-honestly/proof.json';
const observationPath =
  '.project/tickets/SBSJ40-verify-implemented-scenarios-honestly/observation.json';
const replay = vi.hoisted(() => ({ state: 'healthy', calls: 0 }));

vi.mock('../../src/review/job.js', async importOriginal => {
  const actual = await importOriginal<typeof ReviewJob>();
  return {
    ...actual,
    approvedRetrospectiveReview: (_root: string, id: string) =>
      ({ [eligibilityId]: [claimPath], [proofId]: [proofPath, observationPath] })[id],
  };
});

vi.mock('../../src/review/retrospective-gate.js', () => ({
  retrospectiveGate: () => {
    replay.calls += 1;
    return { state: replay.state };
  },
}));

vi.mock('../../src/review/retrospective-history.js', async importOriginal => {
  const actual = await importOriginal<typeof History>();
  return { ...actual, checkRetrospectiveHistory: () => ({ eligibleForReview: true }) };
});

function put(root: string, relative: string, content: string): void {
  const path = nodePath.join(root, relative);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixture(root: string): void {
  put(
    root,
    nodePath.join(nodePath.dirname(RETROSPECTIVE_LEDGER), 'ticket.md'),
    `---\nid: CKWE2D\nretrospective_claim: ${claimPath}\n---\n`,
  );
  put(
    root,
    RETROSPECTIVE_LEDGER,
    `### Scenario: A nested project uses its committed generated marker\n- [x] VERIFIED eligibility=${eligibilityId} proof=${proofId}\n`,
  );
  put(
    root,
    'packages/cli/features/keep-reviews-focused-on-authored-inputs.feature',
    'Feature: review\n',
  );
  put(
    root,
    claimPath,
    JSON.stringify({ blobs: [{ currentPath: 'packages/cli/src/review/packet.ts' }] }),
  );
  put(
    root,
    proofPath,
    JSON.stringify({
      testFile: 'packages/cli/tests/proof.test.ts',
      implementationPath: 'packages/cli/src/review/packet.ts',
      supportFiles: ['packages/cli/src/review/scope.ts'],
    }),
  );
  put(root, observationPath, '{}');
  put(root, 'packages/cli/tests/proof.test.ts', 'test();\n');
  put(root, 'packages/cli/src/review/packet.ts', 'export const behavior = true;\n');
  put(root, 'packages/cli/src/review/scope.ts', 'export const support = true;\n');
  put(root, `.safeword/state/reviews/${eligibilityId}.json`, '{}');
  put(root, `.safeword/state/reviews/${proofId}.json`, '{}');
}

describe('retrospective closing replay record', () => {
  let root: string;
  let previousKeyRoot: string | undefined;

  beforeEach(() => {
    replay.state = 'healthy';
    replay.calls = 0;
    root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-close-test-'));
    previousKeyRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
    process.env.SAFEWORD_REVIEW_KEY_ROOT = nodePath.join(root, 'profile-state');
    fixture(root);
  });

  afterEach(() => {
    if (previousKeyRoot === undefined) delete process.env.SAFEWORD_REVIEW_KEY_ROOT;
    else process.env.SAFEWORD_REVIEW_KEY_ROOT = previousKeyRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('accepts only the fixed ticket and ledger, with a completed replay record', () => {
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
    expect(attestRetrospectiveClose(root, 'OTHER1', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('changed');
    expect(replay.calls).toBe(1);
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('healthy');
    expect(retrospectiveCloseGate(root, 'OTHER1', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
    expect(retrospectiveCloseGate(root, 'CKWE2D', 'other-ledger.md').state).toBe('action_required');
  });

  it('does not write a closing record when the two-copy replay fails', () => {
    replay.state = 'action_required';
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
    expect(replay.calls).toBe(1);
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
  });

  it.each([
    'packages/cli/src/review/packet.ts',
    'packages/cli/tests/proof.test.ts',
    'packages/cli/src/review/scope.ts',
    `.safeword/state/reviews/${proofId}.json`,
  ])('rejects a changed proof input: %s', path => {
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('changed');
    put(root, path, 'changed\n');
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
  });

  it('rejects a changed ledger and a forged closing record', () => {
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('changed');
    const recordPath = nodePath.join(root, '.safeword/state/reviews/retrospective-close.json');
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { integrity: string };
    writeFileSync(recordPath, JSON.stringify({ ...record, integrity: 'forged' }));
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('changed');
    put(root, RETROSPECTIVE_LEDGER, '### Scenario: changed\n- [ ] VERIFIED\n');
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
  });

  it('binds the closing record to the profile review key', () => {
    expect(attestRetrospectiveClose(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe('changed');
    process.env.SAFEWORD_REVIEW_KEY_ROOT = nodePath.join(root, 'different-profile-state');
    expect(retrospectiveCloseGate(root, 'CKWE2D', RETROSPECTIVE_LEDGER).state).toBe(
      'action_required',
    );
  });
});
