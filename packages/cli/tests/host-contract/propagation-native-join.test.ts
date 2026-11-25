import type * as ChildProcess from 'node:child_process';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import { PropagationOutcomeError } from '../../scripts/lib/propagation-policy-phases.js';
import type * as PropagationModule from '../../scripts/lib/resource-propagation.js';
import {
  type PolicyObservation,
  propagationLanes,
  type RetainedPolicyActor,
  runResourcePropagation,
} from '../../scripts/lib/resource-propagation.js';
import type { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import {
  captureNativePropagationActor,
  nativeMain,
  nativePropagationExit,
  prepareNativePropagationInputs,
} from '../../scripts/lib/resource-propagation-run.js';
import { runPropagationComponent } from '../../scripts/run-host-contract-proof.js';
import { ObservedPropagationMismatch } from '../helpers/propagation-policy-case.js';
import {
  installedPropagationPaths,
  propagationFingerprint,
} from '../helpers/propagation-source.js';

vi.mock('node:child_process', async importOriginal => {
  const original = await importOriginal<typeof ChildProcess>();
  return {
    ...original,
    spawnSync: vi.fn(original.spawnSync),
    execFileSync: vi.fn(original.execFileSync),
  };
});
vi.mock('../../scripts/lib/resource-propagation.js', async importOriginal => {
  const original = await importOriginal<typeof PropagationModule>();
  return { ...original, runResourcePropagation: vi.fn(original.runResourcePropagation) };
});

const runner = nodePath.resolve(import.meta.dirname, '../../scripts/run-host-contract-proof.ts');

// Actual public config/dispatch, deliberately no host fixture or native action.
it.each(['resources', 'policy-resources'])(
  'routes the %s component to required-population validation before any host',
  component => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'native-join-entry-'));
    try {
      const file = nodePath.join(root, 'fixtures.json');
      writeFileSync(file, '{}');
      const result = spawnSync(
        'bun',
        [runner, '--proof', 'propagation', '--require-targets', '--component', component],
        { encoding: 'utf8', env: { ...process.env, SAFEWORD_PROPAGATION_FIXTURES: file } },
      );
      expect(result.status).toBe(3);
      expect(result.stderr, 'PUBLIC_POLICY_RESOURCE_COMPONENT_NOT_ROUTED').toContain(
        'fixture bindings differ from required population',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it('keeps the full propagation row unavailable until options and the complete native group join', () => {
  const result = spawnSync('bun', [runner, '--proof', 'propagation', '--require-targets'], {
    encoding: 'utf8',
  });
  expect(result.status).toBe(3);
  expect(result.stderr).toContain('policy/options native probes remain unwired');
});

const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
function tree(root: string) {
  return Object.fromEntries(
    readdirSync(root, { recursive: true })
      .map(String)
      .filter(file => statSync(nodePath.join(root, file)).isFile())
      .map(file => [file, digest(nodePath.join(root, file))]),
  );
}

it('prepares fixed A/B/C with only the canonical policy owner changed in B and only three resources changed in C', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'native-join-input-'));
  try {
    const { previous, current, policy } = prepareNativePropagationInputs(root, true);
    expect(policy).toBeDefined();
    if (!policy) throw new Error('policy input missing');
    const a = tree(previous.canonicalRoot),
      b = tree(policy.inputs.canonicalRoot),
      c = tree(current.canonicalRoot);
    expect(Object.keys(a).filter(file => a[file] !== b[file])).toEqual(['hooks/lib/done-gate.ts']);
    expect(
      Object.keys(b)
        .filter(file => b[file] !== c[file])
        .toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(
      [
        'hooks/audit-principle-trace.ts',
        'skills/explain/HOST_CONTRACT_GUIDE.md',
        'skills/explain/SKILL.md',
      ].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(
      readFileSync(nodePath.join(policy.inputs.canonicalRoot, 'hooks/lib/done-gate.ts'), 'utf8'),
    ).toContain(policy.marker);
    expect(policy.inputs.workflowMarker).toBe(previous.workflowMarker);
    expect(current.workflowMarker).not.toBe(previous.workflowMarker);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Explicit controller doubles ONLY: persistence/classification, never native proof.
it('persists original observations before grading and maps only completed typed mismatches to 2', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'native-join-capture-'));
  const observed = {
    protocol: 'permission-json' as const,
    observation: {
      installation: 'unit',
      raw: 'unit native raw',
      decision: { permission: 'allow' },
      expectedEffect: 'unit effect',
    },
  };
  const resource = {
    installation: 'unit',
    raw: 'unit resources',
    delivery: 'native',
    markers: { workflowMarker: 'a', guideMarker: 'a', helperMarker: 'a' },
  };
  let failed = false;
  const actor: RetainedPolicyActor = {
    observe: () => Promise.resolve(resource),
    observeVerification: () =>
      failed
        ? Promise.reject(
            new ObservedPropagationMismatch(
              observed.observation,
              new Error('unit completed wrong effect'),
            ),
          )
        : Promise.resolve(observed),
    refreshResources: () => Promise.resolve(),
    fingerprint: () => ({ resources: [], policy: '' }),
  };
  try {
    const captured = captureNativePropagationActor(actor, 'unit', root);
    expect(await captured.observe()).toBe(resource);
    expect(await captured.observeVerification('evidence', 'setup')).toBe(observed);
    failed = true;
    await expect(captured.observeVerification('evidence', 'setup')).rejects.toSatisfy(
      error => nativePropagationExit(error) === 2,
    );
    const records = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(records.map(row => row.kind)).toEqual(['resources', 'policy', 'policy-mismatch']);
    for (const row of records) {
      expect(digest(row.raw_artifact)).toBe(row.raw_sha256);
      expect(digest(row.observation_artifact)).toBe(row.observation_sha256);
    }
    expect(JSON.parse(readFileSync(records[2].observation_artifact, 'utf8'))).toEqual(
      observed.observation,
    );
    const missing = new PropagationOutcomeError({ exit: 3, failures: ['missing'] });
    expect(nativePropagationExit(missing)).toBe(3);
    const unknown = Object.assign(new Error('unknown'), { grade: { exit: 2 } });
    expect(nativePropagationExit(unknown)).toBe(3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('keeps missing policy identity unavailable through the actual joined controller', async () => {
  const inputs = {
    canonicalRoot: 'unit',
    workflowMarker: 'a',
    guideMarker: 'a',
    helperMarker: 'a',
  };
  const result = await runResourcePropagation(
    inputs,
    inputs,
    lane =>
      Promise.resolve({
        observe: () =>
          Promise.resolve({
            installation: lane.id,
            delivery: lane.delivery,
            markers: inputs,
            raw: 'unit',
          }),
        observeVerification: () =>
          Promise.resolve({
            protocol: 'stop-json' as const,
            observation: { installation: '', raw: 'unit', decisions: [{}], ticket: 'status: done' },
          }),
        fingerprint: () => ({
          resources: Array.from({ length: 3 }, () => 'a'.repeat(64)),
          policy: 'a'.repeat(64),
        }),
        refreshResources: () => Promise.resolve(),
      }),
    { inputs, marker: 'VERIFICATION_ab' },
  );
  expect(result.exit).toBe(3);
  expect(result.failures.join(',')).toContain('policy installation identity missing');
});

it('preserves resource-only typed failure classification for the direct component caller', async () => {
  const inputs = {
    canonicalRoot: 'unit',
    workflowMarker: 'a',
    guideMarker: 'a',
    helperMarker: 'a',
  };
  const pending = runResourcePropagation(inputs, inputs, lane =>
    Promise.resolve({
      observe: () =>
        Promise.resolve({
          installation: lane.id,
          delivery: lane.delivery,
          raw: 'unit',
          markers: { ...inputs, helperMarker: 'stale' },
        }),
      refreshResources: () => Promise.resolve(),
    }),
  );
  await expect(pending).rejects.toSatisfy(
    error => error instanceof PropagationOutcomeError && nativePropagationExit(error) === 2,
  );
});

// Stateful orchestration doubles, NOT native actors or policy proof. The real
// CLI defaults to the concrete factory; no environment/JSON selects this seam.
it.each([
  [
    'healthy',
    'policy-resources',
    { exit: 0, scope: 'native-policy-resource-propagation-only', records: 56, complete: true },
  ],
  [
    'wrong',
    'policy-resources',
    { exit: 2, scope: 'native-policy-resource-propagation-only', records: 14, complete: false },
  ],
  [
    'missing',
    'policy-resources',
    { exit: 3, scope: 'native-policy-resource-propagation-only', records: 14, complete: false },
  ],
  [
    'resources',
    'resources',
    { exit: 0, scope: 'native-resource-propagation-only', records: 21, complete: false },
  ],
  [
    'wrong-scope',
    'policy-resources',
    { exit: 3, scope: 'native-resource-propagation-only', records: 56, complete: true },
  ],
] as const)(
  'runs real child-main/controller/capture and forwards its %s result through the public component',
  async (fault, component, expected) => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'native-join-wiring-'));
    const argv = process.argv;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let artifacts = '';
    try {
      const bindings = Object.fromEntries(
        propagationLanes().map(lane => {
          const file = nodePath.join(root, `${encodeURIComponent(lane.id)}.json`);
          writeFileSync(file, JSON.stringify({ unit_lane: lane.id }));
          return [lane.id, file];
        }),
      );
      const file = nodePath.join(root, 'fixtures.json');
      writeFileSync(file, JSON.stringify(bindings));
      vi.stubEnv('SAFEWORD_PROPAGATION_FIXTURES', file);
      vi.stubEnv('SAFEWORD_PROPAGATION_DEADLINE', String(Date.now() + 30_000));
      vi.mocked(execFileSync).mockReturnValue('unit-source-head'); // External Git metadata edge only.
      process.argv = [process.execPath, 'resource-propagation-run.ts', component];
      if (fault === 'wrong-scope')
        vi.mocked(runResourcePropagation).mockImplementationOnce(async (...args) => {
          const original = await vi.importActual<typeof PropagationModule>(
            '../../scripts/lib/resource-propagation.js',
          );
          return {
            ...(await original.runResourcePropagation(...args)),
            scope: 'native-resource-propagation-only',
          };
        });
      const prepare: typeof prepareNativeResourceActor = (lane, initial, fixture) => {
        expect(fixture).toEqual({ unit_lane: lane.id });
        let revision = initial;
        return Promise.resolve({
          refreshResources: next => {
            revision = next;
            return Promise.resolve();
          },
          fingerprint: () =>
            propagationFingerprint(installedPropagationPaths(revision.canonicalRoot, 'project')),
          observe: () =>
            Promise.resolve({
              installation: lane.id,
              delivery: lane.delivery,
              markers: revision,
              raw: 'unit resource',
            }),
          observeVerification: evidence => {
            const owner = readFileSync(
              nodePath.join(revision.canonicalRoot, 'hooks/lib/done-gate.ts'),
              'utf8',
            );
            const marker =
              /PROPAGATION_VERIFICATION_MARKER_REQUIRED:(VERIFICATION_[a-f0-9-]+)/u.exec(
                owner,
              )?.[1];
            let denied = Boolean(marker && !evidence.includes(marker));
            const first = lane.id === propagationLanes()[0]?.id;
            if (fault === 'wrong' && first) denied = !denied;
            const observed = unitProtocol(
              lane.agent,
              lane.runtime,
              lane.id,
              denied,
              marker ?? 'unit',
            );
            if (fault === 'missing' && first) observed.observation.raw = '';
            return Promise.resolve(observed);
          },
        });
      };
      const code = await nativeMain(prepare);
      expect(code).toBe(expected.exit);
      const message = log.mock.calls
        .flat()
        .find(value => String(value).startsWith('PROPAGATION_NATIVE_ARTIFACTS '));
      artifacts = String(message).slice('PROPAGATION_NATIVE_ARTIFACTS '.length);
      const result = JSON.parse(
        readFileSync(nodePath.join(artifacts, 'resource-results.json'), 'utf8'),
      );
      expect(result.scope).toBe(expected.scope);
      expect(result.required.map((lane: { id: string }) => lane.id)).toEqual(Object.keys(bindings));
      if (expected.complete) {
        for (const rows of Object.values(result.policy)) expect(rows).toHaveLength(7);
      }
      const records = readFileSync(nodePath.join(artifacts, 'observations.jsonl'), 'utf8')
        .trim()
        .split('\n');
      expect(records).toHaveLength(expected.records);
      if (fault === 'resources') expect(result.policy).toBeUndefined();
      process.argv = [
        process.execPath,
        runner,
        '--proof',
        'propagation',
        '--require-targets',
        '--component',
        component,
      ];
      vi.mocked(spawnSync).mockReturnValueOnce({ status: code } as ReturnType<typeof spawnSync>);
      expect(runPropagationComponent()).toBe(code);
      expect(spawnSync).toHaveBeenLastCalledWith(
        process.execPath,
        [
          nodePath.resolve(import.meta.dirname, '../../scripts/lib/resource-propagation-run.ts'),
          component,
        ],
        expect.any(Object),
      );
    } finally {
      process.argv = argv;
      log.mockRestore();
      vi.unstubAllEnvs();
      vi.mocked(execFileSync).mockReset();
      rmSync(root, { recursive: true, force: true });
      if (artifacts) rmSync(artifacts, { recursive: true, force: true });
    }
  },
);

function unitProtocol(
  agent: string,
  runtime: string,
  installation: string,
  denied: boolean,
  marker: string,
): PolicyObservation {
  const base = { installation, raw: 'unit policy' };
  if (agent === 'cursor')
    return {
      protocol: 'permission-json',
      observation: {
        ...base,
        decision: {
          permission: denied ? 'deny' : 'allow',
          user_message: 'invalid verification evidence',
        },
        expectedEffect: 'unit effect',
        effect: denied ? undefined : 'unit effect',
        afterShellCount: runtime === 'IDE' ? Number(!denied) : undefined,
      },
    };
  if (agent === 'opencode')
    return {
      protocol: 'exit-status',
      observation: {
        ...base,
        observations: [
          { status: denied ? 2 : 0, stdout: '', stderr: 'invalid verification evidence' },
        ],
        expectedEffect: 'unit effect',
        effect: denied ? undefined : 'unit effect',
      },
    };
  return {
    protocol: 'stop-json',
    observation: {
      ...base,
      decisions: denied ? [{ decision: 'block', reason: marker }, {}] : [{}],
      ticket: `status: ${denied ? 'in_progress' : 'done'}`,
    },
  };
}
