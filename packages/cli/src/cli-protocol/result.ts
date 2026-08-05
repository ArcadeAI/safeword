type ResultState = 'healthy' | 'changed' | 'action_required' | 'failed';

export interface Finding {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface ResultError {
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

interface RecoveryAction {
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
  readonly presentation?: {
    readonly kind: 'raw';
    readonly body: string;
  };
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
  readonly presentation?: NonNullable<CliResult['presentation']>;
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
    ...(input.presentation !== undefined && { presentation: input.presentation }),
    ...(input.data !== undefined && { data: input.data }),
  };
}

export function withDeprecation(
  result: CliResult,
  legacy: string,
  replacement: string,
  compatibility: {
    readonly introducedIn: string;
    readonly retention: 'indefinite';
  },
): CliResult {
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
          introduced_in: compatibility.introducedIn,
          retention: compatibility.retention,
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
    findings: result.findings.map(({ code, message, severity, detail, metadata }) => ({
      code,
      message,
      severity,
      ...(detail !== undefined && { detail }),
      ...(metadata !== undefined && { metadata }),
    })),
    effects: result.effects,
    errors: result.errors.map(({ code, message, retryable, detail }) => ({
      code,
      message,
      retryable,
      ...(detail !== undefined && { detail }),
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
  if (!isRecord(data)) return [];
  const plan = data.plan;
  if (!isRecord(plan)) return [];
  const effects = plan.effects;
  if (!isRecord(effects)) return [];
  const categories = ['files', 'packages', 'configuration', 'network', 'destructive'];
  const lines = categories.flatMap(category => effectLines(category, effects[category]));
  return lines.length === 0 ? [] : ['Planned effects:', ...lines];
}

function reviewIndependenceLine(data: unknown): string | undefined {
  if (!isRecord(data) || data.command !== 'review run') return undefined;
  if (data.independence === 'cross-agent') return 'An independent agent checked the work.';
  if (data.independence === 'degraded') return 'The check ran, but it was not fully independent.';
  if (data.cross_agent_review === 'not_requested')
    return 'An independent agent check was not requested.';
  return 'The independent check did not run.';
}

function optionalLine(value: string | undefined): readonly string[] {
  return value === undefined ? [] : [value];
}

const EFFECT_LABELS: Readonly<Record<string, string>> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  install: 'Installed',
  uninstall: 'Uninstalled',
  remove: 'Removed',
  write: 'Written',
};

function completedEffectLines(result: CliResult): string[] {
  const visibleCategories = [
    result.effects.files,
    result.effects.packages,
    result.effects.configuration,
    result.effects.destructive,
  ];
  const lines = visibleCategories.flatMap(effects =>
    effects.map(effect => `${EFFECT_LABELS[effect.kind] ?? 'Changed'}: ${effect.target}`),
  );
  lines.push(
    ...result.effects.network.map(
      effect => `Network: ${effect.operation ?? effect.kind} ${effect.target}`,
    ),
  );
  return lines;
}

export function renderHumanResult(
  result: CliResult,
  options: { quiet?: boolean; verbose?: boolean } = {},
): string {
  const rendered = renderHumanStreams(result, options);
  return rendered.stdout || rendered.stderr;
}

export interface HumanResultStreams {
  readonly stdout: string;
  readonly stderr: string;
}

export function renderHumanStreams(
  result: CliResult,
  options: { quiet?: boolean; verbose?: boolean } = {},
): HumanResultStreams {
  if (result.presentation?.kind === 'raw') {
    return {
      stdout: result.presentation.body.replace(/\n$/, ''),
      stderr: options.quiet === true ? '' : uniqueMessages(result).join('\n'),
    };
  }
  if (suppressHumanOutput(result, options)) return { stdout: '', stderr: '' };

  const independenceLine = reviewIndependenceLine(result.data);
  const messages = uniqueMessages(result).filter(message => message !== independenceLine);
  const lines = [
    ...optionalLine(independenceLine),
    VERDICTS[result.state],
    `Changed: ${result.changed ? 'yes' : 'no'}`,
    ...messages,
    ...plannedEffectLines(result.data),
  ];

  if (options.verbose === true) {
    const details = [
      ...result.findings.map(finding => finding.detail),
      ...result.errors.map(error => error.detail),
    ].filter((detail): detail is string => detail !== undefined);
    lines.push(...completedEffectLines(result), ...details);
  }

  const primaryAction = result.nextActions[0];
  if (primaryAction !== undefined) lines.push(`Next: ${primaryAction.command}`);
  const body = lines.join('\n');
  return result.state === 'failed' ? { stdout: '', stderr: body } : { stdout: body, stderr: '' };
}
