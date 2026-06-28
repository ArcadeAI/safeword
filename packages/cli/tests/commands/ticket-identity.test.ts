/**
 * The identity source for issue-first `ticket new` (KKNFZA TB1.AC1). `create`
 * mints via the tracker writer (the network boundary); `adopt` returns the given
 * key WITHOUT a create call. Injected writer — no real network.
 */

import { describe, expect, it, vi } from 'vitest';

import { buildIdentitySource } from '../../src/commands/ticket-identity.js';
import type { IssuePayload } from '../../src/tracker-sync/types.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';

const payload: IssuePayload = {
  title: 'login bug',
  body: 'see local ticket',
  issueType: 'task',
  labels: ['type:task'],
  state: 'open',
};

function fakeWriter(create: TrackerWriter['create']): TrackerWriter {
  return {
    provider: 'github',
    create,
    update: vi.fn(() => Promise.resolve()),
    projectGraph: vi.fn(() => Promise.resolve()),
  };
}

describe('buildIdentitySource (tracker-identity-and-join.TB1.AC1)', () => {
  it('create mode mints via the writer and returns the new ref', async () => {
    const create = vi.fn(() =>
      Promise.resolve({ provider: 'github' as const, id: '123', url: 'u' }),
    );
    const minted = await buildIdentitySource({ mode: 'create' }, fakeWriter(create), payload)();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(payload);
    expect(minted).toEqual({ id: '123', ref: { provider: 'github', id: '123', url: 'u' } });
  });

  it('adopt mode returns the given key without creating an issue', async () => {
    const create = vi.fn(() => Promise.resolve({ provider: 'github' as const, id: '123' }));
    const minted = await buildIdentitySource(
      { mode: 'adopt', key: 'ENG-45' },
      fakeWriter(create),
      payload,
    )();

    expect(create).not.toHaveBeenCalled();
    expect(minted).toEqual({ id: 'ENG-45', ref: { provider: 'github', id: 'ENG-45' } });
  });
});
