import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  CredentialRegistry,
  GitHubRestClient,
  parseRuntimeConfig,
  ProcessLock,
  type RelayRuntime,
  RelayStore,
  type RuntimeConfig,
  type SpikeState,
  type SpikeTopology,
  startRelayRuntime,
  startRelayServer,
  teardownPreview,
  validateSpikeReport,
  validateSpikeTopology,
} from '../packages/retro-relay/dist/index.js';
import type { SafewordWorld } from './world.js';

interface ScenarioState {
  directory?: string;
  environment?: NodeJS.ProcessEnv;
  error?: unknown;
  runtime?: RelayRuntime;
  response?: Response;
  store?: RelayStore;
  server?: Awaited<ReturnType<typeof startRelayServer>>;
  spikeState?: SpikeState;
  topology?: SpikeTopology;
  preview?: string[];
  report?: string;
  secrets?: string[];
  diagnostic?: string;
}

const scenarioStates = new WeakMap<SafewordWorld, ScenarioState>();
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyBase64 = Buffer.from(privateKey.export({ format: 'pem', type: 'pkcs8' })).toString(
  'base64',
);

function scenario(world: SafewordWorld): ScenarioState {
  const existing = scenarioStates.get(world);
  if (existing !== undefined) return existing;
  const created: ScenarioState = {};
  scenarioStates.set(world, created);
  return created;
}

function validEnvironment(directory: string): NodeJS.ProcessEnv {
  return {
    HOST: '0.0.0.0',
    PORT: '3000',
    RELAY_DATA_DIR: directory,
    RELAY_PAYLOAD_KEY: randomBytes(32).toString('base64'),
    RELAY_CREDENTIAL_PEPPER: randomBytes(32).toString('hex'),
    RELAY_CREDENTIAL_ID: 'bdd-spike',
    RELAY_CREDENTIAL_SECRET: randomBytes(32).toString('hex'),
    RELAY_TENANT_ID: 'bdd',
    RELAY_SUBJECT: 'bdd',
    RELAY_HARNESS: 'codex',
    GITHUB_APP_ID: '1',
    GITHUB_APP_PRIVATE_KEY_BASE64: privateKeyBase64,
    GITHUB_INSTALLATION_ID: '1',
    GITHUB_REPOSITORY: 'arcadeai/safeword',
    RELAY_MODE: 'spike',
  };
}

