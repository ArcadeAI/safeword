import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { vi } from 'vitest';

import type { runRetainedSettings } from '../../scripts/lib/propagation-settings.js';
import {
  type DesignSettingObservation,
  type PolicyObservation,
  type PropagationLane,
  propagationLanes,
  type RetainedPolicyActor,
  runResourcePropagation,
  type TerminalObservation,
} from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  nativeMain,
  prepareNativePropagationInputs,
  retainNativeResourceActor,
  runNativeResourcePropagation,
} from '../../scripts/lib/resource-propagation-run.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import type { CanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import {
  installedPropagationPaths,
  propagationFingerprint,
} from '../helpers/propagation-source.js';
import type { prepareClaudeRetainedFixture } from './claude-retained-fixture.js';
import type { prepareCursorRetainedFixture } from './cursor-retained-fixture.js';

type Fault =
  | 'none'
  | 'missing'
  | 'case'
  | 'protocol'
  | 'cursor-protocol'
  | 'installation'
  | 'foreign'
  | 'outcome';
type Options = {
  terminalHandoffCorrection: boolean;
  architectureReviewGate: boolean;
  crossModelReview: boolean;
  designApprovalGate: boolean;
};

// Controller doubles supply observations only: no claim of actual native callbacks or effects.
function policy(lane: PropagationLane, denied: boolean, marker: string): PolicyObservation {
  const base = { installation: lane.id, raw: 'synthetic policy observation' };
  if (lane.agent === 'cursor')
    return {
      protocol: 'permission-json',
      observation: {
        ...base,
        decision: {
          permission: denied ? 'deny' : 'allow',
          user_message: 'invalid verification evidence',
        },
        effect: denied ? undefined : 'effect',
        expectedEffect: 'effect',
        afterShellCount: lane.runtime === 'IDE' ? Number(!denied) : undefined,
      },
    };
  if (lane.agent === 'opencode')
    return {
      protocol: 'exit-status',
      observation: {
        ...base,
        observations: [
          { status: denied ? 2 : 0, stdout: '', stderr: 'invalid verification evidence' },
        ],
        effect: denied ? undefined : 'effect',
        expectedEffect: 'effect',
      },
    };
  return {
    protocol: 'stop-json',
    observation: {
      ...base,
      ticket: `status: ${denied ? 'in_progress' : 'done'}`,
      decisions: denied ? [{ decision: 'block', reason: marker }, {}] : [{}],
    },
  };
}

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

type ClaudeFixture = Awaited<ReturnType<typeof prepareClaudeRetainedFixture>>;
type CursorFixture = Awaited<ReturnType<typeof prepareCursorRetainedFixture>>;
type CursorFixtures = Record<'native' | 'project-hooks', CursorFixture>;
type CursorFault = 'conversation' | 'cap' | 'followup' | 'origin';

function cursorBinding(lane: PropagationLane, fixtures?: CursorFixtures) {
  return lane.agent === 'cursor' && lane.runtime === 'IDE'
    ? fixtures?.[lane.delivery as 'native' | 'project-hooks']
    : undefined;
}

async function cursorObservation(
  actor: RetainedPolicyActor,
  evidence: string,
  setup: string,
  setting: Parameters<RetainedPolicyActor['observeVerification']>[2],
  fault: { turn: number; settings?: { replacement?: boolean; cursorFault?: CursorFault } },
) {
  const row = await actor.observeVerification(evidence, setup, setting);
  if (row.protocol !== 'cursor-stop') throw new Error('Cursor protocol missing');
  if (fault.turn <= combinations.length) return row;
  return { ...row, observation: cursorFaultObservation(row.observation, fault.settings) };
}

function cursorFaultObservation(
  actual: Extract<PolicyObservation, { protocol: 'cursor-stop' }>['observation'],
  fault?: { replacement?: boolean; cursorFault?: CursorFault },
) {
  const observation = structuredClone(actual);
  if (fault?.replacement) observation.installation = 'foreign-installation';
  const kind = fault?.cursorFault;
  if (kind === 'origin') observation.origin = '/foreign/origin';
  else if (kind === 'cap') observation.cap = undefined;
  else if (kind === 'conversation' && observation.cap)
    observation.cap.response.input.conversation_id = 'foreign-conversation';
  else if (kind === 'followup')
    observation.stops = observation.stops.map(stop => ({ ...stop, followup: undefined }));
  return observation;
}

function claudeBinding(
  lane: PropagationLane,
  setup?: { fixture?: ClaudeFixture; replacement?: boolean },
) {
  if (lane.agent !== 'claude' || !setup?.fixture) return { observedLane: lane, continuation: {} };
  const retained = retainNativeResourceActor(setup.fixture.actor);
  return {
    observedLane: {
      ...lane,
      id: setup.replacement ? 'foreign-installation' : setup.fixture.prior.installation,
    },
    continuation: {
      observeContinuation: retained.observeContinuation,
      assertContinuation: retained.assertContinuation,
    },
  };
}

