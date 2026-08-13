import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

export function environmentPathKey(environment) {
  return Object.keys(environment).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
}

function windowsVitestCandidate(directory, name, nodeExecutable) {
  const candidate = nodePath.join(directory, name);
  if (!existsSync(candidate)) return false;
  if (name === 'vitest.exe') return { arguments: [], executable: candidate };
  if (name !== 'vitest.cmd') {
    return { arguments: [candidate], executable: nodeExecutable };
  }
  const moduleEntry = nodePath.resolve(directory, '..', 'vitest', 'vitest.mjs');
  return existsSync(moduleEntry) ? { arguments: [moduleEntry], executable: nodeExecutable } : false;
}

export function resolveWindowsVitest(searchPath, cliRoot, nodeExecutable = process.execPath) {
  const directories = searchPath.split(nodePath.delimiter).filter(Boolean);
  const names = ['vitest.exe', 'vitest.cmd', 'vitest.mjs', 'vitest.js'];
  const candidates = directories.flatMap(directory => names.map(name => ({ directory, name })));
  for (const { directory, name } of candidates) {
    const invocation = windowsVitestCandidate(directory, name, nodeExecutable);
    if (invocation) return invocation;
  }
  return {
    arguments: [nodePath.join(cliRoot, 'node_modules', 'vitest', 'vitest.mjs')],
    executable: nodeExecutable,
  };
}

export function resolveTestRunnerInvocation(
  command,
  args,
  environment,
  cliRoot,
  platform = process.platform,
) {
  if (platform !== 'win32' || command !== 'vitest') {
    return { arguments: args, executable: command };
  }
  const pathKey = environmentPathKey(environment);
  const windowsVitest = resolveWindowsVitest(environment[pathKey] ?? '', cliRoot);
  return {
    arguments: [...windowsVitest.arguments, ...args],
    executable: windowsVitest.executable,
  };
}
