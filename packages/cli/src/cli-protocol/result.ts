import { reviewResultLines } from './review-presentation.js';

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

interface CommandNextAction {
  readonly command: string;
  readonly mutates: boolean;
  readonly requiresHuman: boolean;
}

interface HumanNextAction {
  readonly kind: 'human';
  readonly instruction: string;
  readonly mutates: false;
  readonly requiresHuman: true;
}

export type NextAction = CommandNextAction | HumanNextAction;

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
  /** Process status for commands that must preserve a delegated program's exit. */
  readonly exitCode?: number;
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
  readonly exitCode?: number;
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

export function combineEffects(groups: readonly Partial<Effects>[]): Effects {
  return {
    files: groups.flatMap(effects => effects.files ?? []),
    packages: groups.flatMap(effects => effects.packages ?? []),
    configuration: groups.flatMap(effects => effects.configuration ?? []),
    network: groups.flatMap(effects => effects.network ?? []),
    destructive: groups.flatMap(effects => effects.destructive ?? []),
  };
}

/** Aggregate state precedence shared by commands that combine several results. */
export function combinedResultState(results: readonly CliResult[]): CliResult['state'] {
  if (results.some(result => result.state === 'failed')) return 'failed';
  if (results.some(result => result.state === 'action_required')) return 'action_required';
  if (results.some(result => result.state === 'changed')) return 'changed';
  return 'healthy';
}

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
    ...(input.exitCode !== undefined && { exitCode: input.exitCode }),
    ...(input.presentation !== undefined && { presentation: input.presentation }),
    ...(input.data !== undefined && { data: input.data }),
  };
}

/** A rejected operand: the command ran but its argument was not usable. */
export function invalidOperand(command: string, message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLI_ARGUMENT_INVALID', message, retryable: false }],
    data: { command },
  });
}

export function withDeprecation(
  result: CliResult,
  legacy: string,
  replacement: string,
  compatibility: {
    readonly introducedIn: string;
    readonly retention: 'indefinite';
    readonly redundantOptions?: readonly {
      readonly key: string;
      readonly flag: string;
      readonly replacement: string;
    }[];
  },
  options: Readonly<Record<string, unknown>> = {},
): CliResult {
  const redundantOptionFindings: Finding[] = (compatibility.redundantOptions ?? [])
    .filter(option => options[option.key] === true)
    .map(option => ({
      code: 'CLI_OPTION_REDUNDANT',
      message: `\`${option.flag}\` is accepted for compatibility but has no effect; use \`${option.replacement}\`.`,
      severity: 'warning',
      metadata: {
        option: option.flag,
        replacement: option.replacement,
        retention: compatibility.retention,
      },
    }));
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
      ...redundantOptionFindings,
    ],
  };
}

