import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import {
  createResult,
  exitStatusFor,
  renderHumanResult,
  renderHumanStreams,
  renderJsonResult,
} from '../../src/cli-protocol/result.js';

describe('CLI result protocol', () => {
  it('validates representative golden envelopes against the published v1 JSON Schema', () => {
    const schemaPath = nodePath.resolve(
      import.meta.dirname,
      '../../schemas/cli-result-v1.schema.json',
    );
    const validate = new Ajv({ allErrors: true }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8')),
    );
    const envelopes = [
      createResult({ state: 'healthy' }),
      createResult({
        state: 'action_required',
        findings: [{ code: 'DRIFT', message: 'Managed files differ.', severity: 'warning' }],
        nextActions: [{ command: 'safeword plan', mutates: false, requiresHuman: false }],
        data: { plan: { id: 'plan-1' } },
      }),
      createResult({
        state: 'failed',
        errors: [{ code: 'BROKEN', message: 'The operation failed.', retryable: true }],
        recovery: [
          {
            command: 'safeword doctor',
            description: 'Inspect the project before retrying.',
            requiresHuman: true,
          },
        ],
      }),
    ].map(result => JSON.parse(renderJsonResult(result)));

    for (const envelope of envelopes) {
      expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it.each([
    ['healthy', 0],
    ['changed', 0],
    ['failed', 1],
    ['action_required', 2],
  ] as const)('maps %s to exit status %i', (state, status) => {
    expect(exitStatusFor(createResult({ state }))).toBe(status);
  });

  it('renders one complete schema-version-1 JSON envelope', () => {
    const result = createResult({
      state: 'action_required',
      findings: [{ code: 'DRIFT', message: 'Managed files differ.', severity: 'warning' }],
      nextActions: [{ command: 'safeword plan', mutates: false, requiresHuman: false }],
    });

    const parsed = JSON.parse(renderJsonResult(result)) as Record<string, unknown>;
    expect(parsed).toEqual({
      schema_version: 1,
      ok: true,
      state: 'action_required',
      changed: false,
      findings: [{ code: 'DRIFT', message: 'Managed files differ.', severity: 'warning' }],
      effects: {
        files: [],
        packages: [],
        configuration: [],
        network: [],
        destructive: [],
      },
      errors: [],
      recovery: [],
      next_actions: [{ command: 'safeword plan', mutates: false, requires_human: false }],
    });
  });

  it('renders one human verdict, an explicit change statement, and one next action', () => {
    const output = renderHumanResult(
      createResult({
        state: 'action_required',
        findings: [
          { code: 'DRIFT', message: 'Managed files differ.', severity: 'warning' },
          { code: 'DRIFT', message: 'Managed files differ.', severity: 'warning' },
        ],
        nextActions: [
          { command: 'safeword plan', mutates: false, requiresHuman: false },
          { command: 'safeword setup', mutates: true, requiresHuman: true },
        ],
      }),
    );

    expect(output).toBe(
      ['Needs attention', 'Changed: no', 'Managed files differ.', 'Next: safeword plan'].join('\n'),
    );
  });

  it('shows no next action for a healthy result', () => {
    expect(renderHumanResult(createResult({ state: 'healthy' }))).toBe(
      ['Healthy', 'Changed: no'].join('\n'),
    );
  });

  it('suppresses all healthy prose in quiet mode', () => {
    expect(renderHumanResult(createResult({ state: 'healthy' }), { quiet: true })).toBe('');
  });

  it('keeps internal detail behind verbose and preserves errors in quiet mode', () => {
    const failed = createResult({
      state: 'failed',
      errors: [
        {
          code: 'BROKEN_CONFIG',
          message: 'Configuration could not be parsed.',
          retryable: false,
          detail: 'line 19, token 4',
        },
      ],
      nextActions: [{ command: 'safeword doctor --verbose', mutates: false, requiresHuman: true }],
    });

    expect(renderHumanResult(failed, { quiet: true })).toBe(
      [
        'Failed',
        'Changed: no',
        'Configuration could not be parsed.',
        'Next: safeword doctor --verbose',
      ].join('\n'),
    );
    expect(renderHumanResult(failed, { verbose: true })).toContain('line 19, token 4');
    expect(renderHumanResult(failed)).not.toContain('line 19, token 4');
  });

  it('keeps completed effect detail behind verbose output', () => {
    const changed = createResult({
      state: 'changed',
      effects: {
        files: [
          { kind: 'create', target: '.safeword/config.json' },
          { kind: 'update', target: 'package.json' },
        ],
      },
    });

    expect(renderHumanResult(changed)).toBe(['Complete', 'Changed: yes'].join('\n'));
    expect(renderHumanResult(changed, { verbose: true })).toContain(
      'Created: .safeword/config.json',
    );
  });

  it('renders the exact proposed plan without treating it as completed effects', () => {
    const output = renderHumanResult(
      createResult({
        state: 'action_required',
        data: {
          plan: {
            effects: {
              files: [{ kind: 'write', target: '.safeword/version' }],
              packages: [{ kind: 'install', target: 'eslint' }],
              configuration: [],
              network: [{ kind: 'registry', target: 'eslint' }],
              destructive: [],
            },
          },
        },
      }),
    );

    expect(output).toContain('Planned effects:');
    expect(output).toContain('files: write .safeword/version');
    expect(output).toContain('packages: install eslint');
    expect(output).toContain('network: registry eslint');
  });

  it('renders raw artifacts and their findings through one shared stream contract', () => {
    const result = createResult({
      state: 'healthy',
      presentation: { kind: 'raw', body: String.raw`printf %s "$TARGET"\n` },
      findings: [
        {
          code: 'CLI_ALIAS_DEPRECATED',
          message: '`test-plan` is deprecated; use `project test-plan`.',
          severity: 'warning',
        },
      ],
    });

    expect(renderHumanStreams(result)).toEqual({
      stdout: String.raw`printf %s "$TARGET"\n`,
      stderr: '`test-plan` is deprecated; use `project test-plan`.',
    });
    expect(renderHumanStreams(result, { quiet: true })).toEqual({
      stdout: String.raw`printf %s "$TARGET"\n`,
      stderr: '',
    });
  });
});
