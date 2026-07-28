export type ResultState = 'healthy' | 'changed' | 'action_required' | 'failed';

export interface Finding {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResultError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly detail?: string;
}

export interface NextAction {
  readonly command: string;
  readonly mutates: boolean;
  readonly requiresHuman: boolean;
}

export interface RecoveryAction {
  readonly command: string;
  readonly description: string;
  readonly requiresHuman: boolean;
}

export interface Effect {
  readonly kind: string;
  readonly target: string;
  readonly operation?: string;
}

export interface Effects {
  readonly files: readonly Effect[];
  readonly packages: readonly Effect[];
  readonly configuration: readonly Effect[];
  readonly network: readonly Effect[];
  readonly destructive: readonly Effect[];
}

export interface CliResult {
  readonly schemaVersion: 1;
  readonly ok: boolean;
  readonly state: ResultState;
  readonly changed: boolean;
  readonly findings: readonly Finding[];
  readonly effects: Effects;
  readonly errors: readonly ResultError[];
  readonly recovery: readonly RecoveryAction[];
  readonly nextActions: readonly NextAction[];
  readonly data?: unknown;
}

interface ResultInput {
  readonly state: ResultState;
  readonly changed?: boolean;
  readonly findings?: readonly Finding[];
  readonly effects?: Partial<Effects>;
  readonly errors?: readonly ResultError[];
  readonly recovery?: readonly RecoveryAction[];
  readonly nextActions?: readonly NextAction[];
  readonly data?: unknown;
}

const EMPTY_EFFECTS: Effects = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: [],
};

export function createResult(input: ResultInput): CliResult {
  return {
    schemaVersion: 1,
    ok: input.state !== 'failed',
    state: input.state,
    changed: input.changed ?? input.state === 'changed',
    findings: input.findings ?? [],
    effects: { ...EMPTY_EFFECTS, ...input.effects },
    errors: input.errors ?? [],
    recovery: input.recovery ?? [],
    nextActions: input.nextActions ?? [],
    ...(input.data !== undefined && { data: input.data }),
  };
}

export function withDeprecation(result: CliResult, legacy: string, replacement: string): CliResult {
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_ALIAS_DEPRECATED',
        message: `\`${legacy}\` is deprecated; use \`${replacement}\`.`,
        severity: 'warning',
        metadata: {
          replacement,
          introduced_in: '0.70',
          retained_through: '0.71',
          removal_eligible_after: '0.71',
        },
      },
    ],
  };
}

export function exitStatusFor(result: CliResult): 0 | 1 | 2 {
  if (result.state === 'failed') return 1;
  if (result.state === 'action_required') return 2;
  return 0;
}

function toWireResult(result: CliResult): Record<string, unknown> {
  return {
    schema_version: result.schemaVersion,
    ok: result.ok,
    state: result.state,
    changed: result.changed,
    findings: result.findings.map(({ code, message, severity, metadata }) => ({
      code,
      message,
      severity,
      ...(metadata !== undefined && { metadata }),
    })),
    effects: result.effects,
    errors: result.errors.map(({ code, message, retryable }) => ({
      code,
      message,
      retryable,
    })),
    recovery: result.recovery.map(({ command, description, requiresHuman }) => ({
      command,
      description,
      requires_human: requiresHuman,
    })),
    next_actions: result.nextActions.map(({ command, mutates, requiresHuman }) => ({
      command,
      mutates,
      requires_human: requiresHuman,
    })),
    ...(result.data !== undefined && { data: result.data }),
  };
}

export function renderJsonResult(result: CliResult): string {
  return JSON.stringify(toWireResult(result));
}

const VERDICTS: Readonly<Record<ResultState, string>> = {
  healthy: 'Healthy',
  changed: 'Complete',
  action_required: 'Needs attention',
  failed: 'Failed',
};

function uniqueMessages(result: CliResult): string[] {
  const messages = result.findings.map(finding => finding.message);
  messages.push(...result.errors.map(error => error.message));
  return [...new Set(messages)];
}

function suppressHumanOutput(result: CliResult, options: { quiet?: boolean }): boolean {
  return options.quiet === true && result.state === 'healthy';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function effectLines(category: string, effects: unknown): string[] {
  if (!Array.isArray(effects)) return [];
  return effects.flatMap(effect =>
    isRecord(effect) && typeof effect.kind === 'string' && typeof effect.target === 'string'
      ? [`${category}: ${effect.kind} ${effect.target}`]
      : [],
  );
}

function plannedEffectLines(data: unknown): string[] {
  if (!isRecord(data) || !isRecord(data.plan) || !isRecord(data.plan.effects)) return [];
  const categories = ['files', 'packages', 'configuration', 'network', 'destructive'];
  const lines = categories.flatMap(category => effectLines(category, data.plan.effects[category]));
  return lines.length === 0 ? [] : ['Planned effects:', ...lines];
}

export function renderHumanResult(
  result: CliResult,
  options: { quiet?: boolean; verbose?: boolean } = {},
): string {
  if (suppressHumanOutput(result, options)) return '';

  const lines = [
    VERDICTS[result.state],
    `Changed: ${result.changed ? 'yes' : 'no'}`,
    ...uniqueMessages(result),
    ...plannedEffectLines(result.data),
  ];

  if (options.verbose === true) {
    const details = [
      ...result.findings.map(finding => finding.detail),
      ...result.errors.map(error => error.detail),
    ].filter((detail): detail is string => detail !== undefined);
    lines.push(...details);
  }

  const primaryAction = result.nextActions[0];
  if (primaryAction !== undefined) lines.push(`Next: ${primaryAction.command}`);
  return lines.join('\n');
}
