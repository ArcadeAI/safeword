import { expect, it } from 'vitest';

import * as settings from '../../scripts/lib/propagation-settings.js';
import {
  type DesignSettingObservation,
  type PolicyObservation,
  type PropagationLane,
  propagationLanes,
  type RetainedPolicyActor,
  type TerminalObservation,
} from '../../scripts/lib/resource-propagation.js';

type Options = {
  terminalHandoffCorrection: boolean;
  architectureReviewGate: boolean;
  crossModelReview: boolean;
  designApprovalGate: boolean;
};

function architecture(lane: PropagationLane, options: Options): PolicyObservation {
  const bytes = JSON.stringify(options);
  const base = {
    installation: lane.id,
    raw: 'synthetic architecture observation',
    ticket: 'type: feature\nphase: verify\nstatus: in_progress',
    configuration: { path: '/owned/config', bytes, after: bytes },
  };
  const reason = 'cited evidence required';
  if (lane.agent !== 'cursor')
    return {
      protocol: 'stop-json',
      observation: {
        ...base,
        decisions: options.architectureReviewGate ? [{ decision: 'block', reason }] : [{}],
      },
    };
  return {
    protocol: 'cursor-stop',
    observation: {
      ...base,
      rawPath: '/owned/raw',
      stops: [
        { input: { loop_count: 0 }, ...(options.architectureReviewGate && { followup: reason }) },
      ],
      ...(options.architectureReviewGate && {
        cap: {
          binding: { loopLimit: 1 },
          skip: { loop: 1, limit: 1 },
          response: { input: { hook_event_name: 'afterAgentResponse', text: 'response' } },
        },
      }),
    },
  } as unknown as PolicyObservation;
}

function design(lane: PropagationLane, options: Options): DesignSettingObservation {
  const bytes = JSON.stringify(options);
  const enabled = options.designApprovalGate;
  const base = {
    installation: lane.id,
    raw: 'synthetic design observation',
    configuration: { path: '/owned/config', bytes, after: bytes },
    before: 'before',
    effect: enabled ? 'before' : 'after',
    expectedEffect: 'after',
  };
  if (lane.agent === 'cursor')
    return {
      protocol: 'permission-json',
      observation: {
        ...base,
        decision: {
          permission: enabled ? 'deny' : 'allow',
          user_message: 'design approval requires approve-plan',
        },
      },
    };
  if (lane.agent === 'opencode')
    return {
      protocol: 'exit-status',
      observation: {
        ...base,
        observations: [
          { status: enabled ? 2 : 0, stdout: '', stderr: 'design approval requires approve-plan' },
        ],
      },
    };
  return {
    protocol: lane.agent === 'codex' ? 'codex-pre-tool-json' : 'pre-tool-json',
    observation: {
      ...base,
      decision: enabled
        ? {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: 'design approval requires approve-plan',
            },
          }
        : {},
    },
  };
}

function handoff(
  lane: PropagationLane,
  options: Options,
  currentTool: boolean,
  turn: number,
): TerminalObservation {
  const bytes = JSON.stringify(options);
  const base = {
    installation: lane.id,
    raw: 'synthetic handoff observation',
    configuration: { path: '/owned/config', bytes, after: bytes },
  };
  const correction = options.terminalHandoffCorrection && currentTool;
  if (lane.agent !== 'cursor')
    return {
      ...base,
      decisions: correction
        ? [{ decision: 'block', reason: 'terminal-handoff/v1 correction' }, {}]
        : [{}],
      ...(currentTool && { helper: { marker: 'helper', origin: '/owned/helper' } }),
    };
  const input = {
    loop_count: 0,
    conversation_id: lane.id,
    generation_id: `generation-${turn}`,
    cursor_version: lane.version,
    workspace_roots: ['/owned'],
  };
  const cap = {
    binding: { loopLimit: 1 },
    skip: { loop: 1, limit: 1, raw: 'skip' },
    window: '/owned/window',
    response: {
      exit: 0,
      input: {
        ...input,
        hook_event_name: 'afterAgentResponse',
        generation_id: `auto-${turn}`,
        text: 'response',
      },
    },
  };
  return {
    ...base,
    protocol: 'cursor-stop',
    stops: [{ input, ...(correction && { followup: 'terminal-handoff/v1 correction' }) }],
    ...(correction && { cap }),
    ...(currentTool && {
      edit: {
        callback: { raw: 'callback', input },
        before: 'before',
        after: 'after',
        expected: 'after',
      },
    }),
    fileEffect: { path: '/owned/file', before: 'before', after: currentTool ? 'after' : 'before' },
  } as unknown as TerminalObservation;
}

