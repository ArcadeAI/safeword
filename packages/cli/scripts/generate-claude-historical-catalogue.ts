import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

import { normalizeSafewordHookCommands } from '../src/utils/hooks.js';

interface ReleaseRecord {
  files: Record<string, string>;
  hooks: Record<string, string[]>;
}

const root = nodePath.resolve(import.meta.dirname, '../../..');
const outputPath = nodePath.join(
  root,
  'packages/cli/src/claude-plugin/historical-catalogue.generated.ts',
);

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function supportedTag(tag: string): boolean {
  const [version, prerelease, extra] = tag.slice(1).split('-', 3);
  const [major, minor, patch, extraVersion] = version?.split('.', 4) ?? [];
  return [
    major === '0',
    ['68', '69', '70', '71', '72'].includes(minor ?? ''),
    patch !== undefined && String(Number(patch)) === patch,
    extraVersion === undefined,
    prerelease === undefined || /^rc\.\d+$/u.test(prerelease),
    extra === undefined,
  ].every(Boolean);
}

function supportedTags(): string[] {
  return git('tag', '--list', 'v0.*', '--sort=version:refname')
    .trim()
    .split('\n')
    .filter(tag => supportedTag(tag));
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function compareKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => compareKeys(left, right))
      .map(([key, child]) => [key, stable(child)]),
  );
}

async function hooksFromSource(source: string, label: string): Promise<Record<string, unknown[]>> {
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText;
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-catalogue-'));
  const modulePath = nodePath.join(temporary, `${label.replaceAll(/[^\w.-]/gu, '-')}.mjs`);
  writeFileSync(modulePath, javascript);
  let loaded: { SETTINGS_HOOKS?: Record<string, unknown[]> };
  try {
    loaded = (await import(pathToFileURL(modulePath).href)) as typeof loaded;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  if (loaded.SETTINGS_HOOKS === undefined) {
    throw new Error(`${label} does not export SETTINGS_HOOKS`);
  }
  return Object.fromEntries(
    Object.entries(loaded.SETTINGS_HOOKS).map(([event, entries]) => [
      event,
      entries.map(entry => stable(entry)),
    ]),
  );
}

function filesFromSchema(
  schema: string,
  readTemplate: (templatePath: string) => string,
): Record<string, string> {
  const files: Record<string, string> = {};
  const entries = schema.matchAll(
    /['"](\.claude\/[^'"]+)['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]/gu,
  );
  for (const match of entries) {
    const [, installedPath, templatePath] = match;
    if (installedPath === undefined || templatePath === undefined) continue;
    const content = readTemplate(templatePath);
    files[installedPath] = sha256(content);
  }
  return Object.fromEntries(
    Object.entries(files).toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

async function main(): Promise<void> {
  const releases: Record<string, ReleaseRecord> = {};
  const hookEntries: Record<string, unknown> = {};
  const fingerprintHooks = (hooks: Record<string, unknown[]>): Record<string, string[]> =>
    Object.fromEntries(
      Object.entries(hooks).map(([event, entries]) => [
        event,
        entries.map(entry => {
          const canonical = JSON.stringify(stable(normalizeSafewordHookCommands(entry)));
          const fingerprint = sha256(canonical);
          hookEntries[fingerprint] = entry;
          return fingerprint;
        }),
      ]),
    );
  for (const tag of supportedTags()) {
    const hooks = await hooksFromSource(
      git('show', `${tag}:packages/cli/src/templates/config.ts`),
      tag,
    );
    releases[tag.slice(1)] = {
      files: filesFromSchema(git('show', `${tag}:packages/cli/src/schema.ts`), path =>
        git('show', `${tag}:packages/cli/templates/${path}`),
      ),
      hooks: fingerprintHooks(hooks),
    };
  }
  if (['0.68.0', '0.69.0', '0.72.0'].some(version => releases[version] === undefined)) {
    throw new Error('Required Claude legacy fixture tags are missing.');
  }
  const currentConfig = readFileSync(
    nodePath.join(root, 'packages/cli/src/templates/config.ts'),
    'utf8',
  );
  const current = {
    files: filesFromSchema(
      readFileSync(nodePath.join(root, 'packages/cli/src/schema.ts'), 'utf8'),
      path => readFileSync(nodePath.join(root, 'packages/cli/templates', path), 'utf8'),
    ),
    hooks: fingerprintHooks(await hooksFromSource(currentConfig, 'current')),
  };
  const serialized = JSON.stringify(
    {
      schema_version: 1,
      current,
      releases,
      hook_entries: Object.fromEntries(
        Object.entries(hookEntries).toSorted(([left], [right]) => left.localeCompare(right)),
      ),
    },
    undefined,
    2,
  );
  const unformatted = `// Generated by scripts/generate-claude-historical-catalogue.ts. Do not edit.\nexport const CLAUDE_HISTORICAL_CATALOGUE = ${serialized} as const;\n`;
  const content = await format(unformatted, {
    ...(await resolveConfig(outputPath)),
    filepath: outputPath,
  });
  if (process.argv.includes('--check')) {
    const committed = readFileSync(outputPath, 'utf8');
    if (committed !== content) {
      const versions = Object.keys(releases).join(', ');
      throw new Error(
        `Claude historical catalogue is stale or incomplete for releases ${versions}; regenerate it to expose the exact release, path, and fingerprint diff.`,
      );
    }
    console.log(
      `Claude historical catalogue covers ${String(Object.keys(releases).length)} releases.`,
    );
    return;
  }
  writeFileSync(outputPath, content);
}

await main();
