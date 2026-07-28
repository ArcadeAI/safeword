import { findCommandDefinition } from './catalog.js';
import { type CliResult, createResult } from './result.js';

export function describeNonInteractiveIntent(name: string, offline: boolean): CliResult {
  const definition = findCommandDefinition(name);

  if (definition.effectClass === 'observe' || definition.effectClass === 'plan') {
    return createResult({
      state: 'healthy',
      data: { command: name, mode: 'non_interactive' },
    });
  }

  const onlineRequired = offline && definition.networkPolicy === 'declared';
  const nextCommand = `safeword ${name}${onlineRequired ? '' : ' --yes'}`;
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: onlineRequired ? 'CLI_ONLINE_REQUIRED' : 'CLI_CONFIRMATION_REQUIRED',
        message: onlineRequired
          ? `\`${name}\` requires declared network access.`
          : `Review and explicitly confirm \`${name}\` before it changes the project.`,
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: nextCommand,
        mutates: true,
        requiresHuman: !onlineRequired,
      },
    ],
    data: { command: name, mode: 'non_interactive' },
  });
}
