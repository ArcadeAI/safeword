import { describe, expect, it } from 'vitest';

import type { IssuePayload, Provider, TrackerReference } from '../../src/tracker-sync/types.js';
import {
  type CreateRequest,
  createWriter,
  dispatchCreate,
  type GraphProjection,
  type GraphRequest,
  type TrackerClient,
  type UpdateRequest,
} from '../../src/tracker-sync/writers.js';

/**
 * The two writers behind the shared TrackerClient port (JS5K5G AC4 routing, AC7
 * field ownership). A recording fake client captures the exact request each
 * writer sends, so "writes only owned fields" is asserted on the request object.
 */

/** A fake client that records every request it receives. */
function recordingClient(): TrackerClient & {
  creates: CreateRequest[];
  graphs: GraphRequest[];
  updates: UpdateRequest[];
} {
  const creates: CreateRequest[] = [];
  const graphs: GraphRequest[] = [];
  const updates: UpdateRequest[] = [];
  return {
    creates,
    graphs,
    updates,
    createIssue: (request: CreateRequest) => {
      creates.push(request);
      return Promise.resolve({ id: '42', url: 'https://x/issues/42' });
    },
    projectGraph: (request: GraphRequest) => {
      graphs.push(request);
      return Promise.resolve();
    },
    updateIssue: (request: UpdateRequest) => {
      updates.push(request);
      return Promise.resolve();
    },
  };
}

const activePayload: IssuePayload = {
  title: 'Wire it up',
  body: 'banner + back-link',
  issueType: 'feature',
  labels: ['epic:bridge', 'type:feature'],
  state: 'open',
};
const ref: TrackerReference = { provider: 'github', id: '42' };
const graph: GraphProjection = {
  parent: { provider: 'github', id: '100' },
  blockedBy: [{ provider: 'github', id: '7' }],
};

describe('sync-tracker writers (sync-tracker.TB1.AC4, AC7)', () => {
  // AC4 — one call site routes to the provider's writer
  it.each<[Provider, Provider]>([
    ['linear', 'github'],
    ['github', 'linear'],
  ])('routes a %s project to that writer and leaves %s untouched', async (chosen, other) => {
    const chosenClient = recordingClient();
    const otherClient = recordingClient();
    const registry = {
      [chosen]: createWriter(chosen, chosenClient),
      [other]: createWriter(other, otherClient),
    } as Record<Provider, ReturnType<typeof createWriter>>;

    await dispatchCreate(registry, chosen, activePayload);

    expect(chosenClient.creates).toHaveLength(1);
    expect(otherClient.creates).toHaveLength(0);
  });

  it('returns a provider-tagged ref from create', async () => {
    const writer = createWriter('linear', recordingClient());
    const created = await writer.create(activePayload);
    expect(created.provider).toBe('linear');
    expect(created.id).toBe('42');
  });

  // AC7 — re-sync of an active ticket writes title + labels only
  it('updates title and labels but never status, assignee, or priority', async () => {
    const client = recordingClient();
    await createWriter('github', client).update(ref, activePayload);

    const [request] = client.updates;
    expect(request?.title).toBe('Wire it up');
    expect(request?.labels).toEqual(['epic:bridge', 'type:feature']);
    expect(request && 'assignee' in request).toBe(false);
    expect(request && 'priority' in request).toBe(false);
    expect(request?.state).toBeUndefined(); // active → no status write at all
  });

  // AC7 — a newly-terminal ticket closes its issue (the one status write)
  it('closes the issue on a terminal payload without writing assignee or priority', async () => {
    const client = recordingClient();
    await createWriter('github', client).update(ref, { ...activePayload, state: 'closed' });

    const [request] = client.updates;
    expect(request?.state).toBe('closed');
    expect(request && 'assignee' in request).toBe(false);
    expect(request && 'priority' in request).toBe(false);
  });

  it('projects native type, parent, and blocking refs through the graph port', async () => {
    const client = recordingClient();
    await createWriter('github', client).projectGraph(ref, activePayload, graph);

    expect(client.graphs).toEqual([
      { id: '42', issueType: 'feature', parentId: '100', blockedByIds: ['7'] },
    ]);
  });
});
