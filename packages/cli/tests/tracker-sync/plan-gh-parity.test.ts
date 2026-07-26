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
  | { kind: 'create'; title: string; ref: TrackerReference; payload: IssuePayload }
  | { kind: 'update'; title: string; ref: TrackerReference; payload: IssuePayload };

/**
 * Records every create/update call into ONE ordered log, so the live path's real
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
      minted += 1;
      const ref: TrackerReference = { provider, id: `new-${minted}` };
      calls.push({ kind: 'create', title: payload.title, ref, payload });
      return Promise.resolve(ref);
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

const PENDING_REF: TrackerReference = {
  provider: 'github',
  id: '551',
  url: 'https://github.com/o/r/issues/551',
};

/**
 * `IssuePayload` carries no ticket id, so `title` is the only join key between a
 * recorded writer call and a plan intent — every ticket in `corpus()` needs a
 * unique one (the default derives from `id` to preserve that). Ticket ids must be
 * unique too: a repeated id makes the map lookup and every graph edge naming it
 * ambiguous, silently changing what the fixture means.
 */
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
    // A child of RECORDED1 so the graph edge is exercised against a recorded parent.
    ticket({ id: 'CHILD1', title: 'Child of recorded', parent: 'RECORDED1' }),
    ticket({ id: 'PENDING1', title: 'Interrupted mid-create' }),
    // A FRESH parent/child pair — listed child-first so a corpus-order plan would put
    // the child before its parent. This is the actual executor hazard: neither issue
    // exists yet, so the edge names a ticket a later intent still has to create.
    ticket({ id: 'FCHILD1', title: 'Fresh child', parent: 'FPARENT1' }),
    ticket({ id: 'FPARENT1', title: 'Fresh parent' }),
    // A blocker pair the sort can ONLY order via the dependsOn edge: the blocked
    // ticket is listed first, and its blocker is reachable by no other edge (pointing
    // it at FPARENT1 instead would be pulled into place by the parent edge above, so
    // the assertion would hold even if blocker edges were ignored entirely).
    ticket({ id: 'BLOCKED1', title: 'Blocked ticket', dependsOn: ['BLOCKER1'] }),
    ticket({ id: 'BLOCKER1', title: 'Blocker ticket' }),
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

    // Same tickets and same COUNT. Length + set equality over unique titles pins
    // cardinality (a duplicated or dropped intent fails here); ORDER is not asserted
    // in this test — the sequence comparison lives in the ordering test below.
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
      const parentTitle = corpus().find(t => t.id === parentTicketId)?.title;
      const createdParent = live.calls.find(
        call => call.kind === 'create' && call.title === parentTitle,
      );
      const expectedReferenceId =
        startingMap().lookup(parentTicketId ?? '')?.ref.id ??
        (createdParent?.kind === 'create' ? createdParent.ref.id : undefined);
      expect(expectedReferenceId).toBe(graphCall.parent);
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
    // intents top-to-bottom depends on: a fresh parent is CREATED before the fresh
    // ticket whose graph edge names it.
    //
    // These are ABSOLUTE invariants, not parity: both sides share the sort, so a change
    // there moves them together and the sequence comparison above stays green. Only an
    // absolute anchor can catch a bug in the shared helper. Assert presence first —
    // `indexOf` returns -1 on a miss, so a drifted title would read as a silent pass
    // (`3 > -1`).
    for (const title of ['Fresh parent', 'Fresh child', 'Blocked ticket', 'Blocker ticket']) {
      expect(planOrder).toContain(title);
    }
    expect(planOrder.indexOf('Fresh child')).toBeGreaterThan(planOrder.indexOf('Fresh parent'));
    // Blocker edges order too — without this, a sort that ignored dependsOn/blockedOn
    // entirely would survive (parity holds because both sides lose it identically).
    expect(planOrder.indexOf('Blocked ticket')).toBeGreaterThan(
      planOrder.indexOf('Blocker ticket'),
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