export function exitStatusFor(result: CliResult): number {
  if (result.exitCode !== undefined) return result.exitCode;
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
    next_actions: result.nextActions.map(action =>
      'command' in action
        ? {
            command: action.command,
            mutates: action.mutates,
            requires_human: action.requiresHuman,
          }
        : {
            kind: action.kind,
            instruction: action.instruction,
            mutates: action.mutates,
            requires_human: action.requiresHuman,
          },
    ),
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

function nextActionLabel(action: NextAction): string {
  return 'command' in action ? action.command : action.instruction;
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

const SURFACE_LABELS: Readonly<Record<string, string>> = {
  project: 'Project',
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
};

const SURFACE_OUTCOMES: Readonly<Record<string, string>> = {
  healthy: 'ready',
  changed: 'updated',
  action_required: 'needs attention',
  failed: 'failed',
};

/** Labelled surfaces of a `command`-tagged result payload, or [] when it is not that command. */
function labelledSurfaces(
  data: unknown,
  command: string,
): { readonly label: string; readonly surface: Record<string, unknown> }[] {
  if (!isRecord(data) || data.command !== command || !Array.isArray(data.surfaces)) return [];
  return data.surfaces.flatMap(surface => {
    if (!isRecord(surface) || typeof surface.name !== 'string') return [];
    const label = SURFACE_LABELS[surface.name];
    return label === undefined ? [] : [{ label, surface }];
  });
}

function installSurfaceLines(data: unknown): string[] {
  return labelledSurfaces(data, 'install').flatMap(({ label, surface }) => {
    if (surface.selected === false) return [`${label}: not selected`];
    const outcome = typeof surface.state === 'string' ? SURFACE_OUTCOMES[surface.state] : undefined;
    return outcome === undefined ? [] : [`${label}: ${outcome}`];
  });
}

function installActivationLines(data: unknown): string[] {
  return labelledSurfaces(data, 'install').flatMap(({ label, surface }) => {
    if (!Array.isArray(surface.activation_actions)) return [];
    return surface.activation_actions.flatMap(action =>
      typeof action === 'string' ? [`${label} activation: ${action}`] : [],
    );
  });
}

function doctorDiagnosticCauses(data: unknown): ReadonlySet<string> {
  if (!isRecord(data) || data.command !== 'doctor' || !Array.isArray(data.diagnostics)) {
    return new Set();
  }
  return new Set(
    data.diagnostics.flatMap(diagnostic =>
      isRecord(diagnostic) && typeof diagnostic.cause === 'string' ? [diagnostic.cause] : [],
    ),
  );
}

function doctorDiagnosticLines(data: unknown): string[] {
  if (!isRecord(data) || data.command !== 'doctor' || !Array.isArray(data.coverage)) return [];

  const coverage = data.coverage.flatMap(item => {
    if (!isRecord(item) || typeof item.surface !== 'string') return [];
    const label = SURFACE_LABELS[item.surface] ?? item.surface;
    const outcome = typeof item.state === 'string' ? SURFACE_OUTCOMES[item.state] : undefined;
    const evidence = isRecord(item.evidence)
      ? Object.entries(item.evidence)
          .filter((entry): entry is [string, string | number | boolean] =>
            ['string', 'number', 'boolean'].includes(typeof entry[1]),
          )
          .map(([key, value]) => `${key.replaceAll('_', ' ')}=${String(value)}`)
      : [];
    const evidenceSuffix = evidence.length === 0 ? '' : ` (${evidence.join(', ')})`;
    return [`- ${label}: ${outcome ?? 'unknown'}${evidenceSuffix}`];
  });
  const diagnostics = Array.isArray(data.diagnostics)
    ? data.diagnostics.flatMap(item => {
        if (
          !isRecord(item) ||
          typeof item.surface !== 'string' ||
          typeof item.code !== 'string' ||
          typeof item.cause !== 'string'
        ) {
          return [];
        }
        const label = SURFACE_LABELS[item.surface] ?? item.surface;
        return [`- ${label} [${item.code}]: ${item.cause}`];
      })
    : [];

  return [
    ...(coverage.length === 0 ? [] : ['Diagnostic coverage:', ...coverage]),
    ...(diagnostics.length === 0 ? [] : ['Causes:', ...diagnostics]),
  ];
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

function resultBodyLines(result: CliResult, options: { verbose?: boolean }): string[] {
  const reviewLines = reviewResultLines(result, options);
  if (reviewLines !== undefined) return reviewLines;
  const diagnosticCauses = doctorDiagnosticCauses(result.data);
  const messages = uniqueMessages(result).filter(message => !diagnosticCauses.has(message));
  const lines = [
    VERDICTS[result.state],
    `Changed: ${result.changed ? 'yes' : 'no'}`,
    ...installSurfaceLines(result.data),
    ...installActivationLines(result.data),
    ...doctorDiagnosticLines(result.data),
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
  return lines;
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

  const lines = resultBodyLines(result, options);

  const primaryAction = result.nextActions[0];
  if (primaryAction !== undefined) lines.push(`Next: ${nextActionLabel(primaryAction)}`);
  const body = lines.join('\n');
  return result.state === 'failed' ? { stdout: '', stderr: body } : { stdout: body, stderr: '' };
}
