import { link, mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

export interface DurableMutationFaults {
  beforeDirectorySync?: () => Promise<void>;
  beforeFileSync?: () => Promise<void>;
}

const durableDirectoryIdentities = new Map<string, string>();

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

export async function syncDirectoryDurable(
  directory: string,
  faults: DurableMutationFaults = {},
): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await faults.beforeDirectorySync?.();
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function mkdirDurable(
  root: string,
  directory: string,
  faults: DurableMutationFaults = {},
): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const resolvedDirectory = path.resolve(directory);
  const relative = path.relative(resolvedRoot, resolvedDirectory);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error('durable directory must be a descendant of its root');
  }
  await mkdir(resolvedDirectory, { recursive: true });
  const directoryStat = await stat(resolvedDirectory);
  const identity = `${String(directoryStat.dev)}:${String(directoryStat.ino)}`;
  if (durableDirectoryIdentities.get(resolvedDirectory) === identity) return;
  let parent = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    await syncDirectoryDurable(parent, faults);
    parent = path.join(parent, segment);
  }
  durableDirectoryIdentities.set(resolvedDirectory, identity);
}

export async function writeNewDurable(
  file: string,
  bytes: Buffer,
  faults: DurableMutationFaults = {},
): Promise<void> {
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await faults.beforeFileSync?.();
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function linkDurable(
  source: string,
  destination: string,
  faults: DurableMutationFaults = {},
): Promise<void> {
  await link(source, destination);
  await syncDirectoryDurable(path.dirname(destination), faults);
}

export async function renameDurable(
  source: string,
  destination: string,
  faults: DurableMutationFaults = {},
): Promise<void> {
  await rename(source, destination);
  await syncDirectoryDurable(path.dirname(destination), faults);
}

export async function unlinkDurable(
  file: string,
  faults: DurableMutationFaults = {},
): Promise<boolean> {
  try {
    await unlink(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
  await syncDirectoryDurable(path.dirname(file), faults);
  return true;
}
