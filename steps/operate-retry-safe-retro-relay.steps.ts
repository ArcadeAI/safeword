import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { Before, defineStep } from '@cucumber/cucumber';

import {
  type ScenarioProof,
  validateScenarioProofRegistry,
} from './lib/scenario-proof-registry.js';
import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
const RELAY_PROOF_TIMEOUT_MS = 180_000;

const scenarioProofIds: Record<string, string> = {
  'Each harness submits the exact request persisted by another harness': 'ORR-001',
  'A retry cannot replace the persisted payload or request identity': 'ORR-002',
  'Relay unavailability preserves the draft without delaying the session': 'ORR-003',
  'A multi-draft drain shares one aggregate latency budget': 'ORR-004',
  'An active spool claim excludes another session': 'ORR-005',
  'An expired spool claim is rearmed without changing the request': 'ORR-006',
  'Persisting a new request while another request drains cannot lose either draft': 'ORR-007',
  'Durable acceptance drains the local draft': 'ORR-008',
  'Losing the durable receipt response leaves the same draft retryable': 'ORR-009',
  'Incomplete readiness proof preserves the existing filing path': 'ORR-010',
  'Complete fresh readiness proof selects the relay path': 'ORR-011',
  'Stale or malformed readiness proof fails closed': 'ORR-012',
  'Closed but unlanded or wrong-repository evidence fails closed': 'ORR-013',
  'Readiness for another build fails closed': 'ORR-014',
  'Headless extraction receives no filing credential': 'ORR-015',
  'Production startup authenticates separate harness and operator principals': 'ORR-016',
  'Rotating one harness credential leaves the other principals active': 'ORR-017',
  'A principal cannot cross its repository boundary': 'ORR-018',
  'A harness principal cannot read operator operations': 'ORR-019',
  'Each principal is denied every excluded role': 'ORR-020',
  'Spike mode exposes health only': 'ORR-021',
  'GitHub installation tokens remain opaque inside the relay': 'ORR-022',
  'Production filing requests are resource bounded': 'ORR-023',
  'Maintenance enforces each lifecycle boundary exactly once': 'ORR-024',
  'Durable retry scheduling survives restart': 'ORR-025',
  'No new dispatch starts at the retry deadline': 'ORR-026',
  'A late dispatch resolves or becomes ambiguous by one CAS winner': 'ORR-027',
  'Interrupted schema migration rolls back atomically': 'ORR-028',
  'Unsupported schema metadata is rejected before listen': 'ORR-029',
  'Terminal identity cannot be deleted or silently reidentified': 'ORR-030',
  'A compacted request immediately replays its original filed result': 'ORR-031',
  'The operator sees lifecycle counts through the real HTTP route without secret content':
    'ORR-032',
  'Maintenance emits a deduplicable structured alert for each newly terminal request': 'ORR-033',
  'Immediate ambiguous outcomes are durably alertable': 'ORR-034',
  'Empty or semantically irrelevant readiness evidence fails closed': 'ORR-035',
  'One external durable outbox survives disposable harness workspaces': 'ORR-036',
  'Persistence success is not reported before file and directory sync': 'ORR-037',
  'GitHub create classification ignores undocumented response prose': 'ORR-038',
  'The built production process files through every real collaborator': 'ORR-039',
};

const rawScenarioProofs: Record<
  string,
  Omit<ScenarioProof, 'expectedTests' | 'proofId'> & { expectedTests?: number }
