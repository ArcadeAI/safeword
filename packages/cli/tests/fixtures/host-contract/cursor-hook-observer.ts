import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

// Test instrumentation preserves the installed hook's input, output and exit status.
// The host still invokes the real project hook; this wrapper owns no policy.
const [event, command] = process.argv.slice(2);
if (event === undefined || command === undefined || process.argv.length !== 4) {
  throw new Error('Expected the hook event and original installed command');
}

const input = readFileSync(0, 'utf8');
const shellInput =
  event === 'afterShellExecution'
    ? (JSON.parse(input) as { command?: string; output?: string })
    : undefined;
const result = spawnSync(command, {
  cwd: process.cwd(),
  env: process.env,
  input,
  encoding: 'utf8',
  shell: true,
});

appendFileSync(
  nodePath.resolve('.host-contract', 'hooks.jsonl'),
  `${JSON.stringify({
    event,
    command,
    input_sha256: createHash('sha256').update(input).digest('hex'),
    stdout_sha256: createHash('sha256')
      .update(result.stdout ?? '')
      .digest('hex'),
    exit_code: result.status,
    signal: result.signal,
    error: result.error?.message,
    native_shell:
      shellInput === undefined
        ? undefined
        : {
            helper_command_called:
              shellInput.command?.includes('project runtime audit-principle-trace') === true,
            foreign_cache_failure:
              shellInput.output?.includes('Module not found') === true &&
              shellInput.output.includes('foreign-codex-profile/'),
            helper_markers: shellInput.output?.match(/HELPER_[a-f0-9-]+/gu) ?? [],
          },
  })}\n`,
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error !== undefined) throw result.error;
if (result.status === null) throw new Error(`Installed hook ended with signal ${result.signal}`);
process.exit(result.status);
