import type { CommandHandler } from './handler.js';
import { publicHandler } from './public-handlers.js';
import { type CliResult, createResult } from './result.js';

type EffectClass = 'observe' | 'plan' | 'mutate' | 'destructive' | 'hook';
type PromptPolicy = 'never' | 'confirm';
type NetworkPolicy = 'never' | 'declared';

interface Compatibility {
  readonly introducedIn: string;
  readonly retainedThrough: string;
  readonly removalEligibleAfter: string;
}

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly public: boolean;
  readonly effectClass: EffectClass;
  readonly promptPolicy: PromptPolicy;
  readonly networkPolicy: NetworkPolicy;
  readonly schemaVersions: readonly [1];
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
    }[];
  };
  readonly aliasFor?: string;
  readonly compatibility?: Compatibility;
}

const MACHINE_ENVIRONMENT = { SAFEWORD_NO_UPDATE_CHECK: '1' } as const;
const RETAINED_ALIAS: Compatibility = {
  introducedIn: '0.70',
  retainedThrough: '0.71',
  removalEligibleAfter: '0.71',
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
    }
  > = {},
): CommandDefinition {
  return {
    name,
    description,
    public: true,
    effectClass,
    promptPolicy: options.promptPolicy ?? 'never',
    networkPolicy: options.networkPolicy ?? 'never',
    schemaVersions: [1],
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
    compatibility: RETAINED_ALIAS,
  };
}

function hidden(name: string): CommandDefinition {
  return {
    ...command(name, 'Internal Safeword helper', 'hook'),
    public: false,
  };
}

