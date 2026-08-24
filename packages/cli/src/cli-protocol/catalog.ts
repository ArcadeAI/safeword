import { AGENT_SELECTION_DESCRIPTION } from './agent-selection.js';
import type { CommandHandler } from './handler.js';
import { publicHandler } from './public-handlers.js';
import { type CliResult, createResult } from './result.js';

type EffectClass = 'observe' | 'plan' | 'mutate' | 'destructive' | 'hook';
type PromptPolicy = 'never' | 'confirm';
type NetworkPolicy = 'never' | 'declared';

interface Compatibility {
  readonly introducedIn: string;
  readonly retention: 'indefinite';
  readonly replacement?: string;
  readonly redundantOptions?: readonly {
    readonly key: string;
    readonly flag: string;
    readonly replacement: string;
  }[];
}

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly classification: InvocationClassification;
  readonly visibility: InvocationVisibility;
  readonly effectClass: EffectClass;
  readonly promptPolicy: PromptPolicy;
  readonly networkPolicy: NetworkPolicy;
  readonly schemaVersions: readonly [1];
  readonly exitPolicy?: {
    readonly actionRequiredAsSuccessOption: string;
  };
  readonly fixture: {
    readonly argv: readonly string[];
    readonly environment: Readonly<Record<string, string>>;
  };
  readonly handler: CommandHandler;
  readonly registration: {
    readonly syntax: string;
    readonly options: readonly {
      readonly flags: string;
      readonly description: string;
      readonly defaultValue?: string;
      readonly valueKind?: 'claude-plugin-scope' | 'execution-mode-list' | 'plan-identity';
      readonly compatibilityReplacement?: string;
      readonly hidden?: boolean;
    }[];
  };
  readonly aliasFor?: string;
  readonly compatibility?: Compatibility;
}

const MACHINE_ENVIRONMENT = { SAFEWORD_NO_UPDATE_CHECK: '1' } as const;
const RETAINED_ALIAS: Compatibility = {
  introducedIn: '0.70',
  retention: 'indefinite',
};

function command(
  name: string,
  description: string,
  effectClass: EffectClass,
  options: Partial<
    Pick<CommandDefinition, 'promptPolicy' | 'networkPolicy' | 'fixture'> & {
      syntax: string;
      commandOptions: CommandDefinition['registration']['options'];
      handler: CommandHandler;
      exitPolicy: NonNullable<CommandDefinition['exitPolicy']>;
    }
  > = {},
): CommandDefinition {
  return {
    name,
    description,
    classification: 'public',
    visibility: 'public',
    effectClass,
    promptPolicy: options.promptPolicy ?? 'never',
    networkPolicy: options.networkPolicy ?? 'never',
    schemaVersions: [1],
    ...(options.exitPolicy !== undefined && { exitPolicy: options.exitPolicy }),
    handler: options.handler ?? publicHandler(name),
    registration: {
      syntax: options.syntax ?? name.split(' ').at(-1) ?? name,
      options: options.commandOptions ?? [],
    },
    fixture: options.fixture ?? {
      argv: name.split(' '),
      environment: MACHINE_ENVIRONMENT,
    },
  };
}

function alias(name: string, aliasFor: string): CommandDefinition {
  const canonical = canonicalDefinition(aliasFor);
  return {
    ...command(name, `Deprecated alias for ${aliasFor}`, canonical.effectClass, {
      promptPolicy: canonical.promptPolicy,
      networkPolicy: canonical.networkPolicy,
      commandOptions: canonical.registration.options,
      handler: canonical.handler,
    }),
    aliasFor,
    classification: 'retained-alias',
    visibility: 'hidden',
    compatibility: RETAINED_ALIAS,
  };
}

