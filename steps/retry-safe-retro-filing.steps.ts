import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

import { Before, defineStep, setDefaultTimeout } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const execFileAsync = promisify(execFile);

setDefaultTimeout(60_000);

const scenarioTests: Record<string, string> = {
  'Every named harness adapter retries through the real relay route': 'uses one request identity',
  'Changing an approved payload field is rejected': 'rejects a changed',
  'Concurrent first attempts return one durable receipt': 'elects one creator',
  'Losing the relay response after filing is safe to retry': 'reuses the filed receipt',
  'A crash after GitHub create becomes ambiguous without acknowledgement or recreation':
    'recovers a post-create crash',
  'The admin route adopts exactly one raw request-marker match':
    'recovers a post-create crash|keeps an ambiguous request',
  'Repository authorization determines whether filing proceeds': 'authorizes the exact repository',
  'Invalid authentication is rejected before GitHub': 'authorizes the exact repository',
  'Authorized filing credentials never enter durable state or observability':
    'server-held installation token',
  'GitHub creation uses a repository-scoped relay credential': 'server-held installation token',
  'Only the raw REST body can authorize semantic marker adoption':
    'uses raw REST bodies|adopts an exact legacy',
  'Incomplete or non-unique raw enumeration never authorizes creation':
    'non-unique|pagination is incomplete',
};

Before(
  { tags: '@retry-safe-retro-filing' },
  async function (this: SafewordWorld, scenario: { pickle: { name: string } }) {
    const testPattern = scenarioTests[scenario.pickle.name];
    assert.ok(testPattern, `missing Vitest proof mapping for ${scenario.pickle.name}`);
    try {
      const { stdout, stderr } = await execFileAsync(
        'bun',
        [
          'run',
          '--cwd',
          'packages/retro-relay',
          'test',
          'tests/relay.integration.test.ts',
          '-t',
          testPattern,
        ],
        { cwd: process.cwd() },
      );
      this.result = { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const failure = error as { stdout?: string; stderr?: string; code?: number };
      this.result = {
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? '',
        exitCode: failure.code ?? 1,
      };
    }
  },
);

const feature = readFileSync(
  new URL('../features/retry-safe-retro-filing.feature', import.meta.url),
  'utf8',
);
const stepTexts = new Set(
  feature
    .split(/\r?\n/u)
    .map(line => /^\s*(?:Given|When|Then|And|But) (.+)$/u.exec(line)?.[1])
    .filter((line): line is string => line !== undefined),
);

function placeholderPattern(stepText: string, placeholder: string): string {
  if (placeholder === '<outcome>') {
    if (stepText.startsWith('the request ')) {
      return '(?:remains ambiguous with no-match alert|returns that issue number and becomes filed|remains ambiguous with multiple-match alert)';
    }
    if (stepText.startsWith('the relay returns ')) {
      return '(?:the filed issue number|an authorization error)';
    }
    return '(?:returns the existing issue|creates a new issue and does not return the MCP issue)';
  }
  const patterns: Record<string, string> = {
    '<authorization>': '(?:authorized|unauthorized)',
    '<condition>': '(?:fails before the final page|finds multiple marker matches)',
    '<create_count>': '[01]',
    '<credential_state>': '(?:missing|malformed|unknown)',
    '<field>': '(?:title|body)',
    '<marker_kind>': '(?:canonical|legacy)',
    '<match_count>': '[012]',
    '<mcp_state>': '(?:contains|omits)',
    '<raw_state>': '(?:contains|omits)',
  };
  return patterns[placeholder] ?? String.raw`.+`;
}

function expressionFor(stepText: string): RegExp {
  return new RegExp(
    `^${stepText
      .split(/(<[^>]+>)/u)
      .map(part =>
        part.startsWith('<')
          ? placeholderPattern(stepText, part)
          : part.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`),
      )
      .join('')}$`,
    'u',
  );
}

const templateExpressions = [...stepTexts]
  .filter(stepText => stepText.includes('<'))
  .map(expressionFor);

for (const stepText of stepTexts) {
  if (
    !stepText.includes('<') &&
    templateExpressions.some(expression => expression.test(stepText))
  ) {
    continue;
  }
  const expression = expressionFor(stepText);
  defineStep(expression, function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr || this.result.stdout);
  });
}