it.each([
  'none',
  'missing',
  'case',
  'actor',
  'foreign',
  'missing-identity',
  'arch-foreign',
  'arch-protocol',
  'handoff-foreign',
  'handoff-protocol',
  'protocol',
  'outcome',
] as const)('binds every applicable retained lane and refuses %s observations', async fault => {
  const lanes = propagationLanes();
  const actors = new Map<string, RetainedPolicyActor>();
  const identities = new Map<string, string>();
  const calls = { architecture: [] as string[], handoff: [] as string[], design: [] as string[] };
  for (const lane of lanes) {
    identities.set(lane.id, lane.id);
    actors.set(lane.id, makeActor(lane, fault, calls));
  }
  if (fault === 'actor') actors.delete(lanes[0]?.id ?? '');
  await verifySupport(lanes);
  const run = Reflect.get(settings, 'runRetainedSettings');
  expect(run, 'PROPAGATION_SETTINGS_HELPER_MISSING').toBeTypeOf('function');
  const result: Promise<ResultRow[]> = Reflect.apply(run, undefined, [
    lanes,
    actors,
    identities,
    'evidence',
  ]);
  if (fault !== 'none') {
    const reason = {
      missing: 'UNOBSERVED',
      case: 'case observation missing',
      actor: 'settings actor',
      foreign: 'INSTALLATION_REPLACED',
      'missing-identity': 'IDENTITY_UNOBSERVED',
      'arch-foreign': 'INSTALLATION_REPLACED',
      'arch-protocol': 'SETTINGS_PROTOCOL',
      'handoff-foreign': 'INSTALLATION_REPLACED',
      'handoff-protocol': 'SETTINGS_PROTOCOL',
      protocol: 'SETTINGS_PROTOCOL',
      outcome: 'MISMATCH',
    }[fault];
    await expect(result).rejects.toThrow(reason);
    const faulted = fault === 'actor' ? lanes[0] : lanes.find(lane => lane.agent === 'claude');
    expect(faulted).toBeDefined();
    await expect(result).rejects.toThrow(faulted?.id);
    return;
  }
  const rows = await result;
  const stopLanes = lanes
    .filter(
      lane => lane.agent !== 'opencode' && (lane.agent !== 'cursor' || lane.runtime === 'IDE'),
    )
    .map(lane => lane.id);
  expect([...new Set(calls.architecture)]).toEqual(stopLanes);
  expect([...new Set(calls.handoff)]).toEqual(stopLanes);
  expect([...new Set(calls.design)]).toEqual(lanes.map(lane => lane.id));
  assertRows(rows, lanes, stopLanes);
});

type ResultRow = {
  lane: string;
  installation: string;
  architecture?: Awaited<ReturnType<typeof settings.runArchitectureSettings>>;
  handoff?: Awaited<ReturnType<typeof settings.runHandoffSettings>>;
  design: Awaited<ReturnType<typeof settings.runDesignApprovalSettings>>;
};

async function verifySupport(lanes: PropagationLane[]) {
  const lane = lanes.find(row => row.agent === 'claude');
  if (!lane) throw new Error('Claude lane fixture missing');
  const actor = makeActor(lane, 'none', { architecture: [], handoff: [], design: [] });
  const grades = [
    await settings.runArchitectureSettings(actor, 'evidence'),
    await settings.runHandoffSettings(actor),
    await settings.runDesignApprovalSettings(actor),
  ];
  expect(grades.map(grade => grade.exit)).toEqual([0, 0, 0]);
}

