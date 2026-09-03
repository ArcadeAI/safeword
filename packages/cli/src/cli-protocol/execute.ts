import nodePath from 'node:path';
import process from 'node:process';

import type { Command } from 'commander';

import { findCommandDefinition } from './catalog.js';
import { assertEffectPolicy } from './policy.js';
import { type CliResult, exitStatusFor, renderHumanStreams, renderJsonResult } from './result.js';

export interface GlobalCliOptions {
  readonly json: boolean;
  readonly noInput: boolean;
  readonly cwd: string;
  readonly quiet: boolean;
  readonly offline: boolean;
  readonly verbose: boolean;
}

const GLOBAL_OPTION_KEYS = new Set(['json', 'noInput', 'cwd', 'quiet', 'offline', 'verbose']);

export const GLOBAL_OPTION_DEFINITIONS = [
  { flags: '--json', description: 'Write one versioned result envelope as JSON' },
  { flags: '--no-input', description: 'Never prompt or infer consent' },
  { flags: '--cwd <path>', description: 'Run against this project directory' },
  { flags: '--quiet', description: 'Suppress healthy and progress prose' },
  { flags: '--offline', description: 'Reject declared network effects' },
  { flags: '-v, --verbose', description: 'Include implementation detail' },
] as const;

export function addGlobalOptions(command: Command): Command {
  for (const option of GLOBAL_OPTION_DEFINITIONS) command.option(option.flags, option.description);
  return command;
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

/**
 * Resolve command-specific options across a command family boundary. A family
 * can itself be a retained alias (`retro`) while also owning canonical leaves
 * (`retro run`); Commander may parse a duplicated option onto either node.
 */
export function readCommandOptions(command: Command): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(command.optsWithGlobals<Record<string, unknown>>()).filter(
      // Let lifecycle selection apply the Claude default only when Claude is selected.
      // Explicit --scope=user still requires Claude in the selection.
      ([name]) =>
        !GLOBAL_OPTION_KEYS.has(name) &&
        !(name === 'scope' && command.getOptionValueSourceWithGlobals(name) === 'default'),
    ),
  );
}

export function reportResult(
  result: CliResult,
  options: GlobalCliOptions,
  commandName?: string,
  delivery?: { readonly actionRequiredAsSuccess: boolean },
): void {
  let reportableResult = result;
  if (commandName !== undefined) {
    try {
      assertEffectPolicy(findCommandDefinition(commandName), result, options);
    } catch (policyError: unknown) {
      reportableResult = {
        ...result,
        ok: false,
        state: 'failed',
        exitCode: 1,
        errors: [
          ...result.errors,
          {
            code: 'CLI_POLICY_VIOLATION',
            message: 'Command result violated its declared capability policy.',
            retryable: false,
            detail: policyError instanceof Error ? policyError.message : String(policyError),
          },
        ],
      };
    }
  }
  if (options.json) {
    process.stdout.write(`${renderJsonResult(reportableResult)}\n`);
  } else {
    const rendered = renderHumanStreams(reportableResult, {
      quiet: options.quiet,
      verbose: options.verbose,
    });
    if (rendered.stdout !== '') process.stdout.write(`${rendered.stdout}\n`);
    if (rendered.stderr !== '') process.stderr.write(`${rendered.stderr}\n`);
  }
  process.exitCode =
    delivery?.actionRequiredAsSuccess === true && reportableResult.state === 'action_required'
      ? 0
      : exitStatusFor(reportableResult);
}