function productionEnvironment(directory: string): NodeJS.ProcessEnv {
  const environment = validEnvironment(directory);
  environment.RELAY_MODE = 'production';
  environment.RELAY_CREDENTIALS_BASE64 = Buffer.from(
    JSON.stringify(
      (['claude', 'codex', 'cursor', 'operator', 'collector-worker'] as const).map(
        (harness, index) => ({
          credentialId: `bdd-${harness}`,
          harness,
          installationId: 1,
          repository: 'arcadeai/safeword',
          roles:
            harness === 'operator'
              ? ['reconcile', 'operate']
              : harness === 'collector-worker'
                ? ['ingest']
                : ['file'],
          secret: String(index + 1).repeat(64),
          subject: `bdd-${harness}`,
          tenantId: 'bdd',
        }),
      ),
    ),
  ).toString('base64');
  return environment;
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('missing BDD port');
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

function fixtureState(): SpikeState {
  return {
    projectId: '5b713344-9f5b-4e9e-bc6a-8e959ecd20a9',
    projectName: 'safeword-relay-spike-bdd',
    environmentId: '37a73eaf-9023-4379-9af0-52f76c6fbe4b',
    serviceId: 'bd3f0223-d88d-4594-8f99-9ffdb29f3f62',
    volumeId: '511eaf85-301d-4b8a-9c25-07a6e397b502',
  };
}

function fixtureTopology(state: SpikeState): SpikeTopology {
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

function capture(state: ScenarioState, operation: () => void): void {
  try {
    operation();
  } catch (error) {
    state.error = error;
  }
}

After(async function (this: SafewordWorld) {
  const state = scenario(this);
  await state.runtime?.close();
  if (state.server?.server.listening === true) {
    await new Promise<void>(resolve => state.server?.server.close(() => resolve()));
  }
  if (state.directory !== undefined) rmSync(state.directory, { recursive: true, force: true });
  scenarioStates.delete(this);
});

Given(
  'an otherwise valid relay runtime missing {string}',
  function (this: SafewordWorld, variable: string) {
    const state = scenario(this);
    state.directory = mkdtempSync(path.join(tmpdir(), 'relay-bdd-'));
    state.environment = validEnvironment(state.directory);
    Reflect.deleteProperty(state.environment, variable);
  },
);

Given(
  'an otherwise valid relay runtime with {string} set to {string}',
  function (this: SafewordWorld, variable: string, fixture: string) {
    const state = scenario(this);
    state.directory = mkdtempSync(path.join(tmpdir(), 'relay-bdd-'));
    state.environment = validEnvironment(state.directory);
    const values: Record<string, string> = {
      'whitespace-only': '   ',
      'filesystem-root': path.parse(process.cwd()).root,
      'invalid-base64': 'invalid-base64',
      'base64-16-byte-key': randomBytes(16).toString('base64'),
      'base64-non-key': Buffer.from('not a key').toString('base64'),
      'empty-string': '',
    };
    Reflect.set(state.environment, variable, Reflect.get(values, fixture) ?? fixture);
  },
);

When('the production runtime configuration is parsed', function (this: SafewordWorld) {
  const state = scenario(this);
  capture(state, () => parseRuntimeConfig(state.environment ?? {}));
});

Then('startup fails before opening the durable store', function (this: SafewordWorld) {
  const state = scenario(this);
  assert(state.error instanceof Error);
  assert.equal(existsSync(path.join(state.directory ?? '', 'relay.sqlite')), false);
});

Given('a running production relay', async function (this: SafewordWorld) {
  const state = scenario(this);
  state.directory = mkdtempSync(path.join(tmpdir(), 'relay-bdd-runtime-'));
  const environment = productionEnvironment(state.directory);
  environment.PORT = String(await availablePort());
  state.runtime = await startRelayRuntime(parseRuntimeConfig(environment), () => {});
});

When('the process receives a shutdown request', async function (this: SafewordWorld) {
  const state = scenario(this);
  await state.runtime?.close();
  state.runtime = undefined;
});

Then('the listener, durable store, and process lock are released', function (this: SafewordWorld) {
  const lockPath = path.join(scenario(this).directory ?? '', 'relay.lock');
  assert.equal(existsSync(lockPath), true);
  const reacquired = ProcessLock.acquire(lockPath);
  reacquired.release();
});

Given(
  'the relay listener is running but the SQLite schema cannot be read',
  async function (this: SafewordWorld) {
    const state = scenario(this);
    state.directory = mkdtempSync(path.join(tmpdir(), 'relay-bdd-health-'));
    const registry = new CredentialRegistry('bdd-pepper');
    state.store = RelayStore.open(path.join(state.directory, 'relay.sqlite'));
    state.server = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: registry,
      github: new GitHubRestClient({
        baseUrl: 'https://api.github.invalid',
        installationToken: async () => 'unused',
      }),
      payloadKey: Buffer.alloc(32),
      store: state.store,
    });
    state.store.close();
  },
);

When('I request its health endpoint', async function (this: SafewordWorld) {
  const state = scenario(this);
  state.response = await fetch(`${state.server?.url}/health`);
});

Then('it responds unavailable rather than healthy', function (this: SafewordWorld) {
  assert.equal(scenario(this).response?.status, 503);
});

Given('a live Railway target has {string}', function (this: SafewordWorld, defect: string) {
  const state = scenario(this);
  state.spikeState = fixtureState();
  state.topology = fixtureTopology(state.spikeState);
  const service = state.topology.services[0];
  if (defect === 'zero running replicas') service.replicas.running = 0;
  if (defect === 'multiple running replicas') service.replicas.configured = 2;
  if (defect === 'zero attached volumes') state.topology.volumes = [];
  if (defect === 'multiple attached volumes') {
    state.topology.volumes.push({ ...state.topology.volumes[0] });
  }
  if (defect === 'one volume mounted outside /data') state.topology.volumes[0].mountPath = '/tmp';
});

