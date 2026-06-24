/**
 * The connect orchestration (2TK5AD) — the single flow `setup` and `connect`
 * both run. Pure over injected ports (prompt / secret store / verify) so it's
 * tested through real config/sidecar/file logic with only the boundary mocked
 * (#363). Order: validate → write non-secret config → print handoff → store
 * secret → verify → (on success) seed sidecar + offer pollution opt-ins.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { TrackerMap } from '../tracker-sync/tracker-map.js';
import type { Provider } from '../tracker-sync/types.js';
import { handoffSteps } from './handoff.js';
import type { ConnectResult, ConnectTarget, Prompt, SecretStore, VerifyClient } from './types.js';

const SUPPORTED = new Set<Provider>(['linear', 'github']);

export interface ConnectDependencies {
  cwd: string;
  provider: string;
  target: ConnectTarget;
  token?: string;
  prompt: Prompt;
  secretStore: SecretStore;
  verify: VerifyClient;
  log: (message: string) => void;
}

function configPath(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'config.json');
}

/** Merge the non-secret provider/target into `.safeword/config.json` (preserve other keys). */
function writeProviderConfig(cwd: string, provider: Provider, target: ConnectTarget): void {
  const path = configPath(cwd);
  const existing: Record<string, unknown> = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>)
    : {};
  const priorBridge = (existing.ticketBridge ?? {}) as Record<string, unknown>;
  existing.ticketBridge = { ...priorBridge, provider, body: priorBridge.body ?? 'minimal', target };
  writeFileSync(path, `${JSON.stringify(existing, undefined, 2)}\n`);
}

/** Offer the pollution opt-ins; write `.cursorindexingignore` + a `.gitattributes` marker on accept. */
async function offerPollutionOptIns(dependencies: ConnectDependencies): Promise<void> {
  const accepted = await dependencies.prompt.confirm(
    'Add ignore/markers so coding agents don’t index the generated ticket files?',
    false,
  );
  if (!accepted) return;
  writeFileSync(nodePath.join(dependencies.cwd, '.cursorindexingignore'), '.project/\n');
  writeFileSync(
    nodePath.join(dependencies.cwd, '.gitattributes'),
    '.project/**/INDEX*.md linguist-generated=true\n',
    { flag: 'a' },
  );
}

export async function connectTracker(dependencies: ConnectDependencies): Promise<ConnectResult> {
  const { cwd, log } = dependencies;

  // AC7 — an unsupported provider is rejected before any wiring.
  if (!SUPPORTED.has(dependencies.provider as Provider)) {
    log(`Provider "${dependencies.provider}" is not supported (use linear or github).`);
    return { exitCode: 1, connected: false };
  }
  const provider = dependencies.provider as Provider;

  // AC2 — write non-secret config, then print the per-provider human handoff.
  writeProviderConfig(cwd, provider, dependencies.target);
  for (const line of handoffSteps(provider, dependencies.target)) log(line);

  // AC3 — the secret lands in the store (keychain/env), never config, never logged.
  if (dependencies.token !== undefined) {
    const where = await dependencies.secretStore.store(provider, dependencies.token);
    log(`Credential stored in the ${where}.`);
  }

  // AC4 — verify before declaring the connection live.
  const verdict = await dependencies.verify.whoami(provider);
  if (!verdict.ok) {
    log(`Not connected — ${verdict.missing}.`);
    return { exitCode: 1, connected: false };
  }

  // AC5 — a verified connect seeds the empty sidecar (JS5K5G's first-run contract).
  new TrackerMap().save(nodePath.join(cwd, '.safeword', 'tracker-map.json'));
  log(`Connected to ${provider} — verified and ready to sync.`);

  // AC6 — offer the pollution opt-ins last (post-verify, non-fatal).
  await offerPollutionOptIns(dependencies);

  return { exitCode: 0, connected: true };
}
