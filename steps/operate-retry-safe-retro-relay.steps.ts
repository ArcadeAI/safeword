import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

import { Before, defineStep, setDefaultTimeout } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
setDefaultTimeout(180_000);

type ScenarioProof = { packageDirectory: string; pattern: string; testFile: string };

const scenarioProofs: Record<string, ScenarioProof> = {
  'Each harness submits the exact request persisted by another harness': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'routes all six installed surfaces',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'A retry cannot replace the persisted payload or request identity': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'rejects a changed',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Relay unavailability preserves the draft without delaying the session': {
    packageDirectory: 'packages/cli',
    pattern: 'returns before one second',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'An active spool claim excludes another session': {
    packageDirectory: 'packages/cli',
    pattern: 'claims exclusively',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'An expired spool claim is rearmed without changing the request': {
    packageDirectory: 'packages/cli',
    pattern: 'claims exclusively',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Persisting a new request while another request drains cannot lose either draft': {
    packageDirectory: 'packages/cli',
    pattern: 'cannot lose a concurrent request',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Durable acceptance drains the local draft': {
    packageDirectory: 'packages/cli',
    pattern: 'uses ack as the authoritative commit',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Losing the durable receipt response leaves the same draft retryable': {
    packageDirectory: 'packages/cli',
    pattern: 'returns before one second',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Incomplete readiness proof preserves the existing filing path': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'checked-in disabled manifest',
    testFile: 'tests/cli-wiring.integration.test.ts',
  },
  'Complete fresh readiness proof selects the relay path': {
    packageDirectory: 'packages/cli',
    pattern: 'uses build-embedded evidence',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Stale or malformed readiness proof fails closed': {
    packageDirectory: 'packages/cli',
    pattern: 'fails closed for',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Closed but unlanded or wrong-repository evidence fails closed': {
    packageDirectory: 'packages/cli',
    pattern: 'fails closed for',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Readiness for another build fails closed': {
    packageDirectory: 'packages/cli',
    pattern: 'fails closed for other build',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Headless extraction receives no filing credential': {
    packageDirectory: 'packages/cli',
    pattern: 'constructs a minimal child environment',
    testFile: 'tests/retro/relay-delivery.test.ts',
  },
  'Production startup authenticates separate harness and operator principals': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'loads independently rotatable production principals',
    testFile: 'tests/runtime.test.ts',
  },
  'Rotating one harness credential leaves the other principals active': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'rotates one harness credential',
    testFile: 'tests/runtime.test.ts',
  },
  'A principal cannot cross its repository boundary': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'authorizes the exact repository',
    testFile: 'tests/relay.integration.test.ts',
  },
  'A harness principal cannot read operator operations': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'exposes payload-free lifecycle operations',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Each principal is denied every excluded role': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'denies operator filing',
    testFile: 'tests/runtime.test.ts',
  },
  'Spike mode exposes health only': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'exposes health only in spike mode',
    testFile: 'tests/runtime.test.ts',
  },
  'GitHub installation tokens remain opaque inside the relay': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'treats installation token format',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Production filing requests are resource bounded': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'bounds request size fields',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Maintenance enforces each lifecycle boundary exactly once': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'prevents a new dispatch|allows exactly one|compacts payload access',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Durable retry scheduling survives restart': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'persists due scheduling',
    testFile: 'tests/lifecycle.test.ts',
  },
  'No new dispatch starts at the retry deadline': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'prevents a new dispatch',
    testFile: 'tests/lifecycle.test.ts',
  },
  'A late dispatch resolves or becomes ambiguous by one CAS winner': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'allows exactly one filed or ambiguous',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Interrupted schema migration rolls back atomically': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'rolls back every migration mutation',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Unsupported schema metadata is rejected before listen': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'rejects .* schema metadata before use',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Terminal identity cannot be deleted or silently reidentified': {
    packageDirectory: 'packages/retro-relay',
    pattern:
      'does not start a dispatch when token acquisition crosses|immediately returns the original filed result',
    testFile: 'tests/relay.integration.test.ts',
  },
  'A compacted request immediately replays its original filed result': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'immediately returns the original filed result',
    testFile: 'tests/relay.integration.test.ts',
  },
  'The operator sees lifecycle counts through the real HTTP route without secret content': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'exposes payload-free lifecycle operations',
    testFile: 'tests/relay.integration.test.ts',
  },
  'Maintenance emits a deduplicable structured alert for each newly terminal request': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'reports lifecycle counts and stable deduplicable alert',
    testFile: 'tests/lifecycle.test.ts',
  },
  'Immediate ambiguous outcomes are durably alertable': {
    packageDirectory: 'packages/retro-relay',
    pattern: 'atomically records an alert',
    testFile: 'tests/lifecycle.test.ts',
  },
};

const proofCache = new Map<string, Promise<{ stdout: string; stderr: string; exitCode: number }>>();

async function runProof(
  scenarioName: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scenarioProof = scenarioProofs[scenarioName];
  assert.ok(scenarioProof, `missing Vitest proof mapping for ${scenarioName}`);
  try {
    const result = await execFileAsync(
      'bun',
      [
        'run',
        '--cwd',
        scenarioProof.packageDirectory,
        'test',
        scenarioProof.testFile,
        '-t',
        scenarioProof.pattern,
      ],
      { cwd: process.cwd() },
    );
    return {
      exitCode: 0,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } catch (error: unknown) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    return {
      exitCode: failure.code ?? 1,
      stderr: failure.stderr ?? '',
      stdout: failure.stdout ?? '',
    };
  }
}

Before(
  { tags: '@operate-retry-safe-retro-relay' },
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