const CANONICAL_COMMANDS: readonly CommandDefinition[] = [
  command('status', 'Report project health and the next action', 'observe'),
  command('setup', 'Converge Safeword configuration', 'mutate', {
    networkPolicy: 'declared',
    commandOptions: [
      { flags: '-y, --yes', description: 'Skip confirmation prompts' },
      { flags: '--no-modify', description: 'Do not edit the project ESLint configuration' },
      {
        flags: '--migrate-namespace',
        description: 'Move the legacy project namespace to .project',
      },
      {
        flags: '--no-migrate-namespace',
        description: 'Keep the legacy project namespace',
      },
    ],
  }),
  command('plan', 'Preview reconciliation effects', 'plan'),
  command('doctor', 'Diagnose project configuration', 'observe'),
  command('remove', 'Remove Safeword configuration', 'destructive', {
    promptPolicy: 'confirm',
    commandOptions: [
      { flags: '-y, --yes', description: 'Confirm the supplied plan identity' },
      { flags: '--plan <id>', description: 'Identity of the exact plan being confirmed' },
      { flags: '--full', description: 'Also remove linting configuration and packages' },
    ],
  }),
  command('project sync-config', 'Regenerate dependency-cruiser configuration', 'mutate', {
    commandOptions: [{ flags: '--check', description: 'Report drift without writing' }],
  }),
  command('project architecture', 'Refresh generated architecture state', 'mutate', {
    commandOptions: [
      { flags: '--check', description: 'Report drift without writing' },
      { flags: '--stage', description: 'Stage regenerated architecture documents' },
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
      { flags: '--format <format>', description: 'human, json, or sh', defaultValue: 'human' },
    ],
  }),
  command('project lint-gherkin', 'Validate executable feature files', 'observe', {
    syntax: 'lint-gherkin [files...]',
  }),
  command('tracker sync', 'Synchronize tickets with the configured tracker', 'mutate', {
    networkPolicy: 'declared',
    commandOptions: [
      { flags: '--reset-tracker-map', description: 'Rebuild the tracker map' },
      { flags: '--plan', description: 'Compute an offline tracker plan' },
      { flags: '--apply-results <file>', description: 'Apply executor results offline' },
    ],
  }),
  command('tracker connect', 'Connect a project to a tracker', 'mutate', {
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
  command('codex migrate', 'Migrate legacy project hooks to the Codex plugin', 'mutate', {
    networkPolicy: 'declared',
    commandOptions: [
      { flags: '--finalize', description: 'Finalize after current plugin-hook proof exists' },
      { flags: '--yes', description: 'Confirm the observed migration plan' },
      { flags: '--plan <id>', description: 'Identity of the exact migration plan' },
      { flags: '--remove-legacy-hooks', description: 'Deprecated alias for --finalize' },
    ],
  }),
  command('codex install', 'Install the Codex profile plugin', 'mutate', {
    networkPolicy: 'declared',
  }),
  command('codex status', 'Report Codex plugin and migration state', 'observe'),
  command('codex recover', 'Restore backed-up legacy Codex project state', 'destructive', {
    promptPolicy: 'confirm',
    commandOptions: [
      { flags: '--yes', description: 'Confirm recovery of the observed backup' },
      { flags: '--plan <id>', description: 'Identity of the exact recovery plan' },
    ],
  }),
  command('ticket list', 'List project tickets', 'observe'),
  command('ticket new', 'Create a project ticket', 'mutate', {
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
  command('retro run', 'Extract and file session findings', 'mutate', {
    networkPolicy: 'declared',
    commandOptions: [
      { flags: '--transcript <path>', description: 'Session transcript path' },
      { flags: '--findings <path>', description: 'Agent-produced findings JSON' },
      { flags: '--auto-extract', description: 'Extract findings with a headless agent' },
      { flags: '--window-start <chars>', description: 'Transcript delta offset' },
      { flags: '--session-id <id>', description: 'Stable session identifier' },
    ],
    fixture: {
      argv: ['retro', 'run', '--transcript', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  }),
  command('retro signals', 'Inspect locally captured runtime signals', 'observe'),
  command('retro reconcile', 'Reconcile open retro findings', 'mutate', {
    networkPolicy: 'declared',
  }),
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

const ALIASES: readonly CommandDefinition[] = [
  alias('check', 'status'),
  {
    ...alias('upgrade', 'setup'),
    registration: {
      syntax: 'upgrade',
      options: canonicalOptions('setup'),
    },
  },
  alias('diff', 'plan'),
  {
    ...alias('reset', 'remove'),
    registration: {
      syntax: 'reset',
      options: canonicalOptions('remove'),
    },
  },
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
  {
    ...alias('sync-tracker', 'tracker sync'),
    registration: {
      syntax: 'sync-tracker',
      options: canonicalOptions('tracker sync'),
    },
  },
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
  {
    ...alias('self-report', 'retro signals'),
    registration: {
      syntax: 'self-report',
      options: [
        {
          flags: '--format <format>',
          description: 'Output format: human, json, or issue',
        },
      ],
    },
  },
  {
    ...alias('retro', 'retro run'),
    registration: {
      syntax: 'retro',
      options: canonicalOptions('retro run'),
    },
    fixture: {
      argv: ['retro', '--transcript', 'fixture'],
      environment: MACHINE_ENVIRONMENT,
    },
  },
  alias('retro-reconcile', 'retro reconcile'),
  {
    ...alias('migrate codex-plugin', 'codex migrate'),
    registration: {
      syntax: 'codex-plugin',
      options: canonicalOptions('codex migrate'),
    },
  },
];

const HIDDEN_COMMANDS: readonly CommandDefinition[] = [
  hidden('boundary'),
  hidden('hook codex'),
  hidden('codex-hook'),
  hidden('feature-directories'),
];

export const commandCatalog: readonly CommandDefinition[] = [
  ...CANONICAL_COMMANDS,
  ...ALIASES,
  ...HIDDEN_COMMANDS,
];

export const publicCommands = commandCatalog.filter(definition => definition.public);

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
    ...(definition.aliasFor !== undefined && { alias_for: definition.aliasFor }),
    effect_class: definition.effectClass,
    prompt_policy: definition.promptPolicy,
    network_policy: definition.networkPolicy,
    schema_versions: definition.schemaVersions,
    fixture: definition.fixture,
    ...(definition.compatibility !== undefined && {
      compatibility: {
        introduced_in: definition.compatibility.introducedIn,
        retained_through: definition.compatibility.retainedThrough,
        removal_eligible_after: definition.compatibility.removalEligibleAfter,
      },
    }),
  };
}

export function createCapabilitiesResult(): CliResult {
  return createResult({
    state: 'healthy',
    data: {
      commands: publicCommands.map(definition => capability(definition)),
    },
  });
}
