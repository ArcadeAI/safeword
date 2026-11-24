import { existsSync } from 'node:fs';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { attestElectronRetrospectiveClose } from '../../src/review/retrospective-electron-close.js';
import {
  attestElectronRetrospectiveRow,
  electronRetrospectiveGate,
} from '../../src/review/retrospective-electron-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it.each([
  ['a failing original', 'failing-original'],
  ['a surviving mutant', 'surviving-mutation'],
  ['a different assertion', 'different-assertion'],
  ['a setup failure', 'setup-failure'],
  ['retry recovery', 'retry-recovery'],
])('a row replay with %s cannot refresh prior credit', async (_outcome, mode) => {
  const fixture = await electronAuthorizationFixture();
  try {
    const request = {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: policy.scenarios[2],
      eligibilityId: await fixture.review('retrospective-eligibility'),
      proofId: await fixture.review('retrospective-proof'),
    };
    const initial = await attestElectronRetrospectiveRow(fixture.root, request);
    expect(initial.state).toBe('changed');
    fixture.write('metadata.md', 'later committed view\n');
    fixture.git('add', 'metadata.md');
    fixture.git('commit', '-qm', 'advance metadata only');
    vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', mode);
    const failed = await attestElectronRetrospectiveRow(fixture.root, request);
    expect(failed.state).toBe('action_required');
    expect(failed.findings[0]?.message).toContain(request.scenario);
    expect(electronRetrospectiveGate(fixture.root, request).state).toBe('action_required');
    vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', '');
    const executions = fixture.events().length;
    const retry = await attestElectronRetrospectiveRow(fixture.root, request);
    expect(retry.state).toBe('action_required');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});

it.each([
  ['a failing original', 'failing-original'],
  ['a surviving mutant', 'surviving-mutation'],
  ['a different assertion', 'different-assertion'],
  ['a setup failure', 'setup-failure'],
  ['retry recovery', 'retry-recovery'],
])(
  'a closing replay with %s cannot renew the failed row',
  async (_outcome, mode) => {
    const fixture = await electronAuthorizationFixture(true);
    try {
      const claims = await fixture.completeRows();
      const first = claims[0];
      if (first === undefined) throw new Error('The complete fixture has no row.');
      const initial = await attestElectronRetrospectiveRow(fixture.root, first);
      expect(initial.state).toBe('changed');
      fixture.write('metadata.md', 'final committed view\n');
      fixture.git('add', 'metadata.md');
      fixture.git('commit', '-qm', 'advance final metadata view');
      vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', mode);
      const failed = await attestElectronRetrospectiveClose(
        fixture.root,
        policy.ticketId,
        policy.ledger,
      );
      expect(failed.state).toBe('action_required');
      expect(failed.findings[0]?.message).toContain(first.scenario);
      expect(
        existsSync(
          path.join(fixture.root, '.safeword/state/reviews/electron-retrospective-close-v1.json'),
        ),
      ).toBe(false);
      vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', '');
      const executions = fixture.events().length;
      const retry = await attestElectronRetrospectiveRow(fixture.root, first);
      expect(retry.state).toBe('action_required');
      expect(fixture.events()).toHaveLength(executions);
    } finally {
      fixture.cleanup();
    }
  },
  600_000,
);
