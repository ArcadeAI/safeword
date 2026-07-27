import { startRelayRuntime } from './runtime.js';
import { parseRuntimeConfig } from './runtime-config.js';

const runtime = await startRelayRuntime(parseRuntimeConfig(process.env));
process.stdout.write(`${JSON.stringify({ event: 'relay_ready' })}\n`);

const state = { stopping: false };
async function stop(signal: string): Promise<void> {
  if (state.stopping) return;
  state.stopping = true;
  process.stdout.write(`${JSON.stringify({ event: 'relay_stopping', signal })}\n`);
  await runtime.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void (async () => {
      try {
        await stop(signal);
        process.exitCode = 0;
      } catch {
        process.stderr.write(`${JSON.stringify({ event: 'relay_shutdown_failed' })}\n`);
        process.exitCode = 1;
      }
    })();
  });
}
