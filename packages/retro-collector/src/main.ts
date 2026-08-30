import { startPublicRetroCollector } from './index.js';

const runtime = await startPublicRetroCollector({
  databasePath: process.env.SAFEWORD_PUBLIC_RETRO_DATABASE_PATH ?? '/data/public-retros.sqlite',
  collectorWorkerCredential: process.env.SAFEWORD_COLLECTOR_WORKER_CREDENTIAL,
  host: process.env.HOST ?? '0.0.0.0',
  operatorCredential: process.env.SAFEWORD_PUBLIC_RETRO_OPERATOR_CREDENTIAL,
  port: Number(process.env.PORT ?? 3000),
});

const state = { stopping: false };
async function stop(): Promise<void> {
  if (state.stopping) return;
  state.stopping = true;
  await runtime.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void (async () => {
      try {
        await stop();
        process.exitCode = 0;
      } catch {
        process.exitCode = 1;
      }
    })();
  });
}
