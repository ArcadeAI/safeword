import nodePath from 'node:path';
import process from 'node:process';

import type { Command } from 'commander';

import { type CliResult, exitStatusFor, renderHumanResult, renderJsonResult } from './result.js';

export interface GlobalCliOptions {
  readonly json: boolean;
  readonly noInput: boolean;
  readonly cwd: string;
  readonly quiet: boolean;
  readonly offline: boolean;
  readonly verbose: boolean;
}

export function addGlobalOptions(command: Command): Command {
  return command
    .option('--json', 'Write one versioned result envelope as JSON')
    .option('--no-input', 'Never prompt or infer consent')
    .option('--cwd <path>', 'Run against this project directory')
    .option('--quiet', 'Suppress healthy and progress prose')
    .option('--offline', 'Reject declared network effects')
    .option('--verbose', 'Include implementation detail');
}

export function readGlobalOptions(command: Command): GlobalCliOptions {
  const options = command.optsWithGlobals<{
    json?: boolean;
    noInput?: boolean;
    cwd?: string;
    quiet?: boolean;
    offline?: boolean;
    verbose?: boolean;
  }>();
  return {
    json: options.json === true,
    noInput: options.noInput === true,
    cwd: nodePath.resolve(process.cwd(), options.cwd ?? '.'),
    quiet: options.quiet === true,
    offline: options.offline === true,
    verbose: options.verbose === true,
  };
}

export function reportResult(result: CliResult, options: GlobalCliOptions): void {
  const output = options.json
    ? renderJsonResult(result)
    : renderHumanResult(result, { quiet: options.quiet, verbose: options.verbose });
  process.stdout.write(`${output}\n`);
  process.exitCode = exitStatusFor(result);
}
