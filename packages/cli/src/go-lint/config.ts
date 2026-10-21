import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { parse as parseToml } from 'smol-toml';
import YAML from 'yaml';

import { GO_LINT_MANAGED_CONFIG_PATH } from '../packs/golang/files.js';
import { GOLANGCI_CONFIG_FILES } from '../utils/project-detector.js';

type Config = Record<string, unknown>;
export interface GoLintConfig {
  args: string[];
  base: string;
  source?: string;
  temporary?: string;
  textReport?: string;
  cleanup: () => void;
}

function record(value: unknown): value is Config {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function section(value: Config, name: string): Config {
  const existing = value[name];
  if (existing === undefined) {
    const empty: Config = {};
    value[name] = empty;
    return empty;
  }
  if (!record(existing)) throw new Error(`Go lint config ${name} must be an object`);
  return existing;
}

function lookupDirectory(directory: string): string | undefined {
  // Viper tries JSON, TOML, YAML, then YML within each search directory.
  const extensions = ['.json', '.toml', '.yaml', '.yml'];
  return GOLANGCI_CONFIG_FILES.toSorted(
    (a, b) => extensions.indexOf(path.extname(a)) - extensions.indexOf(path.extname(b)),
  )
    .map(name => path.join(directory, name))
    .find(existsSync);
}

function selectedConfig(file: string, root: string, originalCwd: string): string | undefined {
  const managed = path.join(root, GO_LINT_MANAGED_CONFIG_PATH);
  if (existsSync(managed)) return managed;
  const rootConfig = lookupDirectory(originalCwd);
  if (rootConfig) return rootConfig;
  let directory = path.dirname(file);
  for (;;) {
    const config = lookupDirectory(directory);
    if (config) return config;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return lookupDirectory(homedir());
}

function jsonScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function plainObject(value: object): boolean {
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (jsonScalar(value)) return;
  if (typeof value !== 'object' || value === null || ancestors.has(value)) {
    throw new Error('Go lint config contains a value that cannot be preserved in JSON');
  }
  if (!Array.isArray(value) && !plainObject(value)) {
    throw new Error('Go lint config contains an unsupported non-JSON object');
  }
  ancestors.add(value);
  for (const entry of Object.values(value)) assertJson(entry, ancestors);
  ancestors.delete(value);
}

/** Viper makes map keys case-insensitive; array elements retain their original values. */
function caseInsensitive(value: Config): Config {
  const result: Config = {};
  for (const [key, entry] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (Object.hasOwn(result, lower))
      throw new Error('Go lint config has ambiguous case-duplicate keys');
    Object.defineProperty(result, lower, {
      value: record(entry) ? caseInsensitive(entry) : entry,
      enumerable: true,
      writable: true,
    });
  }
  return result;
}

function parseConfig(file: string): Config {
  const text = readFileSync(file, 'utf8');
  let parsed: unknown;
  switch (path.extname(file)) {
    case '.json': {
      parsed = JSON.parse(text);
      break;
    }
    case '.toml': {
      parsed = parseToml(text);
      break;
    }
    default: {
      const document = YAML.parseDocument(text, { merge: true });
      if (document.errors.length > 0) throw new Error(document.errors[0]?.message);
      // go-yaml accepts legacy octals; YAML 1.2 would silently read these as decimal.
      YAML.visit(document, {
        Scalar(_key, node) {
          if (typeof node.value === 'number' && /^[-+]?0\d+$/.test(node.source ?? '')) {
            throw new Error(
              'Go lint config uses ambiguous legacy octal; use decimal or 0o notation',
            );
          }
        },
      });
      parsed = document.toJS({ maxAliasCount: 100 }) as unknown;
    }
  }
  assertJson(parsed);
  if (!record(parsed)) throw new Error('Go lint config must be an object');
  return caseInsensitive(parsed);
}

function query(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 10_000 });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Cannot resolve Go lint base: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
  const value = result.stdout.trim();
  if (!value) throw new Error(`Cannot resolve Go lint base: ${command} returned no path`);
  return value;
}

function originalBase(config: Config, source: string, cwd: string): string {
  const mode = section(config, 'run')['relative-path-mode'] ?? 'cfg';
  switch (mode) {
    case 'cfg': {
      return path.dirname(source);
    }
    case 'wd': {
      return cwd;
    }
    case 'gitroot': {
      return query('git', ['rev-parse', '--show-toplevel'], cwd);
    }
    case 'gomod': {
      const manifest = query('go', ['env', 'GOMOD'], cwd);
      if (manifest === '/dev/null' || manifest.toUpperCase() === 'NUL') {
        throw new Error(
          'Cannot preserve gomod lint paths: the original working directory has no Go module',
        );
      }
      return path.dirname(manifest);
    }
    default: {
      throw new Error('Unsupported Go lint relative-path-mode; expected cfg, wd, gomod or gitroot');
    }
  }
}

