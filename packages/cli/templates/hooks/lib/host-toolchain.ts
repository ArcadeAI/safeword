import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

declare const Bun: {
  spawn(options: {
    cmd: string[];
    cwd: string;
    env: Record<string, string>;
    stdout: 'pipe';
    stderr: 'pipe';
  }): {
    exited: Promise<number>;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
  };
};

const BIOME_CONFIG_FILES = ['biome.json', 'biome.jsonc', '.biome.json', '.biome.jsonc'];
type HostToolchainOwner = 'ultracite' | 'biome';

export type HostToolchain =
  | { kind: 'ultracite'; cwd: string; executable: string; relativeFile: string }
  | { kind: 'biome'; cwd: string; executable: string; relativeFile: string }
  | { kind: 'unavailable'; owner: HostToolchainOwner; cwd: string }
  | { kind: 'outside-root'; file: string; root: string };

export interface HostToolchainResult {
  warnings: string[];
  errors?: string;
}

function isWithin(pathname: string, root: string): boolean {
  const relative = path.relative(root, pathname);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function canonical(pathname: string): string | undefined {
  try {
    return realpathSync(pathname);
  } catch {
    return undefined;
  }
}

function readOwner(directory: string, root: string): HostToolchainOwner | undefined {
  const configPath = BIOME_CONFIG_FILES.map(name => path.join(directory, name)).find(existsSync);
  if (!configPath) return undefined;
  const resolvedConfig = canonical(configPath);
  if (!resolvedConfig || !isWithin(resolvedConfig, root)) return undefined;
  try {
    const parse =
      (globalThis as { Bun?: { JSONC?: { parse?: (source: string) => unknown } } }).Bun?.JSONC
        ?.parse ?? JSON.parse;
    const config = parse(readFileSync(configPath, 'utf8')) as {
      extends?: string | string[];
    };
    const presets = Array.isArray(config.extends) ? config.extends : [config.extends];
    return presets.some(
      preset =>
        typeof preset === 'string' &&
        (preset === 'ultracite/core' || preset.startsWith('ultracite/biome/')),
    )
      ? 'ultracite'
      : 'biome';
  } catch {
    // A contained config still owns this directory even when malformed. Let its
    // local Biome command run from the nearest workspace so it surfaces the
    // configuration diagnostic instead of silently falling back to a parent.
    return 'biome';
  }
}

function findLocalExecutable(
  owner: HostToolchainOwner,
  directory: string,
  root: string,
): string | undefined {
  let current = directory;
  while (isWithin(current, root)) {
    const candidate = path.join(current, 'node_modules', '.bin', owner);
    const resolved = canonical(candidate);
    if (resolved && isWithin(resolved, root)) return resolved;
    if (current === root) return undefined;
    current = path.dirname(current);
  }
  return undefined;
}

/** Resolve a file's nearest Biome-backed owner, bounded by canonical project root. */
export function resolveHostToolchain(file: string, projectRoot: string): HostToolchain | undefined {
  const root = canonical(projectRoot);
  const resolvedFile = canonical(file);
  if (!root || !resolvedFile) return undefined;
  if (!isWithin(resolvedFile, root)) return { kind: 'outside-root', file: resolvedFile, root };

  let directory = path.dirname(resolvedFile);
  while (isWithin(directory, root)) {
    const owner = readOwner(directory, root);
    if (owner) {
      const executable = findLocalExecutable(owner, directory, root);
      if (!executable) return { kind: 'unavailable', owner, cwd: directory };
      return {
        kind: owner,
        cwd: directory,
        executable,
        relativeFile: path.relative(directory, resolvedFile),
      };
    }
    if (directory === root) return undefined;
    directory = path.dirname(directory);
  }
  return undefined;
}

function sanitizedEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete environment.BIOME_CONFIG_PATH;
  delete environment.BIOME_BINARY;
  return environment;
}

async function runCommand(command: string[], cwd: string): Promise<string | undefined> {
  const process_ = Bun.spawn({
    cmd: command,
    cwd,
    env: sanitizedEnvironment(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if ((await process_.exited) === 0) return undefined;
  const output =
    `${await new Response(process_.stdout).text()}${await new Response(process_.stderr).text()}`.trim();
  return output || `${command[0]} exited unsuccessfully`;
}

/** Run the selected owner without PATH lookup, shell evaluation, or inherited Biome overrides. */
export async function runHostToolchain(
  owner: Extract<HostToolchain, { kind: 'ultracite' | 'biome' }>,
): Promise<HostToolchainResult> {
  const commands =
    owner.kind === 'ultracite'
      ? [
          ['fix', '--', owner.relativeFile],
          ['check', '--', owner.relativeFile],
        ]
      : [
          ['check', '--write', '--', owner.relativeFile],
          ['check', '--', owner.relativeFile],
        ];
  for (const arguments_ of commands) {
    const errors = await runCommand([owner.executable, ...arguments_], owner.cwd);
    if (errors) return { warnings: [], errors };
  }
  return { warnings: [] };
}
