import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

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
        state: 'action_required',
        nextActions: [
          {
            kind: 'human',
            instruction: 'Restart the app, then open a new task.',
            mutates: false,
            requiresHuman: true,
          },
        ],
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

  it('distinguishes a human next action from an executable command', () => {
    const result = createResult({
      state: 'action_required',
      nextActions: [
        {
          kind: 'human',
          instruction: 'Restart the app, then open a new task.',
          mutates: false,
          requiresHuman: true,
        },
      ],
    });

    expect(JSON.parse(renderJsonResult(result))).toMatchObject({
      next_actions: [
        {
          kind: 'human',
          instruction: 'Restart the app, then open a new task.',
          mutates: false,
          requires_human: true,
        },
      ],
    });
    expect(renderHumanResult(result)).toContain('Next: Restart the app, then open a new task.');
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

  it('renders doctor coverage and causes in ordinary human output', () => {
    const output = renderHumanResult(
      createResult({
        state: 'action_required',
        findings: [
          {
            code: 'PROJECT_NOT_CONFIGURED',
            message: 'Safeword is not configured in this project.',
            severity: 'warning',
          },
        ],
        data: {
          command: 'doctor',
          coverage: [
            {
              surface: 'project',
              state: 'action_required',
              evidence: { configured: false, cli_version: '0.72.0' },
            },
          ],
          diagnostics: [
            {
              surface: 'project',
              kind: 'finding',
              code: 'PROJECT_NOT_CONFIGURED',
              cause: 'Safeword is not configured in this project.',
            },
          ],
        },
      }),
    );

    expect(output).toContain('Diagnostic coverage:');
    expect(output).toContain('- Project: needs attention (configured=false, cli version=0.72.0)');
    expect(output).toContain(
      '- Project [PROJECT_NOT_CONFIGURED]: Safeword is not configured in this project.',
    );
    expect(output.match(/Safeword is not configured in this project\./gu)).toHaveLength(1);
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

  it.each([
    {
      name: 'approved standard',
      state: 'healthy',
      status: 'approved',
      independence: 'degraded',
      reviewer: 'codex',
      verdict: 'approve',
      policy: undefined,
      line: 'Review complete — standard coverage.',
    },
    {
      name: 'changes-requested standard',
      state: 'action_required',
      status: 'changes_requested',
      independence: 'degraded',
      reviewer: 'codex',
      verdict: 'request_changes',
      policy: undefined,
      line: 'Review changes requested — standard coverage.',
    },
    {
      name: 'approved independent',
      state: 'healthy',
      status: 'approved',
      independence: 'cross-agent',
      reviewer: 'claude',
      verdict: 'approve',
      policy: undefined,
      line: 'Review complete — independent coverage.',
    },
    {
      name: 'required standard',
      state: 'action_required',
      status: 'blocked',
      independence: 'degraded',
      reviewer: 'codex',
      verdict: 'approve',
      policy: 'require',
      line: 'Review blocked — standard coverage achieved; required independent coverage is unsatisfied.',
    },
    {
      name: 'incomplete',
      state: 'action_required',
      status: 'blocked',
      independence: 'none',
      reviewer: undefined,
      verdict: undefined,
      policy: 'prefer',
      line: 'Review incomplete.',
    },
  ] as const)(
    'renders coverage first for $name without rewriting provenance',
    ({ state, status, independence, reviewer, verdict, policy, line }) => {
      const data = {
        command: 'review run',
        status,
        author_agent: 'codex',
        assigned_reviewer: 'claude',
        ...(reviewer !== undefined && { actual_reviewer: reviewer }),
        independence,
        ...(policy !== undefined && { review_policy: policy }),
        ...(verdict !== undefined && {
          reviewer_output: { verdict, reviewer_agent: reviewer, summary: 'Review summary.' },
        }),
      };
      const result = createResult({
        state,
        findings: [
          {
            code: 'REVIEW_INDEPENDENCE_DEGRADED',
            message: 'This review was not independent.',
            severity: 'warning',
          },
        ],
        data,
      });

      expect(renderHumanResult(result).split('\n', 1)[0]).toBe(line);
      if (independence === 'degraded') {
        expect(renderHumanResult(result)).toContain('not independent');
      }
      expect(result.data).toEqual(data);
    },
  );

  it.each([undefined, 'prefer'])(
    'does not invent a required-independence block for policy %s',
    policy => {
      const result = createResult({
        state: 'action_required',
        data: {
          command: 'review run',
          status: 'blocked',
          author_agent: 'codex',
          actual_reviewer: 'codex',
          independence: 'degraded',
          ...(policy !== undefined && { review_policy: policy }),
          reviewer_output: {
            verdict: 'approve',
            reviewer_agent: 'codex',
            summary: 'Checked.',
            findings: [],
          },
        },
      });

      expect(renderHumanResult(result).split('\n', 1)[0]).toBe('Review incomplete.');
    },
  );

  it.each([
    ['missing reviewer output', undefined],
    ['malformed reviewer output', { verdict: 'looks_good', reviewer_agent: 'codex' }],
  ])('does not present completion for %s', (_label, reviewerOutput) => {
    const result = createResult({
      state: 'healthy',
      data: {
        command: 'review run',
        status: 'approved',
        author_agent: 'codex',
        actual_reviewer: 'codex',
        independence: 'degraded',
        ...(reviewerOutput !== undefined && { reviewer_output: reviewerOutput }),
      },
    });

    expect(renderHumanResult(result)).toBe('Review incomplete.');
  });

  it.each([
    ['missing output reviewer', undefined],
    ['mismatched output reviewer', 'claude'],
  ])('does not present completion for %s', (_label, reviewerAgent) => {
    const result = createResult({
      state: 'healthy',
      data: {
        command: 'review run',
        status: 'approved',
        author_agent: 'codex',
        actual_reviewer: 'codex',
        independence: 'degraded',
        reviewer_output: {
          verdict: 'approve',
          ...(reviewerAgent !== undefined && { reviewer_agent: reviewerAgent }),
        },
      },
    });

    expect(renderHumanResult(result)).toBe('Review incomplete.');
  });

  it.each([
    ['approved', 'request_changes'],
    ['changes_requested', 'approve'],
  ] as const)('does not present completion for mismatched %s/%s', (status, verdict) => {
    const result = createResult({
      state: status === 'approved' ? 'healthy' : 'action_required',
      data: {
        command: 'review run',
        status,
        author_agent: 'codex',
        actual_reviewer: 'codex',
        independence: 'degraded',
        reviewer_output: {
          verdict,
          reviewer_agent: 'codex',
          summary: 'Checked.',
          findings: [],
        },
      },
    });

    expect(renderHumanResult(result)).toBe('Review incomplete.');
  });

  it.each([
    ['not_installed', 'To add independent coverage, install or update Claude, then retry review.'],
    [
      'untrusted_install',
      'To add independent coverage, move Claude to a trusted non-writable-by-group directory, then retry review.',
    ],
    ['not_authenticated', 'To add independent coverage, sign in to Claude, then retry review.'],
    ['timed_out', 'To add independent coverage, retry Claude review.'],
    ['process_failed', 'To add independent coverage, retry Claude review.'],
    ['invalid_output', 'To add independent coverage, retry Claude review.'],
  ] as const)('shows one verbose suggestion for %s', (failure, suggestion) => {
    const result = createResult({
      state: 'healthy',
      data: {
        command: 'review run',
        status: 'approved',
        author_agent: 'codex',
        assigned_reviewer: 'claude',
        actual_reviewer: 'codex',
        preferred_failure: failure,
        independence: 'degraded',
        reviewer_output: { verdict: 'approve', reviewer_agent: 'codex' },
      },
    });

    expect(renderHumanResult(result)).not.toContain('To add independent coverage');
    expect(renderHumanResult(result, { verbose: true })).toContain(suggestion);
    expect(result.recovery).toEqual([]);
  });

  it('renders an explicit review opt-out as not requested', () => {
    const result = createResult({
      state: 'healthy',
      findings: [
        {
          code: 'REVIEW_NOT_REQUESTED',
          message: 'An independent agent check was not requested.',
          severity: 'info',
        },
      ],
      data: {
        command: 'review run',
        status: 'existing_route',
        author_agent: 'claude',
        independence: 'none',
        cross_agent_review: 'not_requested',
      },
    });

    expect(renderHumanResult(result)).toBe('Review not requested.');
  });

  it('renders an in-flight review as running', () => {
    const result = createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_PENDING',
          message: 'The independent review is still working in the background.',
          severity: 'info',
        },
      ],
      data: { command: 'review run', status: 'pending' },
    });

    expect(renderHumanResult(result).split('\n', 1)[0]).toBe('Review running in the background.');
  });

  it('renders a source-changed review as stale', () => {
    const result = createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_STALE',
          message: 'A reviewed source changed during the check.',
          severity: 'warning',
        },
      ],
      data: {
        command: 'review run',
        status: 'stale',
        author_agent: 'claude',
        assigned_reviewer: 'codex',
        review_policy: 'prefer',
        independence: 'none',
      },
    });

    expect(renderHumanResult(result)).toBe('Review stale — sources changed during the check.');
  });

  it('keeps failed reviews on the generic failure presentation', () => {
    const result = createResult({
      state: 'failed',
      errors: [
        { code: 'REVIEWER_WRITE_ATTEMPT', message: 'Review packet changed.', retryable: false },
      ],
      data: { command: 'review run', status: 'blocked', review_policy: 'require' },
    });

    expect(renderHumanResult(result).split('\n', 1)[0]).toBe('Failed');
  });

  it('presents an error-free failed review tuple as incomplete', () => {
    const result = createResult({
      state: 'failed',
      data: { command: 'review run', status: 'approved' },
    });

    expect(renderHumanResult(result).split('\n', 1)[0]).toBe('Review incomplete.');
  });

  it.each([
    { author: 'codex', actual: 'claude', assigned: 'claude', failure: 'not_installed' },
    { author: 'codex', actual: 'codex', assigned: 'codex', failure: 'not_installed' },
    { author: 'codex', actual: 'codex', assigned: 'claude', failure: 'not_installedX' },
  ])('does not suggest an upgrade for untrusted tuple %#', tuple => {
    const result = createResult({
      state: 'healthy',
      data: {
        command: 'review run',
        status: 'approved',
        author_agent: tuple.author,
        assigned_reviewer: tuple.assigned,
        actual_reviewer: tuple.actual,
        preferred_failure: tuple.failure,
        independence: 'degraded',
        reviewer_output: { verdict: 'approve', reviewer_agent: tuple.actual },
      },
    });

    expect(renderHumanResult(result, { verbose: true })).not.toContain(
      'To add independent coverage',
    );
  });

  it('does not suggest an upgrade when approved provenance lacks validated reviewer output', () => {
    const result = createResult({
      state: 'healthy',
      data: {
        command: 'review run',
        status: 'approved',
        author_agent: 'codex',
        assigned_reviewer: 'claude',
        actual_reviewer: 'codex',
        preferred_failure: 'not_installed',
        independence: 'degraded',
      },
    });

    expect(renderHumanResult(result, { verbose: true })).toBe('Review incomplete.');
  });
});
