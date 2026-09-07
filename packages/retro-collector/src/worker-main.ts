import process from 'node:process';

import { runRetroTransferWorker } from './worker.js';

type WorkerEnvironmentKey =
  | 'SAFEWORD_COLLECTOR_URL'
  | 'SAFEWORD_COLLECTOR_WORKER_CREDENTIAL'
  | 'SAFEWORD_RELAY_COLLECTOR_WORKER_CREDENTIAL'
  | 'SAFEWORD_RELAY_URL';

function environmentValue(name: WorkerEnvironmentKey): string | undefined {
  switch (name) {
    case 'SAFEWORD_COLLECTOR_URL': {
      return process.env.SAFEWORD_COLLECTOR_URL;
    }
    case 'SAFEWORD_COLLECTOR_WORKER_CREDENTIAL': {
      return process.env.SAFEWORD_COLLECTOR_WORKER_CREDENTIAL;
    }
    case 'SAFEWORD_RELAY_COLLECTOR_WORKER_CREDENTIAL': {
      return process.env.SAFEWORD_RELAY_COLLECTOR_WORKER_CREDENTIAL;
    }
    case 'SAFEWORD_RELAY_URL': {
      return process.env.SAFEWORD_RELAY_URL;
    }
  }
}

function required(name: WorkerEnvironmentKey): string {
  const value = environmentValue(name)?.trim();
  if (value === undefined || value === '') throw new Error(`${name} is required`);
  return value;
}

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    controller.abort();
  });
}

await runRetroTransferWorker(
  {
    collectorCredential: required('SAFEWORD_COLLECTOR_WORKER_CREDENTIAL'),
    collectorUrl: required('SAFEWORD_COLLECTOR_URL'),
    relayCredential: required('SAFEWORD_RELAY_COLLECTOR_WORKER_CREDENTIAL'),
    relayUrl: required('SAFEWORD_RELAY_URL'),
  },
  controller.signal,
);
