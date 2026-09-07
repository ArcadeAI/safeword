import { startPublicRetroCollector } from './index.js';
import { positiveInteger } from './runtime-config.js';

const runtime = await startPublicRetroCollector({
  breakGlassCredential: process.env.SAFEWORD_PUBLIC_RETRO_BREAK_GLASS_CREDENTIAL,
  databasePath: process.env.SAFEWORD_PUBLIC_RETRO_DATABASE_PATH ?? '/data/public-retros.sqlite',
  collectorWorkerCredential: process.env.SAFEWORD_COLLECTOR_WORKER_CREDENTIAL,
  filingLimitPerHour: positiveInteger(
    process.env.SAFEWORD_RETRO_FILING_PER_HOUR,
    20,
    'SAFEWORD_RETRO_FILING_PER_HOUR',
  ),
  host: process.env.HOST ?? '0.0.0.0',
  intakeLimitPerMinute: positiveInteger(
    process.env.SAFEWORD_PUBLIC_RETRO_INTAKE_PER_MINUTE,
    60,
    'SAFEWORD_PUBLIC_RETRO_INTAKE_PER_MINUTE',
  ),
  operatorCredential: process.env.SAFEWORD_PUBLIC_RETRO_OPERATOR_CREDENTIAL,
  port: positiveInteger(process.env.PORT, 3000, 'PORT'),
  projectFilingLimitPerHour: positiveInteger(
    process.env.SAFEWORD_RETRO_PROJECT_FILING_PER_HOUR,
    5,
    'SAFEWORD_RETRO_PROJECT_FILING_PER_HOUR',
  ),
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
