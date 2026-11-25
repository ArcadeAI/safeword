import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { attestElectronRetrospectiveClose } from '../../src/review/retrospective-electron-close.js';
import { runElectronProof } from '../../src/review/retrospective-electron-proof.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';
import { electronRequest } from './legacy-electron-runner.fixture.js';

it('identifies a stale proof row at closing despite fresh successful execution and renewed eligibility', async () => {
  const fixture = await electronAuthorizationFixture(true);
  try {
    const claims = await fixture.completeRows();
    const first = claims[0];
    if (first === undefined) throw new Error('The full fixture has no rows.');
    const input = electronRequest.implementationPath;
    const original = readFileSync(path.join(fixture.root, input), 'utf8');
    fixture.write(input, `${original}\n// changed implementation bytes\n`);
    const claim = JSON.parse(
      readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
    );
    fixture.git('add', input);
    fixture.git('commit', '-qm', 'change reviewed implementation bytes');
    claim.blobs[0].currentBlobSha = fixture.git('rev-parse', `HEAD:${input}`);
    fixture.write(fixture.eligibilityPath, JSON.stringify(claim));
    fixture.git('add', fixture.eligibilityPath);
    fixture.git('commit', '-qm', 'retain truthful updated current blob claim');
    const eligibilityId = await fixture.review('retrospective-eligibility');
    const ledger = readFileSync(path.join(fixture.root, policy.ledger), 'utf8');
    fixture.write(
      policy.ledger,
      ledger.replaceAll(first.eligibilityId, () => eligibilityId),
    );
    fixture.git('add', policy.ledger);
    fixture.git('commit', '-qm', 'bind renewed eligibility without replacing proof reviews');
    const requestPath = path.posix.join(
      path.posix.dirname(fixture.requestPath),
      'proof-0.request.json',
    );
    const request = JSON.parse(readFileSync(path.join(fixture.root, requestPath), 'utf8'));
    const fresh = await runElectronProof(fixture.root, request, requestPath);
    expect(fresh.passing.passedTests).toBe(1);
    expect(fresh.mutated.failedTests).toBe(1);
    fixture.write('fresh-success.observation.json', JSON.stringify(fresh));
    fixture.git('add', 'fresh-success.observation.json');
    fixture.git('commit', '-qm', 'retain independent current successful execution');
    const executions = fixture.events().length;
    const closing = await attestElectronRetrospectiveClose(
      fixture.root,
      policy.ticketId,
      policy.ledger,
    );
    expect(closing.state).toBe('action_required');
    const refusal = closing.findings.map(finding => finding.message).join('\n');
    expect(refusal).toContain(first.scenario);
    expect(refusal).toContain('changed');
    expect(refusal).toContain('proof review');
    expect(refusal).toContain(first.proofId);
    expect(
      existsSync(
        path.join(fixture.root, '.safeword/state/reviews/electron-retrospective-close-v1.json'),
      ),
    ).toBe(false);
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
}, 120_000);