function scopedInstallAlias(name: string, agent: 'claude' | 'codex'): CommandDefinition {
  const canonical = canonicalDefinition('install');
  return {
    ...command(name, `Deprecated alias for install --agents=${agent}`, canonical.effectClass, {
      promptPolicy: canonical.promptPolicy,
      networkPolicy: canonical.networkPolicy,
      commandOptions: agent === 'claude' ? [claudeScopeOption()] : [],
      // The retained spelling keeps its shipped safety guarantee: profile-only
      // installation that leaves the repository untouched (main's Rule
      // codex-plugin-install.TBU1.R2). `install --agents=<agent>` is the
      // canonical route that also reconciles project configuration.
      handler: publicHandler(name),
    }),
    aliasFor: 'install',
    classification: 'retained-alias',
    visibility: 'hidden',
    compatibility: {
      ...RETAINED_ALIAS,
      replacement: `install --agents=${agent}`,
    },
  };
}

function hidden(
  name: string,
  options: {
    readonly syntax?: string;
    readonly commandOptions?: CommandDefinition['registration']['options'];
  } = {},
): CommandDefinition {
  return {
    ...command(name, 'Internal Safeword helper', 'hook', options),
    classification: 'internal',
    visibility: 'hidden',
  };
}

function agentSelectionOption(): CommandDefinition['registration']['options'][number] {
  return { flags: '--agents <agents>', description: AGENT_SELECTION_DESCRIPTION };
}

function claudeScopeOption(): CommandDefinition['registration']['options'][number] {
  return {
    flags: '--scope <scope>',
    description: 'Claude activation boundary: this project or the current user profile',
    defaultValue: 'project',
    valueKind: 'claude-plugin-scope',
  };
}

