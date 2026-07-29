import type { CommandDefinition } from './catalog.js';

function valueOptionFlags(catalog: readonly CommandDefinition[]): ReadonlySet<string> {
  const flags = catalog.flatMap(definition =>
    definition.registration.options.flatMap(option => {
      if (!option.flags.includes('<') && !option.flags.includes('[')) return [];
      return option.flags
        .split(/[ ,|]+/)
        .filter(flag => flag.startsWith('-'))
        .map(flag => flag.split(/[<[ ]/, 1)[0])
        .filter((flag): flag is string => flag !== undefined);
    }),
  );
  return new Set(['--cwd', ...flags]);
}

export function machineOutputRequested(
  arguments_: readonly string[],
  catalog: readonly CommandDefinition[],
): boolean {
  const valueOptions = valueOptionFlags(catalog);
  let skipValue = false;
  for (const argument of arguments_) {
    if (skipValue) {
      skipValue = false;
      continue;
    }
    if (argument === '--') return false;
    if (argument === '--json') return true;
    skipValue = valueOptions.has(argument);
  }
  return false;
}
