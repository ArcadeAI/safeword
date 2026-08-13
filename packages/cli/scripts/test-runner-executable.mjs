import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

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
