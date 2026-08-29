/* global AbortSignal, URL, console, fetch, process -- Node 24 deployment runtime globals. */

import { createHash, randomUUID } from 'node:crypto';

const origin = new URL(
  process.env.SAFEWORD_PUBLIC_RETRO_ORIGIN ?? 'https://retro-collector-production.up.railway.app',
);

async function request(path, options) {
  const response = await fetch(new URL(path, origin), {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, body: await response.json() };
}

const requestId = randomUUID();
const sessionScope = createHash('sha256').update(`production-canary:${requestId}`).digest('hex');
const body = JSON.stringify({
  version: 'v1',
  finding: 'Production canary: verifies public retro acceptance and idempotent persistence.',
  source: {
    harness: 'codex',
    hostClass: 'local',
    projectUUID: randomUUID(),
    safewordCliVersion: 'production-canary',
    repository: 'ArcadeAI/safeword',
    model: 'production-canary',
    osFamily: 'linux',
  },
  sessionScope,
});
const submission = {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'x-safeword-request-id': requestId,
  },
  body,
};

const health = await request('/health');
const first = await request('/v1/public-retros', submission);
const replay = await request('/v1/public-retros', submission);

if (health.status !== 200 || health.body.status !== 'ok') {
  throw new Error(`Collector health check failed: ${JSON.stringify(health)}`);
}
if (first.status !== 201 || first.body.requestId !== requestId || !first.body.receipt) {
  throw new Error(`Collector did not accept canary: ${JSON.stringify(first)}`);
}
if (
  replay.status !== 200 ||
  replay.body.requestId !== requestId ||
  first.body.receipt !== replay.body.receipt
) {
  throw new Error(`Collector did not persist canary idempotently: ${JSON.stringify(replay)}`);
}

console.log(`Collector production canary passed (receipt ${first.body.receipt}).`);
