import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const marker = 'safeword-claude-cloud-cron-carrier-v1';
const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const evidencePath = join(
  projectDirectory,
  '.project',
  'tmp',
  'claude-cloud-cron-carrier.json',
);
const startedAt = performance.now();

let evidence;

try {
  const response = await fetch('https://retro-relay-production.up.railway.app/health', {
    headers: { 'x-safeword-spike-marker': marker },
    signal: AbortSignal.timeout(1_500),
  });
  const body = await response.json();

  evidence = {
    marker,
    completedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - startedAt),
    outcome: response.ok && body?.status === 'ok' ? 'received' : 'unexpected_response',
    httpStatus: response.status,
    healthStatus: typeof body?.status === 'string' ? body.status : null,
  };
} catch (error) {
  evidence = {
    marker,
    completedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - startedAt),
    outcome: 'unreachable',
    errorKind: error instanceof Error ? error.name : 'UnknownError',
  };
}

mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
