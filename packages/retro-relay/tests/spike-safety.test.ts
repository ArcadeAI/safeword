import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  type SpikeState,
  teardownPreview,
  validateSpikeReport,
  validateSpikeTopology,
  writeSpikeStateAtomic,
} from '../src/spike-safety.js';

const state: SpikeState = {
  projectId: '5b713344-9f5b-4e9e-bc6a-8e959ecd20a9',
  projectName: 'safeword-relay-spike-0726',
  environmentId: '37a73eaf-9023-4379-9af0-52f76c6fbe4b',
  serviceId: 'bd3f0223-d88d-4594-8f99-9ffdb29f3f62',
  volumeId: '511eaf85-301d-4b8a-9c25-07a6e397b502',
};

const directories: string[] = [];
const SUBPROCESS_TEST_TIMEOUT_MS = 15_000;
afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function validTopology() {
  return {
    services: [
      {
        id: state.serviceId,
        replicas: { configured: 1, running: 1 },
        volumes: [{ mountPath: '/data' }],
      },
    ],
    volumes: [{ id: state.volumeId, mountPath: '/data', serviceName: 'retro-relay' }],
  };
}

const topologyDefects: [string, (topology: ReturnType<typeof validTopology>) => void, string][] = [
  [
    'zero replicas',
    topology => {
      topology.services[0].replicas.running = 0;
    },
    'replica',
  ],
  [
    'two replicas',
    topology => {
      topology.services[0].replicas.configured = 2;
    },
    'replica',
  ],
  [
    'zero volumes',
    topology => {
      topology.volumes = [];
    },
    'volume count',
  ],
  [
    'two volumes',
    topology => {
      topology.volumes.push(topology.volumes[0]);
    },
    'volume count',
  ],
  [
    'wrong mount',
    topology => {
      topology.volumes[0].mountPath = '/tmp';
    },
    'volume mount',
  ],
];

describe('Railway spike safety', () => {
  it.each(topologyDefects)('rejects %s', (_name, mutate, diagnostic) => {
    const topology = validTopology();
    mutate(topology);
    expect(() => {
      validateSpikeTopology(topology, state);
    }).toThrow(diagnostic);
  });

  it('atomically records validated IDs and previews only the exact project deletion', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'railway-spike-state-'));
    directories.push(directory);
    const statePath = path.join(directory, 'state.json');
    await writeSpikeStateAtomic(statePath, state);

    expect(JSON.parse(readFileSync(statePath, 'utf8'))).toEqual(state);
    expect(teardownPreview(state)).toContain(state.projectId);
    expect(() => teardownPreview({ ...state, projectName: 'production' })).toThrow(
      'not a disposable',
    );
  });

  it(
    'wires teardown preview through a real state file and subprocess',
    () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'railway-spike-command-'));
      directories.push(directory);
      const statePath = path.join(directory, 'state.json');
      const scriptPath = path.join(process.cwd(), 'scripts', 'railway-spike.ts');
      const tsxPath = path.join(process.cwd(), '..', '..', 'node_modules', '.bin', 'tsx');
      const record = spawnSync(tsxPath, [scriptPath, 'record-state', statePath], {
        encoding: 'utf8',
        input: JSON.stringify(state),
      });
      expect(record.status).toBe(0);
      const topology = spawnSync(tsxPath, [scriptPath, 'validate-topology', statePath], {
        encoding: 'utf8',
        input: JSON.stringify(validTopology()),
      });
      expect(topology.status).toBe(0);
      const result = spawnSync(tsxPath, [scriptPath, 'teardown-preview', statePath], {
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(state.projectId);
      expect(result.stdout).not.toContain(state.serviceId);
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  it('rejects incomplete or secret-bearing reports', () => {
    const report = [
      '## Outcome',
      '## Live topology',
      '## Non-filing evidence',
      '## Resource and cost snapshot',
      '## Limitations and promotion gates',
      '## Teardown preview',
    ].join('\n');
    expect(() => {
      validateSpikeReport(report);
    }).not.toThrow();
    expect(() => {
      validateSpikeReport(report.replace('## Outcome', ''));
    }).toThrow('missing report section');
    expect(() => {
      validateSpikeReport(`${report}\nsecret-value`, ['secret-value']);
    }).toThrow('credential material');

    const directory = mkdtempSync(path.join(tmpdir(), 'railway-spike-report-'));
    directories.push(directory);
    const reportPath = path.join(directory, 'report.md');
    writeFileSync(reportPath, `${report}\nsecret-value`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'railway-spike.ts');
    const tsxPath = path.join(process.cwd(), '..', '..', 'node_modules', '.bin', 'tsx');
    const result = spawnSync(tsxPath, [scriptPath, 'validate-report', reportPath], {
      encoding: 'utf8',
      input: JSON.stringify(['secret-value']),
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('secret-value');
    expect(result.stderr).not.toContain('secret-value');
  });
});