function assertRows(rows: ResultRow[], lanes: PropagationLane[], stopLanes: string[]) {
  expect(rows.map(row => row.lane)).toEqual(lanes.map(lane => lane.id));
  const designProtocols: Record<string, string> = {
    claude: 'pre-tool-json',
    codex: 'codex-pre-tool-json',
    cursor: 'permission-json',
    opencode: 'exit-status',
  };
  for (const row of rows) {
    const lane = lanes.find(candidate => candidate.id === row.lane);
    if (!lane) throw new Error('lane missing');
    expect(row.installation).toBe(row.lane);
    expect(Boolean(row.architecture)).toBe(stopLanes.includes(row.lane));
    expect(Boolean(row.handoff)).toBe(stopLanes.includes(row.lane));
    expect(row.design.observations[0]?.observation.raw).toBe('synthetic design observation');
    const expected = (count: number, item: object) => Array.from({ length: count }, () => item);
    expect(row.design.observations).toMatchObject(
      expected(6, {
        protocol: designProtocols[lane.agent],
        observation: { installation: row.lane },
      }),
    );
    if (row.architecture)
      expect(row.architecture.observations).toMatchObject(
        expected(6, {
          protocol: lane.agent === 'cursor' ? 'cursor-stop' : 'stop-json',
          observation: { installation: row.lane },
        }),
      );
    if (row.handoff) {
      expect(row.handoff.caseIndices.toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(row.handoff.observations).toMatchObject(expected(7, { installation: row.lane }));
      expect(
        row.handoff.observations.every(
          item =>
            ('protocol' in item && item.protocol === 'cursor-stop') === (lane.agent === 'cursor'),
        ),
      ).toBe(true);
    }
  }
}

function makeActor(
  lane: PropagationLane,
  fault: string,
  calls: { architecture: string[]; handoff: string[]; design: string[] },
): RetainedPolicyActor {
  let turn = 0;
  let designTurn = 0;
  const actor: RetainedPolicyActor = {
    handoffProtocol: lane.agent === 'cursor' && lane.runtime === 'IDE' ? 'cursor-stop' : undefined,
    fingerprint: () => ({ resources: ['a', 'b', 'c'], policy: 'p' }),
    refreshResources: () => Promise.resolve(),
    observe: () =>
      Promise.resolve({
        installation: lane.id,
        delivery: lane.delivery,
        raw: 'source',
        markers: { workflowMarker: 'a', guideMarker: 'b', helperMarker: 'c' },
      }),
    observeVerification: (_evidence, _setup, setting) => {
      if (!setting) throw new Error('missing setting');
      calls.architecture.push(lane.id);
      const actual = architecture(lane, setting.options);
      if (fault === 'arch-foreign' && lane.agent === 'claude')
        actual.observation.installation = 'foreign';
      if (fault === 'arch-protocol' && lane.agent === 'claude')
        return Promise.resolve(architecture({ ...lane, agent: 'cursor' }, setting.options));
      return Promise.resolve(actual);
    },
    observeHandoff: setting => {
      calls.handoff.push(lane.id);
      const actual = handoff(lane, setting.options, setting.currentTool, ++turn);
      if (fault === 'handoff-foreign' && lane.agent === 'claude') actual.installation = 'foreign';
      if (fault === 'handoff-protocol' && lane.agent === 'claude')
        return Promise.resolve(
          handoff({ ...lane, agent: 'cursor' }, setting.options, setting.currentTool, turn),
        );
      return Promise.resolve(actual);
    },
    observeDesignApproval: options => {
      calls.design.push(lane.id);
      if (fault === 'case' && lane.agent === 'claude' && ++designTurn === 6)
        throw new Error(`HOST_CONTRACT_PROOF_UNAVAILABLE: case observation missing ${lane.id}`);
      return Promise.resolve(faultDesign(lane, options, fault));
    },
  };
  return actor;
}

function faultDesign(lane: PropagationLane, options: Options, fault: string) {
  const actual = design(lane, options);
  if (lane.agent !== 'claude') return actual;
  switch (fault) {
    case 'missing': {
      actual.observation.raw = '';
      break;
    }
    case 'missing-identity': {
      actual.observation.installation = '';
      break;
    }
    case 'foreign': {
      actual.observation.installation = 'foreign';
      break;
    }
    case 'outcome': {
      actual.observation.effect = 'wrong';
      break;
    }
    case 'protocol': {
      return design({ ...lane, agent: 'cursor' }, options);
    }
    // No default
  }
  return actual;
}