> = {
  'Each harness submits the exact request persisted by another harness': {
    expectedTests: 7,
    outlineCases: [
      'Claude Code',
      'Claude Code Cloud',
      'OpenAI Codex',
      'OpenAI Codex Cloud',
      'Cursor',
      'Cursor Cloud Agents',
    ],
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'A retry cannot replace the persisted payload or request identity': {
    expectedTests: 4,
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Relay unavailability preserves the draft without delaying the session': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'A multi-draft drain shares one aggregate latency budget': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'An active spool claim excludes another session': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'An expired spool claim is rearmed without changing the request': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Persisting a new request while another request drains cannot lose either draft': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Durable acceptance drains the local draft': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Losing the durable receipt response leaves the same draft retryable': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'Incomplete readiness proof preserves the existing filing path': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'Complete fresh readiness proof selects the relay path': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/commands/retro.test.ts',
  },
  'Stale or malformed readiness proof fails closed': {
    expectedTests: 2,
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Closed but unlanded or wrong-repository evidence fails closed': {
    expectedTests: 2,
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Readiness for another build fails closed': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Headless extraction receives no filing credential': {
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Production startup authenticates separate harness and operator principals': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/runtime.test.ts',
  },
  'Rotating one harness credential leaves the other principals active': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/runtime.test.ts',
  },
  'A principal cannot cross its repository boundary': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'A harness principal cannot read operator operations': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Each principal is denied every excluded role': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/runtime.test.ts',
  },
  'Spike mode exposes health only': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/runtime.test.ts',
  },
  'GitHub installation tokens remain opaque inside the relay': {
    expectedTests: 2,
    outlineCases: ['classic opaque', 'stateless dotted ghs_'],
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Production filing requests are resource bounded': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Maintenance enforces each lifecycle boundary exactly once': {
    expectedTests: 3,
    outlineCases: ['retryable', 'dispatching', 'filed'],
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Durable retry scheduling survives restart': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'No new dispatch starts at the retry deadline': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'A late dispatch resolves or becomes ambiguous by one CAS winner': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Interrupted schema migration rolls back atomically': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Unsupported schema metadata is rejected before listen': {
    expectedTests: 4,
    outlineCases: [
      'a partial layout',
      'a newer version',
      'duplicate version rows',
      'no version row',
    ],
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Terminal identity cannot be deleted or silently reidentified': {
    expectedTests: 2,
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'A compacted request immediately replays its original filed result': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'The operator sees lifecycle counts through the real HTTP route without secret content': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Maintenance emits a deduplicable structured alert for each newly terminal request': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Immediate ambiguous outcomes are durably alertable': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Empty or semantically irrelevant readiness evidence fails closed': {
    expectedTests: 2,
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'One external durable outbox survives disposable harness workspaces': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'Persistence success is not reported before file and directory sync': {
    expectedTests: 2,
    packageDirectory: 'packages/cli',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'GitHub create classification ignores undocumented response prose': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/relay.integration.test.ts',
  },
  'The built production process files through every real collaborator': {
    packageDirectory: 'packages/retro-relay',
    testFile: 'tests/runtime-qualification.test.ts',
  },
};

export const scenarioProofs: Record<string, ScenarioProof> = Object.fromEntries(
  Object.entries(rawScenarioProofs).map(([scenarioName, details]) => {
    const proofId = scenarioProofIds[scenarioName];
    assert.ok(proofId, `missing stable proof ID for ${scenarioName}`);
    return [scenarioName, { expectedTests: 1, ...details, proofId }];
  }),
);

assert.deepEqual(
  Object.keys(scenarioProofIds).toSorted(),
  Object.keys(rawScenarioProofs).toSorted(),
  'stable proof ID registry must exactly match scenario proofs',
);

const proofCache = new Map<string, Promise<{ stdout: string; stderr: string; exitCode: number }>>();

async function runProof(
  scenarioName: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scenarioProof = scenarioProofs[scenarioName];
  assert.ok(scenarioProof, `missing Vitest proof mapping for ${scenarioName}`);
  const proofTempDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-bdd-proof-'));
  try {
    const reportPath = nodePath.join(proofTempDirectory, `${scenarioProof.proofId}.json`);
    const result = await execFileAsync(
      'bun',
      [
        'run',
        '--cwd',
        scenarioProof.packageDirectory,
        'test',
        scenarioProof.testFile,
        '-t',
        `\\[${scenarioProof.proofId}\\]`,
        '--reporter=json',
        `--outputFile=${reportPath}`,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_OPTIONS: undefined, TMPDIR: proofTempDirectory },
      },
    );
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { numPassedTests?: number };
    assert.equal(
      report.numPassedTests,
      scenarioProof.expectedTests,
      `${scenarioProof.proofId} selected ${String(report.numPassedTests)} passing tests; expected ${scenarioProof.expectedTests}`,
    );
    return {
      exitCode: 0,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } catch (error: unknown) {
    const failure =
      typeof error === 'object' && error !== null
        ? (error as Record<string, unknown>)
        : { message: String(error) };
    const message = typeof failure.message === 'string' ? failure.message : '';
    const stderr = typeof failure.stderr === 'string' ? failure.stderr : '';
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      stderr: [stderr, message].filter(Boolean).join('\n'),
      stdout: typeof failure.stdout === 'string' ? failure.stdout : '',
    };
  } finally {
    rmSync(proofTempDirectory, { force: true, recursive: true });
  }
}

Before(
  { tags: '@operate-retry-safe-retro-relay', timeout: RELAY_PROOF_TIMEOUT_MS },
  async function (this: SafewordWorld, scenario: { pickle: { name: string } }) {
    const scenarioName = scenario.pickle.name;
    proofCache.set(scenarioName, proofCache.get(scenarioName) ?? runProof(scenarioName));
    this.result = await proofCache.get(scenarioName)!;
  },
);

const feature = readFileSync(
  new URL('../features/operate-retry-safe-retro-relay.feature', import.meta.url),
  'utf8',
);
validateScenarioProofRegistry(scenarioProofs, feature, process.cwd());
const stepTexts = new Set(
  feature
    .split(/\r?\n/u)
    .map(line => /^\s*(?:Given|When|Then|And|But) (.+)$/u.exec(line)?.[1])
    .filter((line): line is string => line !== undefined),
);

function expressionFor(stepText: string): RegExp {
  return new RegExp(
    `^${stepText
      .split(/(<[^>]+>)/u)
      .map(part =>
        part.startsWith('<') ? '.+' : part.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`),
      )
      .join('')}$`,
    'u',
  );
}

const outlineExpressions = [...stepTexts]
  .filter(stepText => stepText.includes('<'))
  .map(expressionFor);

for (const stepText of stepTexts) {
  if (!stepText.includes('<') && outlineExpressions.some(expression => expression.test(stepText))) {
    continue;
  }
  defineStep(expressionFor(stepText), function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  });
}
