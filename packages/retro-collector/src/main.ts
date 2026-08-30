import { startPublicRetroCollector } from './index.js';

const runtime = await startPublicRetroCollector({
  databasePath: process.env.SAFEWORD_PUBLIC_RETRO_DATABASE_PATH ?? '/data/public-retros.sqlite',
  collectorWorkerCredential: process.env.SAFEWORD_COLLECTOR_WORKER_CREDENTIAL,
  filingLimitPerHour: Number(process.env.SAFEWORD_RETRO_FILING_PER_HOUR ?? 20),
  host: process.env.HOST ?? '0.0.0.0',
  intakeLimitPerMinute: Number(process.env.SAFEWORD_PUBLIC_RETRO_INTAKE_PER_MINUTE ?? 60),
  operatorCredential: process.env.SAFEWORD_PUBLIC_RETRO_OPERATOR_CREDENTIAL,
  port: Number(process.env.PORT ?? 3000),
  projectFilingLimitPerHour: Number(process.env.SAFEWORD_RETRO_PROJECT_FILING_PER_HOUR ?? 5),
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
