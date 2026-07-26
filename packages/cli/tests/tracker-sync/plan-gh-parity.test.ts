/**
 * Behavioral parity between `--plan` and the `gh`-shelling path (#1443, CBTDK8).
 *
 * The other suites prove nothing *broke* (the live path's own tests still pass).
 * That is regression evidence, not equivalence evidence — it never shows the plan
 * describes the same work the live path would perform. This suite pins that
 * directly: run the REAL `syncTracker` orchestrator against recording fake writers,
 * run `computePlan` over the SAME corpus and the SAME starting sidecar, and assert
 * the plan's intents reproduce the writer calls the live path actually made.
 *
 * Only the network boundary is faked. Both sides run their real decision code, so a
 * future divergence in either one fails here — which is what makes the versioned
 * contract safe for a second executor to depend on.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { syncTracker, type SyncTrackerDependencies } from '../../src/tracker-sync/index.js';
import { computePlan } from '../../src/tracker-sync/plan.js';
import { CREDENTIAL_ENV_VAR } from '../../src/tracker-sync/secrets.js';
import { TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type {
  BodyMode,
  IssuePayload,
  Provider,
  TicketInput,
  TrackerReference,
} from '../../src/tracker-sync/types.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';

/** One write the live path performed, in the order it performed it. */
type WriteCall =
  | { kind: 'create'; title: string; payload: IssuePayload }
  | { kind: 'update'; title: string; ref: TrackerReference; payload: IssuePayload };

/**
 * Records every writer call into ONE ordered log, so the live path's real
 * interleaved sequence is recoverable. Separate per-kind arrays would only allow
 * reconstructing an order (creates-then-updates), which is not the order the path
 * actually acted in — and an order assertion built on a reconstruction cannot fail
 * when the two paths genuinely diverge (#1463).
 */
function recordingWriter(provider: Provider): TrackerWriter & {
  calls: WriteCall[];
  graphs: { title: string; parent: string | undefined }[];
} {
  const calls: WriteCall[] = [];
  const graphs: { title: string; parent: string | undefined }[] = [];
  let minted = 0;
  return {
    provider,
    calls,
    graphs,
    create(payload) {
      calls.push({ kind: 'create', title: payload.title, payload });
      minted += 1;
      return Promise.resolve({ provider, id: `new-${minted}` });
    },
    update(ref, payload) {
      calls.push({ kind: 'update', title: payload.title, ref, payload });
      return Promise.resolve();
    },
    projectGraph(_ref, payload, graph) {
      graphs.push({ title: payload.title, parent: graph.parent?.id });
      return Promise.resolve();
    },
  };
}

/** The titles the live path wrote, in the exact order it wrote them. */
function liveWriteOrder(live: { calls: WriteCall[] }): string[] {
  return live.calls.map(call => call.title);
}

const RECORDED_REF: TrackerReference = {
  provider: 'github',
  id: '549',
  url: 'https://github.com/o/r/issues/549',
};
const TERMINAL_REF: TrackerReference = {
  provider: 'github',
  id: '550',
  url: 'https://github.com/o/r/issues/550',
};

/**
 * `IssuePayload` carries no ticket id, so `title` is the only join key between a
 * recorded writer call and a plan intent — every ticket in `corpus()` needs a
 * unique one (the default derives from `id` to preserve that).
 */
const PENDING_REF: TrackerReference = {
  provider: 'github',
  id: '551',
  url: 'https://github.com/o/r/issues/551',
};

function ticket(overrides: Partial<TicketInput> & { id: string }): TicketInput {
  return {
    title: `Title ${overrides.id}`,
    status: 'in_progress',
    type: 'task',
    epic: undefined,
    ticketUrl: `https://github.com/o/r/tree/main/.project/tickets/${overrides.id}`,
    bodyMarkdown: `body of ${overrides.id}`,
    ...overrides,
  };
}

/** The starting sidecar state, rebuilt fresh for each side (syncTracker mutates it). */
function startingMap(): TrackerMap {
  const map = new TrackerMap();
  map.record('RECORDED1', RECORDED_REF);
  map.record('TERMINAL1', TERMINAL_REF);
  // A pending entry exercises planTicketSync's `reconcile` arm, which plan.ts folds
  // to `update` — the live path likewise updates without a second create.
  map.markPending('PENDING1', PENDING_REF);
  return map;
}

/** A corpus spanning every fold input: never-synced, recorded-open, recorded-terminal. */
function corpus(): TicketInput[] {
  return [
    ticket({ id: 'FRESH1', title: 'Never synced' }),
    ticket({ id: 'RECORDED1', title: 'Already synced', status: 'in_progress' }),
    ticket({ id: 'TERMINAL1', title: 'Finished', status: 'done' }),
    // A child of RECORDED1 so the graph edge and the ordering are both exercised.
    ticket({ id: 'CHILD1', title: 'Child of recorded', parent: 'RECORDED1' }),
    ticket({ id: 'PENDING1', title: 'Interrupted mid-create' }),
  ];
}