export async function exercise(
  fault: Fault,
  settings = true,
  native = false,
  continuation?: 'none' | 'installation' | 'missing' | 'assertion' | 'setup',
  setup?: {
    fixture?: ClaudeFixture;
    replacement?: boolean;
    cursor?: CursorFixtures;
    cursorFault?: CursorFault;
    headless?: true;
    viaNativeMain?: true;
  },
) {
  const root = mkdtempSync(path.join(tmpdir(), 'settings-join-'));
  const { previous, current, policy: plan } = prepareNativePropagationInputs(root, true);
  if (!plan) throw new Error('policy fixture missing');
  const counts = { architecture: 0, handoff: 0, design: 0 };
  const seen = new Map<
    string,
    {
      architecture: PolicyObservation[];
      handoff: TerminalObservation[];
      design: DesignSettingObservation[];
    }
  >();
  const lanes = propagationLanes().filter(lane => !setup?.headless || lane.runtime !== 'IDE');
  const continuationCalls = { observed: 0, asserted: 0 };
  try {
    const prepare = (lane: PropagationLane, initial: CanonicalCatalogueInputs) => {
      const { observedLane, continuation: claudeMethods } = claudeBinding(lane, setup);
      const cursorFixture = cursorBinding(lane, setup?.cursor);
      const cursorActor = cursorFixture && retainNativeResourceActor(cursorFixture.actor);
      const identityLane = cursorFixture
        ? { ...observedLane, id: cursorFixture.prior.installation }
        : observedLane;
      const observations = {
        architecture: [] as PolicyObservation[],
        handoff: [] as TerminalObservation[],
        design: [] as DesignSettingObservation[],
      };
      seen.set(lane.id, observations);
      let revision = initial;
      let turns = 0;
      let designCases = 0;
      let cursorTurns = 0;
      const actor: RetainedPolicyActor = {
        ...claudeMethods,
        ...(lane.agent === 'codex' &&
          continuation !== 'missing' && {
            observeContinuation: () => {
              continuationCalls.observed++;
              return Promise.resolve({
                installation: continuation === 'installation' ? 'foreign' : lane.id,
                raw: 'synthetic controller continuation',
              });
            },
            assertContinuation: () => {
              continuationCalls.asserted++;
              if (continuation === 'assertion') throw new Error('HOST_CONTINUATION_MISSING');
              if (continuation === 'setup')
                throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: first Stop did not block');
            },
          }),
        handoffProtocol:
          lane.agent === 'cursor' && lane.runtime === 'IDE' ? 'cursor-stop' : undefined,
        fingerprint: () =>
          propagationFingerprint(installedPropagationPaths(revision.canonicalRoot, 'project')),
        refreshResources: next => {
          revision = next;
          return Promise.resolve();
        },
        observe: () =>
          Promise.resolve({
            installation: identityLane.id,
            delivery: lane.delivery,
            markers: revision,
            raw: 'synthetic resource observation',
          }),
        observeVerification: (evidence, _setup, setting) => {
          if (setting) {
            counts.architecture++;
            if (cursorActor) {
              cursorTurns++;
              return cursorObservation(cursorActor, evidence, _setup, setting, {
                turn: cursorTurns,
                settings: setup,
              });
            }
            const source =
              fault === 'cursor-protocol' && lane.agent === 'cursor' && lane.runtime === 'IDE'
                ? { ...lane, agent: 'claude' }
                : identityLane;
            const actual = architecture(source, setting.options);
            observations.architecture.push(actual);
            return Promise.resolve(actual);
          }
          const owner = readFileSync(
            path.join(revision.canonicalRoot, 'hooks/lib/done-gate.ts'),
            'utf8',
          );
          const match = /PROPAGATION_VERIFICATION_MARKER_REQUIRED:(VERIFICATION_[a-f0-9-]+)/u.exec(
            owner,
          );
          const marker = match?.[1];
          const denied = Boolean(marker && !evidence.includes(marker));
          return Promise.resolve(policy(identityLane, denied, marker ?? 'unit'));
        },
        observeHandoff: setting => {
          counts.handoff++;
          const actual = handoff(identityLane, setting.options, setting.currentTool, ++turns);
          observations.handoff.push(actual);
          return Promise.resolve(actual);
        },
        observeDesignApproval: options => {
          counts.design++;
          designCases++;
          if (fault === 'case' && lane.agent === 'claude' && designCases === 6)
            throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: case observation missing');
          const actual = faultDesign(
            identityLane,
            options,
            fault === 'cursor-protocol' ? 'none' : fault,
          );
          observations.design.push(actual);
          return Promise.resolve(actual);
        },
      };
      return Promise.resolve(native ? actor : captureNativePropagationActor(actor, lane.id, root));
    };
    const observation = native
      ? await exerciseNative(root, lanes, prepare, continuation !== undefined, {
          claude: !!setup?.fixture,
          cursor: !!setup?.cursor,
          headless: setup?.headless,
          viaNativeMain: setup?.viaNativeMain,
        })
      : {
          result: await runResourcePropagation(
            previous,
            current,
            prepare,
            plan,
            settings ? { retainedSettings: true } : undefined,
          ),
          records: readFileSync(path.join(root, 'observations.jsonl'), 'utf8'),
          inputs: undefined,
        };
    return {
      ...observation,
      result: observation.result as {
        exit: number;
        failures: string[];
        settings?: Awaited<ReturnType<typeof runRetainedSettings>>;
      },
      counts,
      lanes,
      seen,
      continuationCalls,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

interface NativeFixtureMode {
  claude: boolean;
  cursor: boolean;
  headless?: true;
  viaNativeMain?: true;
}

async function exerciseNative(
  root: string,
  lanes: PropagationLane[],
  prepare: (
    lane: PropagationLane,
    initial: CanonicalCatalogueInputs,
  ) => Promise<RetainedPolicyActor>,
  continuation = false,
  selected?: NativeFixtureMode,
) {
  const prior = process.env.SAFEWORD_PROPAGATION_FIXTURES;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  let artifacts = '';
  try {
    const bindings = Object.fromEntries(
      lanes.map(lane => {
        const file = path.join(root, `${encodeURIComponent(lane.id)}.json`);
        writeFileSync(file, '{}');
        return [lane.id, file];
      }),
    );
    const file = path.join(root, 'fixtures.json');
    writeFileSync(file, JSON.stringify(bindings));
    process.env.SAFEWORD_PROPAGATION_FIXTURES = file;
    const result = await runNativeFixture(prepare, continuation, selected);
    const line = log.mock.calls
      .flat()
      .find(value => String(value).startsWith('PROPAGATION_NATIVE_ARTIFACTS '));
    artifacts = String(line).slice('PROPAGATION_NATIVE_ARTIFACTS '.length);
    return {
      result:
        typeof result === 'number'
          ? {
              ...JSON.parse(readFileSync(path.join(artifacts, 'resource-results.json'), 'utf8')),
              exit: result,
            }
          : result,
      records: readFileSync(path.join(artifacts, 'observations.jsonl'), 'utf8'),
      inputs: JSON.parse(readFileSync(path.join(artifacts, 'inputs.json'), 'utf8')),
    };
  } finally {
    log.mockRestore();
    if (prior === undefined) delete process.env.SAFEWORD_PROPAGATION_FIXTURES;
    else process.env.SAFEWORD_PROPAGATION_FIXTURES = prior;
    if (artifacts) rmSync(artifacts, { recursive: true, force: true });
  }
}

function runNativeFixture(
  prepare: NonNullable<Parameters<typeof nativeMain>[0]>,
  continuation: boolean,
  selected?: NativeFixtureMode,
) {
  if (selected?.viaNativeMain) return exerciseHeadlessEntry(prepare);
  return runNativeResourcePropagation('policy-resources', undefined, prepare, {
    retainedSettings: true,
    headless: selected?.headless,
    ...(continuation && { retainedCodexContinuation: true }),
    ...(selected?.claude && { retainedClaudeContinuation: true }),
    ...(selected?.cursor && { retainedCursorContinuation: true }),
  });
}

async function exerciseHeadlessEntry(prepare: Parameters<typeof nativeMain>[0]) {
  const argv = process.argv;
  const deadline = process.env.SAFEWORD_PROPAGATION_DEADLINE;
  try {
    process.argv = [...argv.slice(0, 2), 'headless'];
    process.env.SAFEWORD_PROPAGATION_DEADLINE = String(Date.now() + 60_000);
    return await nativeMain(prepare);
  } finally {
    process.argv = argv;
    if (deadline === undefined) delete process.env.SAFEWORD_PROPAGATION_DEADLINE;
    else process.env.SAFEWORD_PROPAGATION_DEADLINE = deadline;
  }
}

function faultDesign(
  lane: PropagationLane,
  options: Options,
  fault: Exclude<Fault, 'cursor-protocol'>,
) {
  const observed = design(lane, options);
  if (lane.agent !== 'claude') return observed;
  switch (fault) {
    case 'missing': {
      observed.observation.raw = '';
      break;
    }
    case 'installation': {
      observed.observation.installation = 'foreign-installation';
      break;
    }
    case 'foreign': {
      const other = propagationLanes().find(row => row.id !== lane.id);
      if (!other) throw new Error('foreign lane fixture missing');
      observed.observation.installation = other.id;
      break;
    }
    case 'outcome': {
      observed.observation.effect = 'wrong';
      break;
    }
    case 'protocol': {
      return design({ ...lane, agent: 'cursor' }, options);
    }
    case 'case':
    case 'none': {
      break;
    }
  }
  return observed;
}
