import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';

// Observe the process boundary without supplying or changing a policy decision.
const args = process.argv.slice(2);
const target = process.env.SAFEWORD_OBSERVER_RUNTIME;
const observe = target
  ? args.includes(target)
  : args.includes('--plugin-hook') && args.includes('stop');
const input = observe ? readFileSync(0) : undefined;
const result = spawnSync(process.env.SAFEWORD_OBSERVER_REAL_BUN, args, {
  input,
  stdio: observe ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  maxBuffer: 4 * 1024 * 1024,
});
if (observe) {
  const observation = {
    args,
    input: JSON.parse(input.toString()),
    stdout: result.stdout?.toString(),
    stderr: result.stderr?.toString(),
    status: result.status,
    error: result.error?.message,
  };
  appendFileSync(process.env.SAFEWORD_OBSERVER_LOG, `${JSON.stringify(observation)}\n`);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
}
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
