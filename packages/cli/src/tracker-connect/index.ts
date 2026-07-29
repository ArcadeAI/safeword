/**
 * The connect orchestration (2TK5AD) — the single flow `setup` and `connect`
 * both run. Pure over injected ports (prompt / secret store / verify) so it's
 * tested through real config/sidecar/file logic with only the boundary mocked
 * (#363). Order: validate → write non-secret config → print handoff → store
 * secret → verify → (on success) seed sidecar + offer pollution opt-ins.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { loadTrackerMap, TrackerMap } from '../tracker-sync/tracker-map.js';
import type { Provider } from '../tracker-sync/types.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { handoffSteps } from './handoff.js';
import type {
  ConnectMutation,
  ConnectResult,
  ConnectTarget,
  Prompt,
  SecretStore,
  VerifyClient,
} from './types.js';
import { ConnectExecutionError } from './types.js';

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
function writeProviderConfig(
  cwd: string,
  provider: Provider,
  target: ConnectTarget,
): ConnectMutation | undefined {
  const path = configPath(cwd);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const existing: Record<string, unknown> =
    before === undefined ? {} : (JSON.parse(before) as Record<string, unknown>);
  const priorBridge = (existing.ticketBridge ?? {}) as Record<string, unknown>;
  existing.ticketBridge = { ...priorBridge, provider, body: priorBridge.body ?? 'minimal', target };
  const after = `${JSON.stringify(existing, undefined, 2)}\n`;
  writeFileSync(path, after);
  return before === after
    ? undefined
    : {
        surface: 'file',
        kind: before === undefined ? 'create' : 'update',
        target: '.safeword/config.json',
        operation: 'write',
      };
}

/** Offer the pollution opt-ins; write `.cursorindexingignore` + a `.gitattributes` marker on accept. */
async function offerPollutionOptIns(
  dependencies: ConnectDependencies,
  mutations: ConnectMutation[],
): Promise<void> {
  const accepted = await dependencies.prompt.confirm(
    'Add ignore/markers so coding agents don’t index the generated ticket files?',
    false,
  );
  if (!accepted) return;
  const namespaceRoot = resolveNamespaceRoot(dependencies.cwd);
  const namespacePattern = `${nodePath.relative(dependencies.cwd, namespaceRoot).replaceAll('\\', '/')}/`;
  const cursorIgnorePath = nodePath.join(dependencies.cwd, '.cursorindexingignore');
  const cursorIgnoreBefore = existsSync(cursorIgnorePath)
    ? readFileSync(cursorIgnorePath, 'utf8')
    : '';
  const cursorIgnoreLines = cursorIgnoreBefore.split('\n').filter(Boolean);
  if (!cursorIgnoreLines.includes(namespacePattern)) {
    writeFileSync(
      cursorIgnorePath,
      `${cursorIgnoreLines.join('\n')}${cursorIgnoreLines.length > 0 ? '\n' : ''}${namespacePattern}\n`,
    );
    mutations.push({
      surface: 'file',
      kind: cursorIgnoreBefore === '' ? 'create' : 'update',
      target: '.cursorindexingignore',
      operation: 'merge',
    });
  }
  const attributesPath = nodePath.join(dependencies.cwd, '.gitattributes');
  const attributesBefore = existsSync(attributesPath) ? readFileSync(attributesPath, 'utf8') : '';
  const marker = `${namespacePattern}**/INDEX*.md linguist-generated=true`;
  const attributeLines = attributesBefore.split('\n').filter(Boolean);
  if (!attributeLines.includes(marker)) {
    writeFileSync(
      attributesPath,
      `${attributeLines.join('\n')}${attributeLines.length > 0 ? '\n' : ''}${marker}\n`,
    );
    mutations.push({
      surface: 'file',
      kind: attributesBefore === '' ? 'create' : 'update',
      target: '.gitattributes',
      operation: 'merge',
    });
  }
}

async function connectSupportedTracker(
  dependencies: ConnectDependencies,
  provider: Provider,
  mutations: ConnectMutation[],
): Promise<ConnectResult> {
  const { cwd, log } = dependencies;

  // AC2 — write non-secret config, then print the per-provider human handoff.
  const configMutation = writeProviderConfig(cwd, provider, dependencies.target);
  if (configMutation !== undefined) mutations.push(configMutation);
  for (const line of handoffSteps(provider, dependencies.target)) log(line);

  // AC3 — the secret lands in the store (keychain/env), never config, never logged.
  if (dependencies.token !== undefined) {
    const where = await dependencies.secretStore.store(provider, dependencies.token);
    mutations.push({
      surface: 'configuration',
      kind: 'credential-store',
      target: provider,
      operation: where,
    });
    log(`Credential stored in the ${where}.`);
  }

  // AC4 — verify before declaring the connection live.
  mutations.push({
    surface: 'network',
    kind: 'verify-auth',
    target: provider,
    operation: 'read',
  });
  const verdict = await dependencies.verify.whoami(provider);
  if (!verdict.ok) {
    log(`Not connected — ${verdict.missing}.`);
    return { exitCode: 1, connected: false, mutations };
  }

  // AC5 — a verified connect seeds the empty sidecar (JS5K5G's first-run contract).
  const sidecarPath = nodePath.join(cwd, '.safeword', 'tracker-map.json');
  const sidecar = loadTrackerMap(sidecarPath);
  if (!sidecar.ok && sidecar.reason === 'corrupt') {
    throw new Error(
      `${sidecarPath} is not a valid tracker map; preserve or repair it before reconnecting.`,
    );
  }
  if (!sidecar.ok) {
    new TrackerMap().save(sidecarPath);
    mutations.push({
      surface: 'file',
      kind: 'create',
      target: '.safeword/tracker-map.json',
      operation: 'write',
    });
  }
  log(`Connected to ${provider} — verified and ready to sync.`);

  // AC6 — offer the pollution opt-ins last (post-verify, non-fatal).
  await offerPollutionOptIns(dependencies, mutations);

  return { exitCode: 0, connected: true, mutations };
}

export async function connectTracker(dependencies: ConnectDependencies): Promise<ConnectResult> {
  const mutations: ConnectMutation[] = [];
  if (!SUPPORTED.has(dependencies.provider as Provider)) {
    dependencies.log(
      `Provider "${dependencies.provider}" is not supported (use linear or github).`,
    );
    return { exitCode: 1, connected: false, mutations };
  }
  try {
    return await connectSupportedTracker(
      dependencies,
      dependencies.provider as Provider,
      mutations,
    );
  } catch (connectError) {
    throw new ConnectExecutionError(connectError, mutations);
  }
}
