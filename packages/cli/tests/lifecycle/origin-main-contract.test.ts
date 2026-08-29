import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CommandInvocation } from '../../src/cli-protocol/handler.js';
import { type CliResult, createResult } from '../../src/cli-protocol/result.js';
import { installLifecycle, uninstallLifecycle } from '../../src/lifecycle/commands.js';
import { projectLifecycleSchema } from '../../src/lifecycle/schema.js';
import { observeLifecycleStatus } from '../../src/lifecycle/status.js';
import { VERSION } from '../../src/version.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const profileState = vi.hoisted(() => ({ claude: false, codex: false }));

vi.mock('../../src/claude-plugin/profile.js', () => ({
  observeClaudeProfile: () =>
    profileState.claude ? { plugin: { installed: true } } : { plugin: undefined },
  claudeInstallRequiresMutation: () => !profileState.claude,
  uninstallClaudePlugin: () => {
    const changed = profileState.claude;
    profileState.claude = false;
    return createResult({ state: changed ? 'changed' : 'healthy' });
  },
}));

vi.mock('../../src/claude-plugin/status.js', () => ({
  observeClaudeStatus: () =>
    createResult({ state: profileState.claude ? 'healthy' : 'action_required' }),
}));

vi.mock('../../src/codex-plugin/operations.js', () => ({
  observeCodexMigrationResult: () => ({ plugin: { installed: profileState.codex } }),
  codexInstallRequiresMutation: () => !profileState.codex,
  observeCodexMigration: () =>
    createResult({ state: profileState.codex ? 'healthy' : 'action_required' }),
  uninstallCodexPlugin: () => {
    const changed = profileState.codex;
    profileState.codex = false;
    return createResult({ state: changed ? 'changed' : 'healthy' });
  },
}));

const FIXTURE_ROOT = nodePath.join(import.meta.dirname, '../fixtures/lifecycle-origin-main');
const ORIGIN_MAIN_COMMIT = '528afa2caf2b168c6531dd02802b77320801442f';
const CONTRACT_CASES = [
  'claude-install',
  'claude-upgrade',
  'claude-check',
  'claude-uninstall',
  'codex-install',
  'codex-upgrade',
  'codex-check',
  'codex-uninstall',
  'cursor-install',
  'cursor-upgrade',
  'cursor-check',
  'cursor-uninstall',
] as const;

type Integration = 'claude' | 'codex' | 'cursor';
type Operation = 'install' | 'upgrade' | 'check' | 'uninstall';
const temporaryDirectories: string[] = [];
const actualFixtures = new Map<string, string>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function invocation(cwd: string, agent: Integration, options = {}): CommandInvocation {
  return {
    cwd,
    noInput: true,
    offline: false,
    operands: [],
    options: { agents: agent, modify: false, scope: 'project', ...options },
  };
}

async function install(cwd: string, agent: Integration): Promise<CliResult> {
  return installLifecycle(invocation(cwd, agent), {
    installClaude: () => {
      profileState.claude = true;
      return Promise.resolve(createResult({ state: 'changed' }));
    },
    installCodex: () => {
      profileState.codex = true;
      return Promise.resolve(createResult({ state: 'changed' }));
    },
  });
}

function canonicalValue(value: unknown, cwd: string): unknown {
  if (typeof value === 'string') {
    let normalized = value
      .replaceAll(cwd, '<project>')
      .replaceAll(nodePath.basename(cwd), '<project-name>')
      .replaceAll(VERSION, '<version>')
      .replaceAll(/[a-f\d]{64}/gu, '<digest>');
    const cliRoot = process.env.SAFEWORD_TEST_CLI_ROOT;
    if (cliRoot !== undefined) normalized = normalized.replaceAll(cliRoot, '<cli-root>');
    return normalized;
  }
  if (Array.isArray(value)) return value.map(entry => canonicalValue(entry, cwd));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [
        key,
        key === 'projectUUID' ? '<project-uuid>' : canonicalValue(entry, cwd),
      ]),
  );
}

