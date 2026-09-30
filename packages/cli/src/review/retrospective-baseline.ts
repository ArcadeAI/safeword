import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

export interface BaselineBlobClaim {
  readonly baselinePath: string;
  readonly currentPath: string;
  readonly blobSha: string;
  readonly currentBlobSha?: string;
  readonly baselineExcerpts?: readonly string[];
  readonly currentExcerpts?: readonly string[];
}

export interface BaselineBlobResult {
  readonly valid: boolean;
  readonly reason?: string;
}

const SHA = /^[\da-f]{40}$/u;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    if ((character.codePointAt(0) ?? 0) < 32) return true;
  }
  return false;
}

function validRelativePath(path: string): boolean {
  return (
    path !== '' &&
    !nodePath.posix.isAbsolute(path) &&
    !path.includes('\\') &&
    !hasControlCharacter(path) &&
    path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  );
}

function git(projectRoot: string, args: string[]): { status: number | null; stdout: string } {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  const result = spawnSync(
    'git',
    ['--no-replace-objects', '--literal-pathspecs', '-C', projectRoot, ...args],
    {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: environment,
    },
  );
  return { status: result.status, stdout: result.stdout ?? '' };
}

function currentFileInside(root: string, relativePath: string): boolean {
  try {
    const canonicalRoot = realpathSync.native(root);
    let cursor = canonicalRoot;
    for (const component of relativePath.split('/')) {
      cursor = nodePath.join(cursor, component);
      if (lstatSync(cursor).isSymbolicLink()) return false;
    }
    const canonicalFile = realpathSync.native(cursor);
    const relative = nodePath.relative(canonicalRoot, canonicalFile);
    return (
      relative !== '..' &&
      !relative.startsWith(`..${nodePath.sep}`) &&
      !nodePath.isAbsolute(relative) &&
      lstatSync(canonicalFile).isFile()
    );
  } catch {
    return false;
  }
}

function committedBlob(projectRoot: string, baseline: string, path: string): string | undefined {
  const result = git(projectRoot, ['ls-tree', '-z', baseline, '--', path]);
  if (result.status !== 0) return undefined;
  const [entry, extra] = result.stdout.split('\0', 2);
  if (entry === undefined || extra !== '') return undefined;
  const [metadata, treePath] = entry.split('\t', 2);
  if (treePath !== path) return undefined;
  return regularBlobSha(metadata);
}

function regularBlobSha(metadata: string | undefined): string | undefined {
  const [mode, type, sha] = metadata?.split(' ') ?? [];
  if (mode !== '100644' && mode !== '100755') return undefined;
  return type === 'blob' && SHA.test(sha ?? '') ? sha : undefined;
}

function excerptError(
  projectRoot: string,
  baseline: string,
  claim: BaselineBlobClaim,
): string | undefined {
  if (claim.baselineExcerpts !== undefined) {
    if (claim.baselineExcerpts.length === 0 || claim.baselineExcerpts.some(excerpt => !excerpt))
      return `Baseline excerpts for ${claim.baselinePath} are missing.`;
    const source = git(projectRoot, ['show', `${baseline}:${claim.baselinePath}`]);
    if (
      source.status !== 0 ||
      claim.baselineExcerpts.some(excerpt => !source.stdout.includes(excerpt))
    )
      return `Baseline excerpts for ${claim.baselinePath} do not match Git.`;
  }
  if (claim.currentExcerpts !== undefined) {
    if (claim.currentExcerpts.length === 0 || claim.currentExcerpts.some(excerpt => !excerpt))
      return `Current excerpts for ${claim.currentPath} are missing.`;
    const source = readFileSync(nodePath.join(projectRoot, claim.currentPath), 'utf8');
    if (claim.currentExcerpts.some(excerpt => !source.includes(excerpt)))
      return `Current excerpts for ${claim.currentPath} do not match the file.`;
  }
  return undefined;
}

function claimError(
  projectRoot: string,
  baseline: string,
  claim: BaselineBlobClaim,
): string | undefined {
  if (!validRelativePath(claim.baselinePath) || !validRelativePath(claim.currentPath))
    return 'An implementation path is not a safe project-relative path.';
  if (!currentFileInside(projectRoot, claim.currentPath))
    return `Current implementation file ${claim.currentPath} is unavailable.`;
  if (claim.currentBlobSha !== undefined) {
    const current = git(projectRoot, ['hash-object', '--', claim.currentPath]);
    if (
      !SHA.test(claim.currentBlobSha) ||
      current.status !== 0 ||
      current.stdout.trim() !== claim.currentBlobSha
    )
      return `Current blob ${claim.currentPath} does not match its claimed digest.`;
  }
  if (
    !SHA.test(claim.blobSha) ||
    committedBlob(projectRoot, baseline, claim.baselinePath) !== claim.blobSha
  )
    return `Baseline blob ${claim.baselinePath} does not match its claimed digest.`;
  return excerptError(projectRoot, baseline, claim);
}

/** Blob identity and path containment only; an independent reviewer judges historical behavior. */
export function validateBaselineBlobClaims(
  projectRoot: string,
  baseline: string,
  claims: readonly BaselineBlobClaim[],
): BaselineBlobResult {
  const deny = (reason: string): BaselineBlobResult => ({ valid: false, reason });
  if (!SHA.test(baseline)) return deny('The baseline must be a full lowercase commit SHA.');
  if (git(projectRoot, ['cat-file', '-t', baseline]).stdout.trim() !== 'commit')
    return deny('The baseline commit is unavailable.');
  if (claims.length === 0) return deny('No baseline implementation blobs were named.');
  const baselinePaths = new Set<string>();
  const currentPaths = new Set<string>();
  for (const claim of claims) {
    if (baselinePaths.has(claim.baselinePath) || currentPaths.has(claim.currentPath))
      return deny('Implementation paths must have a one-to-one baseline-to-current mapping.');
    baselinePaths.add(claim.baselinePath);
    currentPaths.add(claim.currentPath);
    const error = claimError(projectRoot, baseline, claim);
    if (error !== undefined) return deny(error);
  }
  return { valid: true };
}
