import type { CommandDefinition } from './catalog.js';

function commandDefinitionFor(
  arguments_: readonly string[],
  catalog: readonly CommandDefinition[],
): CommandDefinition | undefined {
  const positional: string[] = [];
  let skipGlobalValue = false;
  for (const argument of arguments_) {
    if (skipGlobalValue) {
      skipGlobalValue = false;
      continue;
    }
    if (argument === '--') break;
    if (argument === '--cwd') {
      skipGlobalValue = true;
      continue;
    }
    if (argument.startsWith('-')) continue;
    positional.push(argument);
  }
  return catalog
    .filter(definition => {
      const path = definition.name.split(' ');
      return path.every((segment, index) => positional[index] === segment);
    })
    .toSorted((left, right) => right.name.split(' ').length - left.name.split(' ').length)[0];
}

function valueOptionFlags(
  arguments_: readonly string[],
  catalog: readonly CommandDefinition[],
): ReadonlySet<string> {
  const definition = commandDefinitionFor(arguments_, catalog);
  const flags = (definition?.registration.options ?? []).flatMap(option => {
    if (!option.flags.includes('<') && !option.flags.includes('[')) return [];
    return option.flags
      .split(/[ ,|]+/)
      .filter(flag => flag.startsWith('-'))
      .map(flag => flag.split(/[<[ ]/, 1)[0])
      .filter((flag): flag is string => flag !== undefined);
  });
  return new Set(['--cwd', ...flags]);
}

export function machineOutputRequested(
  arguments_: readonly string[],
  catalog: readonly CommandDefinition[],
): boolean {
  const valueOptions = valueOptionFlags(arguments_, catalog);
  let skipValue = false;
  for (const argument of arguments_) {
    if (skipValue) {
      skipValue = false;
      continue;
    }
    if (argument === '--') return false;
    if (argument === '--json') return true;
    skipValue = valueOptions.has(argument.split('=', 1)[0] ?? argument) && !argument.includes('=');
  }
  return false;
}