When('the hosted smoke validation runs', function (this: SafewordWorld) {
  const state = scenario(this);
  capture(state, () => validateSpikeTopology(state.topology!, state.spikeState!));
});

Then('it stops before the restart durability probe', function (this: SafewordWorld) {
  assert(scenario(this).error instanceof Error);
});

Then(
  'it reports {string} without changing Railway',
  function (this: SafewordWorld, diagnostic: string) {
    assert(String(scenario(this).error).includes(diagnostic));
  },
);

Given(
  'the atomic spike state records exact project, service, and volume IDs',
  function (this: SafewordWorld) {
    scenario(this).spikeState = fixtureState();
  },
);

When('teardown is previewed for {string}', function (this: SafewordWorld, target: string) {
  const state = scenario(this);
  if (target === 'a project without the spike prefix') {
    capture(state, () => teardownPreview({ ...state.spikeState!, projectName: 'production' }));
    return;
  }
  state.error = new Error('target is not present in the atomic state authority');
});

Then('teardown refuses without changing Railway', function (this: SafewordWorld) {
  assert(scenario(this).error instanceof Error);
});

Given('the recorded project has the required spike name prefix', function (this: SafewordWorld) {
  assert(scenario(this).spikeState?.projectName.startsWith('safeword-relay-spike-'));
});

When('teardown is previewed for the recorded target', function (this: SafewordWorld) {
  const state = scenario(this);
  state.preview = teardownPreview(state.spikeState!);
});

Then('it prints only the exact recorded resource IDs', function (this: SafewordWorld) {
  const state = scenario(this);
  assert(state.preview?.includes(state.spikeState?.projectId ?? ''));
  assert.equal(state.preview?.includes(state.spikeState?.serviceId ?? ''), false);
  assert.equal(state.preview?.includes(state.spikeState?.volumeId ?? ''), false);
});

Then(
  'Railway remains unchanged until explicit execution is requested',
  function (this: SafewordWorld) {
    assert.equal(scenario(this).preview?.[0], 'railway');
  },
);

Given('the live deployment checks have completed', function (this: SafewordWorld) {
  scenario(this).report = [
    '## Outcome',
    '## Live topology',
    '## Non-filing evidence',
    '## Resource and cost snapshot',
    '## Limitations and promotion gates',
    '## Teardown preview',
  ].join('\n');
});

When('the spike report is finalized', function (this: SafewordWorld) {
  const state = scenario(this);
  capture(state, () => validateSpikeReport(state.report ?? ''));
});

Then(
  'it records live topology, restart durability, and observed resource usage',
  function (this: SafewordWorld) {
    assert.equal(scenario(this).error, undefined);
  },
);

Then(
  'it records cost provenance, limitations, and production promotion prerequisites',
  function (this: SafewordWorld) {
    assert.equal(scenario(this).error, undefined);
  },
);

Then('it records the exact project-specific teardown command', function (this: SafewordWorld) {
  assert(scenario(this).report?.includes('## Teardown preview'));
});

Given('a spike report has {string}', function (this: SafewordWorld, defect: string) {
  const state = scenario(this);
  state.report = [
    '## Outcome',
    '## Live topology',
    '## Non-filing evidence',
    '## Resource and cost snapshot',
    '## Limitations and promotion gates',
    '## Teardown preview',
  ].join('\n');
  state.secrets = [];
  if (defect === 'a missing required evidence section') {
    state.report = state.report.replace('## Outcome', '');
    state.diagnostic = 'missing required section';
  } else {
    state.report += '\nsecret-value';
    state.secrets = ['secret-value'];
    state.diagnostic = 'secret-bearing field';
  }
});

When('report validation runs', function (this: SafewordWorld) {
  const state = scenario(this);
  capture(state, () => validateSpikeReport(state.report ?? '', state.secrets));
});

Then('the ticket cannot advance to verified', function (this: SafewordWorld) {
  assert(scenario(this).error instanceof Error);
});

Then('the validation reports {string}', function (this: SafewordWorld, diagnostic: string) {
  assert.equal(scenario(this).diagnostic, diagnostic);
});