const CANONICAL_COMMANDS: readonly CommandDefinition[] = [
  command('status', 'Report project health and the next action', 'observe', {
    commandOptions: [agentSelectionOption()],
  }),
  command('install', 'Install Safeword for this project and selected agents', 'mutate', {
    networkPolicy: 'declared',
    fixture: { argv: ['install', '--offline'], environment: MACHINE_ENVIRONMENT },
    commandOptions: [
      agentSelectionOption(),
      claudeScopeOption(),
      { flags: '--no-modify', description: 'Do not edit the project ESLint configuration' },
      {
        flags: '--migrate-namespace',
        description: 'Move the legacy project namespace to .project',
      },
      { flags: '--no-migrate-namespace', description: 'Keep the legacy project namespace' },
      {
        flags: '--repair-version-marker',
        description: 'Replace an unreadable project version marker',
      },
    ],
  }),
  command('plan', 'Preview reconciliation effects', 'plan', {
    syntax: 'plan [operation]',
    commandOptions: [
      agentSelectionOption(),
      claudeScopeOption(),
      { flags: '--no-modify', description: 'Do not plan an ESLint configuration edit' },
      {
        flags: '--migrate-namespace',
        description: 'Plan moving the legacy project namespace to .project',
      },
      { flags: '--no-migrate-namespace', description: 'Keep the legacy project namespace' },
      {
        flags: '--repair-version-marker',
        description: 'Plan replacement of an unreadable project version marker',
      },
    ],
  }),
  command('doctor', 'Diagnose project configuration', 'observe', {
    commandOptions: [agentSelectionOption()],
  }),
  command(
    'uninstall',
    'Deactivate selected Safeword project and agent state; preserve authored content; reinstall to recover',
    'destructive',
    {
      promptPolicy: 'confirm',
      networkPolicy: 'declared',
      fixture: { argv: ['uninstall', '--offline'], environment: MACHINE_ENVIRONMENT },
      commandOptions: [
        agentSelectionOption(),
        claudeScopeOption(),
        { flags: '-y, --yes', description: 'Confirm the supplied plan identity' },
        {
          flags: '--plan <id>',
          description: 'Identity of the exact plan being confirmed',
          valueKind: 'plan-identity',
        },
        {
          flags: '--full',
          description: 'Also remove unmodified tooling configuration and supporting packages',
        },
      ],
    },
  ),
  command('project sync-config', 'Regenerate dependency-cruiser configuration', 'mutate', {
    commandOptions: [{ flags: '--check', description: 'Report drift without writing' }],
  }),
  command('project architecture', 'Refresh generated architecture state', 'mutate', {
    commandOptions: [
      { flags: '--check', description: 'Report drift without writing' },
      { flags: '--from-index', description: 'Generate from the staged Git index' },
      { flags: '--stage-output', description: 'Stage generated architecture documents' },
      {
        flags: '--stage',
        description: 'Deprecated alias for --from-index --stage-output',
        compatibilityReplacement: '--from-index --stage-output',
      },
      {
        flags: '--staged',
        description: 'Deprecated alias for --from-index',
        compatibilityReplacement: '--from-index',
      },
    ],
  }),
  command('project sync-learnings', 'Refresh the project learning index', 'mutate'),
  command('project sync-tickets', 'Refresh project ticket indexes', 'mutate'),
  command('project codify', 'Generate a test skeleton from ticket behavior', 'mutate', {
    syntax: 'codify <ticket>',
    commandOptions: [
      {
        flags: '--format <format>',
        description: 'Output format: vitest or gherkin',
        defaultValue: 'vitest',
      },
      { flags: '--red', description: 'Emit failing test bodies' },
      { flags: '--out <path>', description: 'Write to a new file' },
    ],
    fixture: {
      argv: ['project', 'codify', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('project test-plan', 'Describe repository test commands', 'observe', {
    syntax: 'test-plan [dir]',
    commandOptions: [
      {
        flags: '--kind <kind>',
        description: 'test, build, verify, typecheck, deps, or bdd',
        defaultValue: 'test',
      },
      {
        flags: '--format <format>',
        description: 'human, sh, or legacy raw json; use global --json for machine output',
        defaultValue: 'human',
      },
    ],
  }),
  command('project test', 'Run repository test commands', 'mutate', {
    networkPolicy: 'declared',
    fixture: { argv: ['project', 'test', '--offline'], environment: MACHINE_ENVIRONMENT },
    syntax: 'test',
    commandOptions: [
      {
        flags: '--lane <lane>',
        description: 'done or full',
        defaultValue: 'done',
      },
      {
        flags: '--execution <mode>',
        description: 'local or remote-preferred',
        valueKind: 'execution-mode-list',
      },
      {
        flags: '--prepare-remote',
        description: 'Run the project remote-test setup command before tests',
      },
    ],
  }),
  command(
    'project test-execution status',
    'Show the effective test execution preference',
    'observe',
    {
      syntax: 'status',
    },
  ),
  command(
    'project test-execution remote status',
    'Show managed remote-test workflow status',
    'observe',
    { syntax: 'status' },
  ),
  command(
    'project test-execution remote setup',
    'Install the managed remote-test workflow',
    'mutate',
    { syntax: 'setup' },
  ),
  command(
    'project test-execution remote disable',
    'Remove the managed remote-test workflow',
    'mutate',
    { syntax: 'disable' },
  ),
  command('project lint-gherkin', 'Validate executable feature files', 'observe', {
    syntax: 'lint-gherkin [files...]',
  }),
  command('project retro-drain', 'Drain acknowledged retro drafts from a spool', 'mutate', {
    syntax: 'retro-drain <spool>',
    commandOptions: [
      {
        flags: '--validated-jsonl',
        description: 'Emit the spool as validated JSONL instead of draining it',
      },
    ],
    fixture: {
      argv: ['project', 'retro-drain', '.safeword/retro-drafts/fixture.jsonl'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command(
    'project review-knowledge',
    'Resolve the principles, personas, and surfaces sources for a review',
    'observe',
    { syntax: 'review-knowledge' },
  ),
  command(
    'project public-retros',
    'Turn silent public retrospective collection on or off',
    'mutate',
    {
      syntax: 'public-retros <state>',
    },
  ),
  command(
    'project namespace-root',
    'Print the resolved project-knowledge namespace root',
    'observe',
    {
      syntax: 'namespace-root',
      commandOptions: [
        {
          flags: '--key <key>',
          description:
            'A configured project-knowledge path: principles, personas, glossary, surfaces, or architecture',
        },
      ],
    },
  ),
  command('tracker sync', 'Synchronize tickets with the configured tracker', 'mutate', {
    networkPolicy: 'declared',
    fixture: { argv: ['tracker', 'sync', '--offline'], environment: MACHINE_ENVIRONMENT },
    commandOptions: [
      { flags: '--reset-tracker-map', description: 'Rebuild the tracker map' },
      { flags: '--plan', description: 'Compute an offline tracker plan' },
      { flags: '--apply-results <file>', description: 'Apply executor results offline' },
    ],
  }),
  command('tracker connect', 'Connect a project to a tracker', 'mutate', {
    promptPolicy: 'confirm',
    networkPolicy: 'declared',
    syntax: 'connect <provider>',
    commandOptions: [
      { flags: '--repo <owner/name>', description: 'GitHub target repository' },
      { flags: '--team <team>', description: 'Linear target team' },
      { flags: '--workspace <workspace>', description: 'Linear target workspace' },
    ],
    fixture: {
      argv: ['tracker', 'connect', 'github'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command(
    'codex migrate',
    'Deactivate proven legacy Codex hooks after creating a recovery backup',
    'destructive',
    {
      promptPolicy: 'confirm',
      networkPolicy: 'declared',
      commandOptions: [
        { flags: '--finalize', description: 'Finalize after current plugin-hook proof exists' },
        { flags: '--yes', description: 'Confirm the observed migration plan' },
        {
          flags: '--plan <id>',
          description: 'Identity of the exact migration plan',
          valueKind: 'plan-identity',
        },
        {
          flags: '--remove-legacy-hooks',
          description: 'Deprecated alias for --finalize',
          compatibilityReplacement: '--finalize',
        },
      ],
    },
  ),
  command('codex bootstrap', 'Keep the project Codex plugin available', 'mutate', {
    networkPolicy: 'declared',
    fixture: { argv: ['codex', 'bootstrap', '--offline'], environment: MACHINE_ENVIRONMENT },
  }),
  command('codex status', 'Report Codex plugin and migration state', 'observe'),
  command('claude status', 'Report Claude plugin and migration state', 'observe'),
  command(
    'claude cleanup',
    'Deactivate verified legacy Claude assets while preserving a recoverable backup',
    'destructive',
    {
      promptPolicy: 'confirm',
      commandOptions: [
        { flags: '--yes', description: 'Confirm cleanup of the observed exact revision' },
        {
          flags: '--plan <id>',
          description: 'Identity of the exact cleanup plan',
          valueKind: 'plan-identity',
        },
      ],
    },
  ),
  command(
    'claude recover',
    'Restore recognized Claude state from its cleanup backup without replacing unrelated content',
    'mutate',
  ),
  command(
    'codex clean-guidance',
    'Deactivate exact legacy Safeword profile guidance, preserve unrelated content, and retain a recovery backup',
    'destructive',
    {
      promptPolicy: 'confirm',
      commandOptions: [
        { flags: '--yes', description: 'Confirm cleanup of the observed exact revision' },
        {
          flags: '--plan <id>',
          description: 'Identity of the exact profile-guidance cleanup plan',
          valueKind: 'plan-identity',
        },
      ],
    },
  ),
  command(
    'codex recover',
    'Restore backed-up legacy Codex state without replacing unrelated current content',
    'destructive',
    {
      promptPolicy: 'confirm',
      commandOptions: [
        { flags: '--yes', description: 'Confirm recovery of the observed backup' },
        {
          flags: '--plan <id>',
          description: 'Identity of the exact recovery plan',
          valueKind: 'plan-identity',
        },
      ],
    },
  ),
  command('ticket list', 'List project tickets', 'observe'),
  command('ticket new', 'Create a project ticket', 'mutate', {
    networkPolicy: 'declared',
    syntax: 'new <slug>',
    commandOptions: [
      {
        flags: '--type <type>',
        description: 'patch, task, feature, or epic',
        defaultValue: 'task',
      },
      { flags: '--title <title>', description: 'Ticket title' },
      { flags: '--goal <goal>', description: 'One-line goal' },
      { flags: '--why <why>', description: 'One-line rationale' },
      { flags: '--parent <epicId>', description: 'Link the ticket to an epic' },
      { flags: '--issue <key>', description: 'Adopt an existing tracker issue key' },
    ],
    fixture: {
      argv: ['ticket', 'new', 'machine-fixture', '--type', 'task'],
      environment: {
        ...MACHINE_ENVIRONMENT,
        SAFEWORD_TICKET_ID_OVERRIDE: 'N80D28',
      },
    },
  }),
  command('review run', 'Run an independent adversarial review', 'mutate', {
    networkPolicy: 'declared',
    syntax: 'run <kind> <targets...>',
    commandOptions: [
      {
        flags: '--context <paths...>',
        description: 'Bounded supporting evidence that is not work under review',
      },
      {
        flags: '--agent-handoff',
        description: 'Treat action-required output as a successful author-agent handoff',
      },
      {
        flags: '--worker-job-id <id>',
        description: 'Internal detached-worker identity',
      },
    ],
    exitPolicy: { actionRequiredAsSuccessOption: 'agentHandoff' },
    fixture: {
      argv: ['review', 'run', 'quality-review', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('review status', 'Collect a durable independent review', 'mutate', {
    syntax: 'status [review-id]',
    fixture: {
      argv: ['review', 'status'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('review cancel', 'Cancel a durable independent review', 'mutate', {
    syntax: 'cancel [review-id]',
    fixture: {
      argv: ['review', 'cancel'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command(
    'review-pr inspect',
    'Inspect bounded pull-request evidence as untrusted data',
    'mutate',
    {
      networkPolicy: 'declared',
      syntax: 'inspect <input>',
      commandOptions: [
        { flags: '--output <path>', description: 'Write the validated advisory result artifact' },
      ],
      fixture: {
        argv: ['review-pr', 'inspect', 'fixture', '--output', 'fixture-output'],
        environment: MACHINE_ENVIRONMENT,
      },
    },
  ),
  command('review-pr invalidate', 'Remove an obsolete advisory route', 'mutate', {
    networkPolicy: 'declared',
    fixture: { argv: ['review-pr', 'invalidate', '--offline'], environment: MACHINE_ENVIRONMENT },
  }),
  command('review-pr publish', 'Publish a validated advisory result', 'mutate', {
    networkPolicy: 'declared',
    syntax: 'publish <result>',
    fixture: {
      argv: ['review-pr', 'publish', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('retro run', 'Extract and file session findings', 'mutate', {
    networkPolicy: 'declared',
    commandOptions: [
      { flags: '--transcript <path>', description: 'Session transcript path' },
      { flags: '--findings <path>', description: 'Agent-produced findings JSON' },
      { flags: '--auto-extract', description: 'Extract findings with a headless agent' },
      { flags: '--public-retro', description: 'Attempt eligible public quarantine delivery' },
      { flags: '--window-start <chars>', description: 'Transcript delta offset' },
      { flags: '--session-id <id>', description: 'Stable session identifier' },
    ],
    fixture: {
      argv: ['retro', 'run', '--transcript', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('retro signals', 'Inspect locally captured runtime signals', 'observe', {
    commandOptions: [
      {
        flags: '--format <format>',
        description: 'human, issue, or legacy raw json; use global --json for machine output',
        defaultValue: 'human',
      },
    ],
  }),
  command('retro reconcile', 'Reconcile open retro findings', 'mutate', {
    networkPolicy: 'declared',
  }),
  command(
    'retro-relay-retry',
    'List durable relay requests or rearm one dead letter without changing its identity',
    'mutate',
    {
      networkPolicy: 'declared',
      syntax: 'retro-relay-retry [request-id]',
    },
  ),
  command(
    'retro-relay-discard',
    'Permanently discard one poisoned relay identity and its source reservation',
    'destructive',
    {
      promptPolicy: 'confirm',
      syntax: 'retro-relay-discard <request-id>',
      commandOptions: [
        {
          flags: '--confirm',
          description: 'Confirm irreversible deletion of this exact request identity',
        },
      ],
      fixture: {
        argv: ['retro-relay-discard', '00000000-0000-4000-8000-000000000001'],
        environment: MACHINE_ENVIRONMENT,
      },
    },
  ),
  command('capabilities', 'Describe the public machine interface', 'observe', {
    handler: () => Promise.resolve(createCapabilitiesResult()),
  }),
];

function canonicalDefinition(name: string): CommandDefinition {
  const definition = CANONICAL_COMMANDS.find(candidate => candidate.name === name);
  if (definition === undefined) throw new Error(`Missing canonical command: ${name}`);
  return definition;
}

function canonicalOptions(name: string): CommandDefinition['registration']['options'] {
  const definition = canonicalDefinition(name);
  return definition.registration.options;
}

function projectOnlyUninstallAlias(name: 'remove' | 'reset'): CommandDefinition {
  return {
    ...alias(name, 'uninstall'),
    handler: publicHandler('remove'),
    compatibility: { ...RETAINED_ALIAS, replacement: 'uninstall --agents=none' },
    registration: {
      syntax: name,
      options: canonicalOptions('uninstall').filter(
        option => !option.flags.includes('--agents') && !option.flags.includes('--scope'),
      ),
    },
  };
}

const ALIASES: readonly CommandDefinition[] = [
  alias('check', 'status'),
  scopedInstallAlias('claude install', 'claude'),
  scopedInstallAlias('codex install', 'codex'),
  {
    ...alias('setup', 'install'),
    compatibility: {
      introducedIn: '0.72',
      retention: 'indefinite',
      redundantOptions: [{ key: 'yes', flag: '--yes', replacement: 'install' }],
    },
    registration: {
      syntax: 'setup',
      options: [
        ...canonicalOptions('install'),
        { flags: '-y, --yes', description: 'Retained redundant compatibility option' },
      ],
    },
  },
  alias('upgrade', 'install'),
  {
    ...alias('diff', 'plan'),
    registration: { syntax: 'diff [operation]', options: canonicalOptions('plan') },
  },
  projectOnlyUninstallAlias('remove'),
  projectOnlyUninstallAlias('reset'),
  alias('sync-config', 'project sync-config'),
  alias('architecture', 'project architecture'),
  alias('sync-learnings', 'project sync-learnings'),
  alias('sync-tickets', 'project sync-tickets'),
  {
    ...alias('codify', 'project codify'),
    registration: {
      syntax: 'codify <ticket>',
      options: canonicalOptions('project codify'),
    },
    fixture: {
      argv: ['codify', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  },
  {
    ...alias('test-plan', 'project test-plan'),
    registration: {
      syntax: 'test-plan [dir]',
      options: canonicalOptions('project test-plan'),
    },
  },
  {
    ...alias('lint-gherkin', 'project lint-gherkin'),
    registration: {
      syntax: 'lint-gherkin [files...]',
      options: [],
    },
  },
  alias('sync-tracker', 'tracker sync'),
  {
    ...alias('connect', 'tracker connect'),
    registration: {
      syntax: 'connect <provider>',
      options: canonicalOptions('tracker connect'),
    },
    fixture: {
      argv: ['connect', 'github'],
      environment: MACHINE_ENVIRONMENT,
    },
  },
  alias('self-report', 'retro signals'),
  {
    ...alias('retro', 'retro run'),
    fixture: {
      argv: ['retro', '--transcript', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  },
  alias('retro-reconcile', 'retro reconcile'),
  {
    ...alias('migrate codex-plugin', 'codex migrate'),
    fixture: {
      argv: ['migrate', 'codex-plugin', '--offline'],
      environment: MACHINE_ENVIRONMENT,
    },
  },
];

const HIDDEN_COMMANDS: readonly CommandDefinition[] = [
  hidden('boundary', {
    commandOptions: [{ flags: '--at <boundary>', description: 'which boundary: commit | push' }],
  }),
  hidden('hook codex', {
    syntax: 'codex <event>',
    commandOptions: [{ flags: '--plugin-hook', description: '', hidden: true }],
  }),
  hidden('codex-hook', { syntax: 'codex-hook <event>' }),
  hidden('feature-directories'),
];

export const commandCatalog: readonly CommandDefinition[] = [
  ...CANONICAL_COMMANDS,
  ...ALIASES,
  ...HIDDEN_COMMANDS,
];

type InvocationClassification = 'public' | 'retained-alias' | 'internal';
type InvocationVisibility = 'public' | 'hidden';
type InvocationKind = 'command' | 'family' | 'default' | 'argv-rewrite';

export interface InvocationContract {
  readonly route: string;
  readonly kind: InvocationKind;
  readonly classification: InvocationClassification;
  readonly visibility: InvocationVisibility;
  readonly command?: CommandDefinition;
  readonly target?: string;
  readonly fixture?: CommandDefinition['fixture'];
}

export const publicCommands = commandCatalog.filter(
  definition => definition.classification !== 'internal',
);

export const commandFamilies = [
  { route: 'project', description: 'Manage project-local Safeword state', visibility: 'public' },
  {
    route: 'project test-execution',
    description: 'Manage test execution preferences',
    visibility: 'public',
  },
  {
    route: 'project test-execution remote',
    description: 'Manage remote test execution',
    visibility: 'public',
  },
  {
    route: 'tracker',
    description: 'Manage tracker connections and synchronization',
    visibility: 'public',
  },
  { route: 'codex', description: 'Manage the Safeword Codex plugin', visibility: 'public' },
  { route: 'claude', description: 'Manage the Safeword Claude plugin', visibility: 'public' },
  { route: 'ticket', description: 'Manage project tickets', visibility: 'public' },
  { route: 'review', description: 'Run independent adversarial reviews', visibility: 'public' },
  {
    route: 'review-pr',
    description: 'Inspect and publish pull request reviews',
    visibility: 'public',
  },
  {
    route: 'retro',
    description: 'Inspect and file Safeword runtime findings',
    visibility: 'public',
  },
  { route: 'migrate', description: 'Compatibility migration commands', visibility: 'hidden' },
  { route: 'hook', description: 'Run packaged Safeword hooks', visibility: 'hidden' },
] as const;

export interface CompatibilityRoute {
  readonly route: string;
  readonly replacement: string;
  readonly retention: 'indefinite';
}

export const compatibilityRoutes: readonly CompatibilityRoute[] = [
  { route: 'bare safeword', replacement: 'status', retention: 'indefinite' },
  ...ALIASES.map(definition => ({
    route: definition.name,
    replacement: definition.compatibility?.replacement ?? definition.aliasFor ?? '',
    retention: 'indefinite' as const,
  })),
  ...CANONICAL_COMMANDS.flatMap(definition =>
    definition.registration.options.flatMap(option =>
      option.compatibilityReplacement === undefined
        ? []
        : [
            {
              route: `${definition.name} ${option.flags}`,
              replacement: `${definition.name} ${option.compatibilityReplacement}`,
              retention: 'indefinite' as const,
            },
          ],
    ),
  ),
];

const commandNames = new Set(commandCatalog.map(definition => definition.name));

function familyClassification(family: (typeof commandFamilies)[number]): InvocationClassification {
  if (family.route === 'retro') return 'retained-alias';
  return family.visibility === 'hidden' ? 'internal' : 'public';
}

export const invocationCatalog: readonly InvocationContract[] = [
  ...commandCatalog
    .filter(definition => definition.name !== 'retro')
    .map(definition => ({
      route: definition.name,
      kind: 'command' as const,
      classification: definition.classification,
      visibility: definition.visibility,
      command: definition,
    })),
  ...commandFamilies.map(family => {
    const retained = family.route === 'retro' ? findCommandDefinition('retro') : undefined;
    return {
      route: family.route,
      kind: 'family' as const,
      classification: familyClassification(family),
      visibility: family.visibility,
      ...(retained !== undefined && { command: retained, target: 'retro run' }),
    };
  }),
  {
    route: 'bare safeword',
    kind: 'default',
    classification: 'retained-alias',
    visibility: 'hidden',
    target: 'status',
    fixture: { argv: [], environment: MACHINE_ENVIRONMENT },
  },
  ...compatibilityRoutes
    .filter(route => route.route !== 'bare safeword' && !commandNames.has(route.route))
    .map(route => ({
      route: route.route,
      kind: 'argv-rewrite' as const,
      classification: 'retained-alias' as const,
      visibility: 'hidden' as const,
      target: route.replacement,
      fixture: { argv: route.route.split(' '), environment: MACHINE_ENVIRONMENT },
    })),
];

export function findCommandDefinition(name: string): CommandDefinition {
  const definition = commandCatalog.find(candidate => candidate.name === name);
  if (definition === undefined) throw new Error(`Unknown CLI command definition: ${name}`);
  return definition;
}

function aliasesFor(name: string): string[] {
  return ALIASES.filter(definition => definition.aliasFor === name).map(
    definition => definition.name,
  );
}

function capability(definition: CommandDefinition): Record<string, unknown> {
  return {
    name: definition.name,
    aliases: aliasesFor(definition.name),
    ...(definition.aliasFor !== undefined && {
      alias_for: definition.compatibility?.replacement ?? definition.aliasFor,
    }),
    effect_class: definition.effectClass,
    prompt_policy: definition.promptPolicy,
    network_policy: definition.networkPolicy,
    schema_versions: definition.schemaVersions,
    fixture: definition.fixture,
    options: definition.registration.options.map(
      ({ flags, description, defaultValue, valueKind, compatibilityReplacement }) => ({
        flags,
        description,
        ...(defaultValue !== undefined && { default_value: defaultValue }),
        ...(valueKind !== undefined && { value_kind: valueKind }),
        ...(compatibilityReplacement !== undefined && {
          compatibility: {
            replacement: compatibilityReplacement,
            retention: 'indefinite',
          },
        }),
      }),
    ),
    ...(definition.compatibility !== undefined && {
      compatibility: {
        introduced_in: definition.compatibility.introducedIn,
        retention: definition.compatibility.retention,
        ...(definition.compatibility.replacement !== undefined && {
          replacement: definition.compatibility.replacement,
        }),
        ...(definition.compatibility.redundantOptions !== undefined && {
          redundant_options: definition.compatibility.redundantOptions.map(
            ({ flag, replacement }) => ({ flag, replacement }),
          ),
        }),
      },
    }),
  };
}

export function createCapabilitiesResult(): CliResult {
  return createResult({
    state: 'healthy',
    data: {
      machine_output: {
        canonical_option: '--json',
        schema_version: 1,
        description: 'One versioned result envelope on stdout.',
      },
      commands: publicCommands.map(definition => capability(definition)),
    },
  });
}
