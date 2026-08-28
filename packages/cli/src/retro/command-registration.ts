import { Command } from 'commander';

import type { RetroCliOptions } from '../commands/retro.js';

export type ExecuteRetroCommand = (options: RetroCliOptions) => Promise<void>;

async function defaultExecute(options: RetroCliOptions): Promise<void> {
  const { retroCommand } = await import('../commands/retro.js');
  await retroCommand(options);
}

/**
 * Register the real `safeword retro` parser/action boundary. Tests can replace
 * only the action collaborator while executing the same Commander wiring.
 */
function registerRetroCommand(
  program: Command,
  execute: ExecuteRetroCommand = defaultExecute,
): void {
  program
    .command('retro')
    .description('Mine a session transcript for qualitative safeword friction and file it (RV9JT4)')
    .requiredOption('--transcript <path>', 'Path to the session transcript (never guessed)')
    .option('--findings <path>', 'Path to agent-produced raw findings JSON to sanitize and file')
    .option(
      '--auto-extract',
      'Extract findings out-of-band via a headless `claude -p` session (no --findings needed)',
    )
    .option('--public-retro', 'Attempt eligible public quarantine delivery')
    .option(
      '--window-start <chars>',
      'Delta re-arm: digest only the transcript from this char offset onward (ZFGWS1)',
    )
    .option('--session-id <id>', 'Stable session id to attribute findings to (ledger accounting)')
    .action(
      async (options: {
        transcript?: string;
        findings?: string;
        autoExtract?: boolean;
        publicRetro?: boolean;
        windowStart?: string;
        sessionId?: string;
      }) => {
        const windowStart =
          options.windowStart === undefined ? undefined : Number(options.windowStart);
        await execute({
          transcript: options.transcript,
          findings: options.findings,
          autoExtract: options.autoExtract,
          publicRetro: options.publicRetro,
          windowStart: Number.isFinite(windowStart) ? windowStart : undefined,
          sessionId: options.sessionId,
        });
      },
    );
}

export async function parseRetroCommandArguments(
  arguments_: string[],
  execute: ExecuteRetroCommand,
): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerRetroCommand(program, execute);
  // Installed instructions use the canonical catalog spelling (`retro run`),
  // while this small parser is retained solely as an injected test seam for the
  // historical direct command. Normalize that spelling at the seam instead of
  // registering a second production Commander command.
  const normalized =
    arguments_[0] === 'retro' && arguments_[1] === 'run'
      ? [arguments_[0], ...arguments_.slice(2)]
      : arguments_;
  await program.parseAsync(['node', 'safeword', ...normalized]);
}