function mapStrings(value: unknown, replace: (text: string) => string): unknown {
  if (typeof value === 'string') return replace(value);
  if (Array.isArray(value)) return value.map(entry => mapStrings(entry, replace));
  if (record(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, mapStrings(entry, replace)]),
    );
  }
  return value;
}

function normalizeDepguard(value: unknown, replace: (text: string) => string): void {
  if (!record(value) || !record(value.rules)) return;
  for (const rule of Object.values(value.rules)) {
    if (record(rule) && Array.isArray(rule.files)) rule.files = mapStrings(rule.files, replace);
  }
}

function normalizeGocritic(
  value: unknown,
  replace: (text: string) => string,
  absolute: (text: string) => string,
): void {
  if (!record(value) || !record(value.settings)) return;
  const checks = mapStrings(value.settings, replace) as Config;
  value.settings = checks;
  if (!record(checks.ruleguard) || typeof checks.ruleguard.rules !== 'string') return;
  checks.ruleguard.rules = checks.ruleguard.rules
    .split(',')
    .map(entry => absolute(entry.trim()))
    .join(',');
}

function normalizeGoheader(value: unknown, absolute: (text: string) => string): void {
  if (!record(value) || typeof value['template-path'] !== 'string' || !value['template-path'])
    return;
  value['template-path'] = absolute(value['template-path']);
}

function fileDestination(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value !== 'stdout' && value !== 'stderr';
}

function normalizeReports(config: Config, absolute: (text: string) => string): string | undefined {
  const output = section(config, 'output');
  const formats = section(output, 'formats');
  for (const format of Object.values(formats)) {
    if (record(format) && fileDestination(format.path)) format.path = absolute(format.path);
  }
  const text = section(formats, 'text');
  const report = fileDestination(text.path) ? text.path : undefined;
  text.path = 'stdout';
  text.colors = false;
  return report;
}

function normalizeLocations(
  config: Config,
  source: string,
  base: string,
  cwd: string,
  configPathSupported: boolean,
): string | undefined {
  const replace = (text: string): string =>
    (configPathSupported
      ? text.replaceAll('${config-path}', () => path.dirname(source))
      : text
    ).replaceAll('${base-path}', () => base);
  const absolute = (text: string): string => path.resolve(cwd, replace(text));
  const linters = config.linters;
  if (record(linters) && record(linters.settings)) {
    const settings = linters.settings;
    normalizeDepguard(settings.depguard, replace);
    normalizeGocritic(settings.gocritic, replace, absolute);
    normalizeGoheader(settings.goheader, absolute);
  }
  return normalizeReports(config, absolute);
}

function writeTemporary(file: string, content: string): void {
  let owned = false;
  try {
    const descriptor = openSync(file, 'wx', 0o600);
    owned = true;
    try {
      writeFileSync(descriptor, content);
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (owned) {
      try {
        unlinkSync(file);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Go lint temporary config creation and cleanup failed',
          { cause: cleanupError },
        );
      }
    }
    throw error;
  }
}

/** Freeze policy paths before changing the package loader's working directory. */
export function prepareGoLintConfig(
  file: string,
  root: string,
  cwd: string,
  configPathSupported = true,
): GoLintConfig {
  const source = selectedConfig(file, root, cwd);
  if (!source)
    return {
      args: ['--no-config'],
      base: path.dirname(file),
      cleanup: () => {
        /* No temporary config exists in --no-config mode. */
      },
    };
  const config = parseConfig(source);
  const base = path.resolve(cwd, originalBase(config, source, cwd));
  const textReport = normalizeLocations(config, source, base, cwd, configPathSupported);
  section(config, 'run')['relative-path-mode'] = 'cfg';
  const temporary = path.join(base, `.safeword-go-lint-${randomUUID()}.json`);
  writeTemporary(temporary, JSON.stringify(config));
  let removed = false;
  return {
    args: ['--config', temporary],
    source,
    temporary,
    base,
    textReport,
    cleanup() {
      if (removed) {
        return;
      }

      unlinkSync(temporary);
      removed = true;
    },
  };
}
