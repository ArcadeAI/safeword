import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

import { Before, defineStep, setDefaultTimeout } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);
setDefaultTimeout(180_000);

let proof: Promise<{ stdout: string; stderr: string; exitCode: number }> | undefined;

async function runProof(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const [client, server] = await Promise.all([
      execFileAsync(
        'bun',
        [
          'run',
          '--cwd',
          'packages/cli',
          'test',
          'tests/retro/relay-delivery.test.ts',
          'tests/integration/retro-relay-wiring.test.ts',
        ],
        { cwd: process.cwd() },
      ),
      execFileAsync(
        'bun',
        [
          'run',
          '--cwd',
          'packages/retro-relay',
          'test',
          'tests/lifecycle.test.ts',
          'tests/runtime.test.ts',
          'tests/relay.integration.test.ts',
        ],
        { cwd: process.cwd() },
      ),
    ]);
    return {
      exitCode: 0,
      stderr: `${client.stderr}\n${server.stderr}`,
      stdout: `${client.stdout}\n${server.stdout}`,
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

Before({ tags: '@operate-retry-safe-retro-relay' }, async function (this: SafewordWorld) {
  proof ??= runProof();
  this.result = await proof;
});

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
