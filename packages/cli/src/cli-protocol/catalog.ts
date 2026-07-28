import { type CliResult, createResult } from './result.js';

export type EffectClass = 'observe' | 'plan' | 'mutate' | 'destructive' | 'hook';
export type PromptPolicy = 'never' | 'confirm';
export type NetworkPolicy = 'never' | 'declared';

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
  options: Partial<Pick<CommandDefinition, 'promptPolicy' | 'networkPolicy' | 'fixture'>> = {},
): CommandDefinition {
  return {
    name,
    description,
    public: true,
    effectClass,
    promptPolicy: options.promptPolicy ?? 'never',
    networkPolicy: options.networkPolicy ?? 'never',
    schemaVersions: [1],
    fixture: options.fixture ?? {
      argv: name.split(' '),
      environment: MACHINE_ENVIRONMENT,
    },
  };
}

function alias(
  name: string,
  aliasFor: string,
  effectClass: Exclude<EffectClass, 'hook'>,
): CommandDefinition {
  return {
    ...command(name, `Deprecated alias for ${aliasFor}`, effectClass),
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
  }),
  command('plan', 'Preview reconciliation effects', 'plan'),
  command('doctor', 'Diagnose project configuration', 'observe'),
  command('remove', 'Remove Safeword configuration', 'destructive', {
    promptPolicy: 'confirm',
  }),
  command('project', 'Manage project-local Safeword state', 'mutate'),
  command('tracker', 'Manage tracker connections and synchronization', 'mutate', {
    networkPolicy: 'declared',
  }),
  command('codex', 'Manage the Safeword Codex plugin', 'mutate'),
  command('ticket', 'Manage local Safeword tickets', 'mutate'),
  command('retro', 'Review and reconcile session findings', 'mutate', {
    networkPolicy: 'declared',
  }),
  command('capabilities', 'Describe the public machine interface', 'observe'),
];

const ALIASES: readonly CommandDefinition[] = [
  alias('check', 'status', 'observe'),
  alias('upgrade', 'setup', 'mutate'),
  alias('diff', 'plan', 'plan'),
  alias('reset', 'remove', 'destructive'),
  alias('sync-config', 'project sync-config', 'mutate'),
  alias('architecture', 'project architecture', 'mutate'),
  alias('sync-learnings', 'project sync-learnings', 'mutate'),
  alias('sync-tickets', 'project sync-tickets', 'mutate'),
  alias('codify', 'project codify', 'mutate'),
  alias('test-plan', 'project test-plan', 'observe'),
  alias('lint-gherkin', 'project lint-gherkin', 'observe'),
  alias('sync-tracker', 'tracker sync', 'mutate'),
  alias('connect', 'tracker connect', 'mutate'),
  alias('self-report', 'retro signals', 'observe'),
  alias('retro', 'retro run', 'mutate'),
  alias('retro-reconcile', 'retro reconcile', 'mutate'),
  alias('migrate codex-plugin', 'codex migrate', 'mutate'),
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