function treeDigest(root: string, agent: Integration): string {
  const hash = createHash('sha256');
  const visit = (path: string): void => {
    const relative = nodePath.relative(root, path);
    const stat = lstatSync(path);
    hash.update(relative);
    if (stat.isSymbolicLink()) {
      hash.update(`link:${readlinkSync(path)}`);
      return;
    }
    if (stat.isDirectory()) {
      const entries = readdirSync(path).toSorted((left, right) => left.localeCompare(right));
      for (const entry of entries) {
        visit(nodePath.join(path, entry));
      }
      return;
    }
    const rawContent = readFileSync(path, 'utf8');
    const content =
      relative === '.safeword/config.json'
        ? JSON.stringify(canonicalValue(JSON.parse(rawContent), root))
        : (canonicalValue(rawContent, root) as string);
    hash.update(content);
  };
  const schema = projectLifecycleSchema(root, [agent]);
  const managedPaths = new Set([
    ...Object.keys(schema.ownedFiles),
    ...Object.keys(schema.managedFiles),
    ...Object.keys(schema.jsonMerges),
    ...schema.ownedDirs,
  ]);
  const sortedPaths = [...managedPaths].toSorted((left, right) => left.localeCompare(right));
  for (const relative of sortedPaths) {
    const path = nodePath.join(root, relative);
    hash.update(relative);
    if (existsSync(path)) visit(path);
    else hash.update('missing');
  }
  return hash.digest('hex');
}

async function applyUninstall(cwd: string, agent: Integration): Promise<CliResult> {
  const preview = await uninstallLifecycle(invocation(cwd, agent));
  const plan = (preview.data as { readonly plan: { readonly id: string } }).plan.id;
  return uninstallLifecycle(invocation(cwd, agent, { yes: true, plan }));
}

function fixtureContent(
  agent: Integration,
  operation: Operation,
  result: CliResult,
  cwd: string,
): string {
  const normalizedResult = JSON.stringify(canonicalValue(result, cwd));
  return `${JSON.stringify(
    {
      integration: agent,
      operation,
      result_sha256: sha256(normalizedResult),
      tree_sha256: treeDigest(cwd, agent),
    },
    undefined,
    2,
  )}\n`;
}

async function captureIntegration(agent: Integration): Promise<void> {
  const cwd = createTemporaryDirectory();
  temporaryDirectories.push(cwd);
  profileState.claude = false;
  profileState.codex = false;

  const installed = await install(cwd, agent);
  actualFixtures.set(`${agent}-install`, fixtureContent(agent, 'install', installed, cwd));

  const checked = await observeLifecycleStatus(cwd, [agent]);
  actualFixtures.set(`${agent}-check`, fixtureContent(agent, 'check', checked, cwd));

  writeFileSync(nodePath.join(cwd, '.safeword/version'), '0.79.3\n');
  const upgraded = await install(cwd, agent);
  actualFixtures.set(`${agent}-upgrade`, fixtureContent(agent, 'upgrade', upgraded, cwd));

  const uninstalled = await applyUninstall(cwd, agent);
  actualFixtures.set(`${agent}-uninstall`, fixtureContent(agent, 'uninstall', uninstalled, cwd));
}

beforeAll(async () => {
  for (const agent of ['claude', 'codex', 'cursor'] as const) await captureIntegration(agent);
  if (process.env.SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES !== '1') return;
  mkdirSync(FIXTURE_ROOT, { recursive: true });
  const fixtures: Record<string, string> = {};
  for (const [contractCase, content] of actualFixtures) {
    writeFileSync(nodePath.join(FIXTURE_ROOT, `${contractCase}.json`), content);
    fixtures[contractCase] = sha256(content);
  }
  writeFileSync(
    nodePath.join(FIXTURE_ROOT, 'manifest.json'),
    `${JSON.stringify({ originMainCommit: ORIGIN_MAIN_COMMIT, fixtures }, undefined, 2)}\n`,
  );
});

afterAll(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
});

describe('origin/main integration contracts', () => {
  it.each(CONTRACT_CASES)('SWM1.R3.S04 preserves %s byte-for-byte', contractCase => {
    const fixturePath = nodePath.join(FIXTURE_ROOT, `${contractCase}.json`);
    const expected = readFileSync(fixturePath, 'utf8');
    const manifest = JSON.parse(
      readFileSync(nodePath.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'),
    ) as {
      readonly originMainCommit: string;
      readonly fixtures: Readonly<Record<string, string>>;
    };
    expect(manifest.originMainCommit).toBe(ORIGIN_MAIN_COMMIT);
    expect(sha256(expected)).toBe(manifest.fixtures[contractCase]);
    expect(actualFixtures.get(contractCase)).toBe(expected);
  });
});