/** Drive the REAL orchestrator with recording writers; return the calls it made. */
async function runLivePath(
  tickets: TicketInput[],
  map: TrackerMap,
  bodyMode: BodyMode,
  sidecarPath: string,
): Promise<ReturnType<typeof recordingWriter>> {
  const github = recordingWriter('github');
  // The orchestrator refuses on a missing sidecar, so seed it; and the exit-0
  // assertion below matters — a live path that bailed early writes nothing, which
  // would let the empty-corpus parity test pass vacuously.
  map.save(sidecarPath);
  const dependencies: SyncTrackerDependencies = {
    config: { provider: 'github', body: bodyMode, target: { repo: 'o/r' } },
    tickets,
    sidecarPath,
    writers: { github, linear: recordingWriter('linear') },
    env: { [CREDENTIAL_ENV_VAR.github]: 'token' },
    sleep: () => Promise.resolve(),
    log: () => {},
  };
  const result = await syncTracker(dependencies);
  expect(result.exitCode).toBe(0);
  return github;
}

describe('--plan parity with the gh path (#1443)', () => {
  const bodyMode: BodyMode = 'minimal';
  let directory: string;
  let sidecarPath: string;

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'plan-parity-'));
    sidecarPath = nodePath.join(directory, 'tracker-map.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('plans exactly the tickets the live path wrote, with the same kind, ref and payload', async () => {
    const live = await runLivePath(corpus(), startingMap(), bodyMode, sidecarPath);
    const plan = computePlan({ tickets: corpus(), map: startingMap(), bodyMode });

    // Same tickets, same COUNT, same ORDER. A set comparison would let a plan that
    // duplicates or drops an intent pass (titles dedupe); comparing ordered arrays
    // pins cardinality and the dependency-first sequence an executor relies on.
    const liveTitles = liveWriteOrder(live);
    const plannedTitles = plan.intents.map(intent => intent.payload.title);
    expect(plan.intents).toHaveLength(liveTitles.length);
    expect(new Set(plannedTitles)).toEqual(new Set(liveTitles));

    // Every create the live path issued is a `create` intent with an identical payload.
    const liveCreates = live.calls.filter(call => call.kind === 'create');
    for (const call of liveCreates) {
      const intent = plan.intents.find(i => i.payload.title === call.payload.title);
      expect(intent?.kind).toBe('create');
      expect(intent?.payload).toEqual(call.payload);
    }

    // Every update the live path issued is an `update` (open) or `close` (terminal)
    // intent carrying the SAME ref and the SAME payload — the live path has no
    // field-less close, so a closing ticket must still carry its full payload.
    const liveUpdates = live.calls.filter(call => call.kind === 'update');
    for (const call of liveUpdates) {
      const intent = plan.intents.find(i => i.payload.title === call.payload.title);
      expect(intent?.kind).toBe(call.payload.state === 'closed' ? 'close' : 'update');
      expect(intent?.payload).toEqual(call.payload);
      expect(intent).toMatchObject({ ref: call.ref });
    }
  });

  // Graph parity: for every parent edge the live path projected, the plan names the
  // SAME parent — by ticket id, where the live path uses the recorded issue ref.
  // Deliberate divergence NOT asserted here: the plan drops self-edges, which
  // buildGraphProjection does not (see buildGraphEdges in plan.ts).
  it('names the same parent edges the live path projected', async () => {
    const live = await runLivePath(corpus(), startingMap(), bodyMode, sidecarPath);
    const plan = computePlan({ tickets: corpus(), map: startingMap(), bodyMode });

    const projectedParents = live.graphs.filter(call => call.parent !== undefined);
    expect(projectedParents.length).toBeGreaterThan(0); // fixture really has an edge
    for (const graphCall of projectedParents) {
      const intent = plan.intents.find(i => i.payload.title === graphCall.title);
      const parentTicketId = intent?.graph?.parentTicketId;
      expect(parentTicketId).toBeDefined();
      // The live ref id maps back to the very ticket the plan names.
      const named = startingMap().lookup(parentTicketId ?? '');
      expect(named?.ref.id).toBe(graphCall.parent);
    }
  });

  it('emits intents in the exact sequence the live path wrote them', async () => {
    const live = await runLivePath(corpus(), startingMap(), bodyMode, sidecarPath);
    const plan = computePlan({ tickets: corpus(), map: startingMap(), bodyMode });

    // The real assertion: the plan's sequence IS the live path's sequence. Comparing
    // sets (or only the parent/child pair) would pass for any permutation, so it could
    // not fail when the two sorts diverge — which is the whole property under test.
    const planOrder = plan.intents.map(intent => intent.payload.title);
    expect(planOrder).toEqual(liveWriteOrder(live));

    // And that shared sequence is dependency-first, which is what an executor applying
    // intents top-to-bottom depends on: a parent is created before the ticket naming it.
    expect(planOrder.indexOf('Child of recorded')).toBeGreaterThan(
      planOrder.indexOf('Already synced'),
    );
  });

  it('agrees with the live path on a full-body corpus too (payload mode carries through)', async () => {
    const live = await runLivePath(corpus(), startingMap(), 'full', sidecarPath);
    const plan = computePlan({ tickets: corpus(), map: startingMap(), bodyMode: 'full' });

    const livePayloads = live.calls.map(call => call.payload);
    for (const payload of livePayloads) {
      const intent = plan.intents.find(i => i.payload.title === payload.title);
      // Body included/excluded identically — an egress divergence would show here.
      expect(intent?.payload).toEqual(payload);
    }
  });

  it('plans nothing when the live path writes nothing (empty corpus)', async () => {
    const live = await runLivePath([], new TrackerMap(), bodyMode, sidecarPath);
    const plan = computePlan({ tickets: [], map: new TrackerMap(), bodyMode });

    expect(live.calls).toHaveLength(0);
    expect(plan.intents).toEqual([]);
  });
});
