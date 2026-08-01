import { type CliResult, createResult } from './result.js';

export function onlineRequired(name: string, nextCommand = name): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CLI_ONLINE_REQUIRED',
        message: `\`${name}\` requires declared network access for this operation.`,
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword ${nextCommand}`,
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: name, offline: true },
  });
}
