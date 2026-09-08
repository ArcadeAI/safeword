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
import type * as OpenCodeProfile from '../../src/opencode/profile.js';
import { VERSION } from '../../src/version.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const profileState = vi.hoisted(() => ({ claude: false, codex: false }));
const packageManagerCalls = vi.hoisted(() => [] as string[]);

// This contract covers lifecycle output, not the state of the public registry.
vi.mock(import('node:child_process'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    execFileSync: ((...args: Parameters<typeof actual.execFileSync>) => {
      const [file] = args;
      if (/^(?:npm|npx|bun|bunx|yarn|pnpm)(?:\.cmd)?$/u.test(nodePath.basename(file))) {
        packageManagerCalls.push(file);
        throw new Error(`Lifecycle contract attempted a real package operation: ${file}`);
      }
      return actual.execFileSync(...args);
    }) as typeof actual.execFileSync,
  };
});

vi.mock(import('../../src/utils/install.js'), async importOriginal => {
  const actual = await importOriginal();
  const { VERSION: fixtureVersion } = await import('../../src/version.js');
  // Explicit requests keep range changes visible; fixed resolutions remove registry drift.
  const resolutions: Record<string, readonly [string, string]> = {
    'eslint@^10.0.0': ['eslint', '^10.9.1'],
    'jiti@^2.2.0': ['jiti', '^2.7.0'],
    safeword: ['safeword', `^${fixtureVersion}`],
    '@cucumber/cucumber': ['@cucumber/cucumber', '^13.2.1'],
    '@types/node': ['@types/node', '^26.4.1'],
    prettier: ['prettier', '^3.9.6'],
    tsx: ['tsx', '^4.23.13'],
  };

  function applyPackages(cwd: string, packages: string[], remove: boolean) {
    if (packages.length === 0) return { attempted: false, installed: false };
    const path = nodePath.join(cwd, 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    const dependencies = new Map<string, string>(Object.entries(manifest.devDependencies ?? {}));
    for (const request of packages) {
      if (remove) {
        expect(Object.values(resolutions).some(([name]) => name === request)).toBe(true);
        dependencies.delete(request);
      } else {
        const resolved = resolutions[request];
        if (!resolved) throw new Error(`Unmodeled lifecycle package request: ${request}`);
        dependencies.set(resolved[0], resolved[1]);
      }
    }
    manifest.devDependencies = Object.fromEntries(
      [...dependencies].toSorted(([left], [right]) => left.localeCompare(right)),
    );
    writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`);
    // Lifecycle effects include the lockfile, but its dependency graph is outside this contract.
    writeFileSync(
      nodePath.join(cwd, 'package-lock.json'),
      `${JSON.stringify({ devDependencies: manifest.devDependencies })}\n`,
    );
    return {
      attempted: true,
      installed: true,
      command: `npm ${remove ? 'uninstall' : 'install -D'} ${packages.join(' ')}`,
    };
  }

  return {
    ...actual,
    installDependencies: (cwd: string, packages: string[]) => applyPackages(cwd, packages, false),
    uninstallDependencies: (cwd: string, packages: string[]) => applyPackages(cwd, packages, true),
  };
});

vi.mock('../../src/opencode/profile.js', async importOriginal => ({
  ...(await importOriginal<typeof OpenCodeProfile>()),
  observeOpenCodeProfile: () => createResult({ state: 'healthy', data: { installed: false } }),
}));

vi.mock('../../src/opencode/conformance.js', () => ({ observeOpenCodeVersion: () => {} }));

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
const ORIGIN_MAIN_COMMIT = 'f22e2997ba8ef68d3d198ca2d937bfbf35fdab87';
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

// Scoped to one agent's own schema, so the three integrations drift independently.
// Editing a skill template moves only the codex and cursor digests: Claude loads skills
// from its native plugin cache, so `schemaForClaudeDelivery` drops `.claude/**` and the
// `.safeword/skills/**` copies belong to Cursor's delivery surface. Unchanged `claude-*`
// fixtures beside changed `codex-*`/`cursor-*` ones are therefore expected, not stale —
// Claude's skill delivery is covered by the plugin catalogue freshness check instead.
function treeDigest(root: string, agent: Integration): string {
  const hash = createHash('sha256');
  const token = (value: string): void => {
    hash.update(JSON.stringify(value));
  };
  const visit = (path: string): void => {
    const relative = nodePath.relative(root, path);
    const stat = lstatSync(path);
    token(relative);
    if (stat.isSymbolicLink()) {
      token(`link:${readlinkSync(path)}`);
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
    token(content);
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
    token(relative);
    if (existsSync(path)) visit(path);
    else token('missing');
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
  if (process.env.CI && process.env.SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES === '1') {
    throw new Error('Regenerate lifecycle fixtures locally, then verify without update mode.');
  }
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
  it('does not invoke a package manager through execFileSync', () => {
    expect(packageManagerCalls).toEqual([]);
  });

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
