import type { CliResult } from './result.js';

interface CommandDefinition {
  readonly name: string;
  readonly public: boolean;
  readonly effectClass: string;
  readonly promptPolicy: string;
  readonly networkPolicy: string;
  readonly schemaVersions: readonly number[];
  readonly fixture: {
    readonly argv: readonly string[];
    readonly environment: Readonly<Record<string, string>>;
  };
  readonly aliasFor?: string;
  readonly compatibility?: {
    readonly introducedIn: string;
    readonly retainedThrough: string;
    readonly removalEligibleAfter: string;
  };
}

export const commandCatalog: readonly CommandDefinition[] = [];
export const publicCommands: readonly CommandDefinition[] = [];

export function createCapabilitiesResult(): CliResult {
  throw new Error('Not implemented');
}
