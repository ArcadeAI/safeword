import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { hasSafewordProjectMarker, resolveNamespaceRoot } from './namespace-root.js';
import { nearestGitTree } from './project-directory.js';
import { commandWords, splitShellSegments } from './shell-segments.js';

const CLOSEOUT_BINDING_PREFIX = 'closeout-session-binding';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const CLOSEOUT_RUNTIMES = ['claude', 'codex', 'cursor'] as const;
const CLOSEOUT_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

interface CloseoutHandoff {
  schema_version: 1;
  profile_id: string;
  repository: string;
  pull_request: number;
  head_oid: string;
  written_at: string;
  expires_at: string;
}

function codexHome(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex');
}

function canonicalCodexHome(environment: NodeJS.ProcessEnv = process.env): string {
  const resolved = nodePath.resolve(codexHome(environment));
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function handoffDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(canonicalCodexHome(environment), 'safeword/closeout-handoff-v1');
}

function profileId(environment: NodeJS.ProcessEnv = process.env): string {
  return createHash('sha256').update(canonicalCodexHome(environment)).digest('hex');
}

function canonicalGithubRepository(value: string): string | undefined {
  const trimmed = value.trim();
  const scpMatch = /^git@github\.com:([^/]+)\/([^/]+)$/u.exec(trimmed);
  let owner: string | undefined;
  let repository: string | undefined;

  if (scpMatch) {
    [, owner, repository] = scpMatch;
  } else {
    try {
      const url = new URL(trimmed);
      if (url.hostname.toLowerCase() !== 'github.com') return undefined;
      [owner, repository] = url.pathname.split('/').filter(Boolean);
    } catch {
      return undefined;
    }
  }

  repository = repository?.replace(/\.git$/u, '');
  const validSegment = /^[a-z\d](?:[a-z\d._-]*[a-z\d])?$/iu;
  return owner && repository && validSegment.test(owner) && validSegment.test(repository)
    ? `${owner}/${repository}`.toLowerCase()
    : undefined;
}

function currentRepository(projectDirectory: string): string | undefined {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: projectDirectory,
    encoding: 'utf8',
    timeout: 5_000,
  });
  return result.status === 0 ? canonicalGithubRepository(result.stdout) : undefined;
}

function validHandoff(
  value: unknown,
  environment: NodeJS.ProcessEnv,
  now: number,
): value is CloseoutHandoff {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<CloseoutHandoff>;
  const writtenAt = Date.parse(record.written_at ?? '');
  const expiresAt = Date.parse(record.expires_at ?? '');
  return (
    record.schema_version === 1 &&
    record.profile_id === profileId(environment) &&
    typeof record.repository === 'string' &&
    /^[^/]+\/[^/]+$/u.test(record.repository) &&
    Number.isSafeInteger(record.pull_request) &&
    (record.pull_request ?? 0) > 0 &&
    typeof record.head_oid === 'string' &&
    /^[0-9a-f]{40}$/u.test(record.head_oid) &&
    Number.isFinite(writtenAt) &&
    writtenAt <= now &&
    expiresAt === writtenAt + CLOSEOUT_HANDOFF_TTL_MS &&
    now < expiresAt
  );
}

function removeExpiredHandoffRecords(
  path: string,
  environment: NodeJS.ProcessEnv,
  now: number,
): void {
  const directory = nodePath.dirname(path);
  const basename = nodePath.basename(path);
  for (const name of readdirSync(directory)) {
    if (name !== basename && !name.startsWith(`${basename}.claim-`)) continue;
    const candidatePath = nodePath.join(directory, name);
    try {
      const parsed = JSON.parse(readFileSync(candidatePath, 'utf8')) as unknown;
      if (!validHandoff(parsed, environment, now)) rmSync(candidatePath, { force: true });
    } catch {
      // Unknown or unreadable records remain inert for manual inspection.
    }
  }
}

export function recordCodexCloseoutHandoff(input: {
  projectDirectory: string;
  repositoryUrl: string;
  pullRequest: number;
  headOid: string;
  environment?: NodeJS.ProcessEnv;
  now?: Date;
}): boolean {
  const environment = input.environment ?? process.env;
  if (!environment.CODEX_HOME && !environment.CODEX_THREAD_ID) return false;
  const repository = canonicalGithubRepository(input.repositoryUrl);
  if (
    !repository ||
    currentRepository(input.projectDirectory) !== repository ||
    !Number.isSafeInteger(input.pullRequest) ||
    input.pullRequest <= 0 ||
    !/^[0-9a-f]{40}$/u.test(input.headOid)
  )
    return false;
  const directory = handoffDirectory(environment);
  const path = nodePath.join(
    directory,
    `${createHash('sha256').update(repository).digest('hex')}.json`,
  );
  const now = input.now ?? new Date();
  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    removeExpiredHandoffRecords(path, environment, now.getTime());
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({
        schema_version: 1,
        profile_id: profileId(environment),
        repository,
        pull_request: input.pullRequest,
        head_oid: input.headOid,
        written_at: now.toISOString(),
        expires_at: new Date(now.getTime() + CLOSEOUT_HANDOFF_TTL_MS).toISOString(),
      } satisfies CloseoutHandoff)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    renameSync(temporaryPath, path);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function claimCodexCloseoutHandoff(input: {
  projectDirectory: string;
  sessionId: string;
  environment?: NodeJS.ProcessEnv;
  now?: Date;
}): CloseoutHandoff | undefined {
  const environment = input.environment ?? process.env;
  if (!environment.CODEX_HOME && !environment.CODEX_THREAD_ID) return undefined;
  const repository = currentRepository(input.projectDirectory);
  if (!repository || input.sessionId.trim() === '') return undefined;
  const directory = handoffDirectory(environment);
  if (!existsSync(directory)) return undefined;
  const now = (input.now ?? new Date()).getTime();
  const matches: Array<{ handoff: CloseoutHandoff; path: string }> = [];
  for (const name of readdirSync(directory)) {
    if (!name.endsWith('.json')) continue;
    const path = nodePath.join(directory, name);
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
      if (!validHandoff(parsed, environment, now) || parsed.repository !== repository) continue;
      matches.push({ handoff: parsed, path });
    } catch {
      continue;
    }
  }
  if (matches.length !== 1) return undefined;
  const match = matches[0];
  if (match === undefined) return undefined;
  return match.handoff;
}

export interface CloseoutBinding {
  runtime: 'claude' | 'codex' | 'cursor';
  id: string;
  projectRoot: string;
  transcriptPath?: string;
}

/** Resolve one exact Codex transcript from the hook's host-owned environment. */
export function resolveExactCodexTranscript(
  id: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const sessionId = nonEmptyString(id);
  if (sessionId === undefined) return undefined;
  const root = nodePath.join(codexHome(env), 'sessions');
  try {
    if (!existsSync(root)) return undefined;
    const matches: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = nodePath.join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (
          entry.isFile() &&
          entry.name.endsWith('.jsonl') &&
          entry.name.endsWith(`${sessionId}.jsonl`)
        ) {
          matches.push(path);
        }
      }
    };
    visit(root);
    return matches.length === 1 ? matches[0] : undefined;
  } catch {
    return undefined;
  }
}

interface CloseoutBindingCache extends CloseoutBinding {
  recordedAt: string;
}

interface RememberCloseoutBindingInput {
  projectDirectory: string;
  runtime: CloseoutBinding['runtime'];
  id: string | undefined;
  transcriptPath?: string;
  now?: Date;
}

interface ReadFreshCloseoutBindingInput {
  projectDirectory: string;
  now?: Date;
  maxAgeMs?: number;
}

function nonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isCloseoutRuntime(value: unknown): value is CloseoutBinding['runtime'] {
  return CLOSEOUT_RUNTIMES.some(runtime => runtime === value);
}

function parseFreshBindingRecord(
  line: string,
  now: number,
  maxAgeMs: number,
): CloseoutBinding | undefined {
  try {
    const parsed = JSON.parse(line) as Partial<CloseoutBindingCache>;
    const id = nonEmptyString(parsed.id);
    const recordedAt = Date.parse(parsed.recordedAt ?? '');
    if (
      id === undefined ||
      !isCloseoutRuntime(parsed.runtime) ||
      !Number.isFinite(recordedAt) ||
      recordedAt > now ||
      now - recordedAt > maxAgeMs
    ) {
      return undefined;
    }
    const projectRoot = nonEmptyString(parsed.projectRoot);
    if (projectRoot === undefined) return undefined;
    const transcriptPath = nonEmptyString(parsed.transcriptPath);
    return {
      runtime: parsed.runtime,
      id,
      projectRoot,
      ...(transcriptPath === undefined ? {} : { transcriptPath }),
    };
  } catch {
    return undefined;
  }
}

function isCloseoutCleanupPath(
  token: string | undefined,
  pluginRoot?: string,
  projectDirectory?: string,
): boolean {
  if (token === undefined) return false;
  const normalized = token.replaceAll('"', '').replaceAll('\\', '/');
  const pluginPath = pluginRoot
    ? nodePath.join(pluginRoot, 'resources/scripts/closeout-cleanup.ts').replaceAll('\\', '/')
    : undefined;
  const projectRelativePath = ['.safeword', 'scripts', 'closeout-cleanup.ts'].join('/');
  const projectPath = projectDirectory
    ? nodePath
        .join(projectDirectory, '.safeword', 'scripts', 'closeout-cleanup.ts')
        .replaceAll('\\', '/')
    : undefined;
  const projectSuffix = `/${projectRelativePath}`;
  let resolvesInsideProject = false;
  if (projectDirectory && normalized.endsWith(projectSuffix)) {
    const candidateRoot = normalized.slice(0, -projectSuffix.length);
    try {
      resolvesInsideProject = realpathSync(candidateRoot) === realpathSync(projectDirectory);
    } catch {
      resolvesInsideProject = false;
    }
  }
  return (
    normalized === projectRelativePath ||
    normalized === projectPath ||
    resolvesInsideProject ||
    normalized === '${CLAUDE_PLUGIN_ROOT}/resources/scripts/closeout-cleanup.ts' ||
    normalized === pluginPath
  );
}

/** True only when an executable shell segment runs a recognized closeout-guard path. */
export function commandInvokesCloseoutCleanup(
  command: string,
  pluginRoot: string | undefined = process.env.CLAUDE_PLUGIN_ROOT,
  projectDirectory: string | undefined = process.cwd(),
): boolean {
  return splitShellSegments(command).some(segment => {
    const words = commandWords(segment);
    return (
      nodePath.basename(words[0] ?? '') === 'bun' &&
      isCloseoutCleanupPath(words[1], pluginRoot, projectDirectory)
    );
  });
}

/**
 * The binding file for one working tree. Worktrees can share an absolute configured namespace
 * root, and the reader claims and deletes its whole file, so each tree gets its own name.
 */
function closeoutBindingPath(projectDirectory: string): string {
  const tree = createHash('sha256').update(realpathSync(projectDirectory)).digest('hex');
  return nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    `${CLOSEOUT_BINDING_PREFIX}-${tree.slice(0, 16)}.json`,
  );
}

/**
 * Shell words with no expansion or control characters. Only the script word may name the plugin
 * root, as the plugin's closeout command does; a `cd` path never expands anything.
 */
const DIRECTORY_WORD = String.raw`(?:[^\s$\x60~*?[\]{}()'"\\;&|<>]|"[^"$\x60\\]*")+`;
const SCRIPT_WORD = String.raw`(?:[^\s$\x60~*?[\]{}()'"\\;&|<>]|"(?:\$\{CLAUDE_PLUGIN_ROOT\}|[^"$\x60\\])*")+`;

/**
 * The only command shapes that run closeout with a binding: `bun <script> <plain args>`, optionally
 * after one `cd <plain absolute path> &&` (a relative path could resolve through CDPATH). Shell has too many ways to change or fork a directory (pipes,
 * background jobs, subshells, `env -C`, `pushd`) for a hook to follow them reliably, so any other
 * shape that runs closeout is denied with a recovery the agent can follow at once.
 */
// eslint-disable-next-line security/detect-non-literal-regexp -- built only from the constant above
const CLOSEOUT_COMMAND = new RegExp(
  String.raw`^\s*(?:cd\s+(?="?\/)(?<directory>${DIRECTORY_WORD})\s*&&\s*)?bun\s+(?<script>${SCRIPT_WORD})(?:\s+[\w./:=@+-]+)*\s*$`,
  'u',
);

/**
 * Programs that only read files. Any other program whose command names the closeout script is
 * treated as running it, so an unrecognized wrapper (`exec`, `time`, `bun run`) is denied with the
 * recovery rather than allowed without a binding.
 */
const FILE_READERS = new Set([
  'cat',
  'less',
  'more',
  'head',
  'tail',
  'grep',
  'egrep',
  'rg',
  'sed',
  'awk',
  'wc',
  'ls',
  'stat',
  'file',
  'diff',
  'git',
  'echo',
  'printf',
  'shasum',
  'sha256sum',
  'md5',
  'code',
  'open',
]);

export type CloseoutBindingTarget =
  { kind: 'tree'; projectDirectory: string } | { kind: 'unresolved' };

/**
 * Where a closeout command will run, so its binding lands where closeout reads it: the git working
 * tree of the shell cwd, or of a leading `cd <plain path>`. Closeout reads its binding from
 * `git rev-parse --show-toplevel` of its own cwd. `unresolved` means the command runs a closeout
 * script in any other shape or through any program but `bun`, or runs one other than this
 * project's or the plugin's. Returns undefined when the command runs no closeout script.
 */
export function closeoutBindingTarget(
  command: string,
  shellDirectory: string,
  pluginRoot: string | undefined = process.env.CLAUDE_PLUGIN_ROOT,
): CloseoutBindingTarget | undefined {
  const runsCloseoutScript = splitShellSegments(command).some(segment => {
    const words = commandWords(segment).map(word => word.replaceAll('"', '').replaceAll("'", ''));
    return (
      !FILE_READERS.has(nodePath.basename(words[0] ?? '')) &&
      words.some(word => word.endsWith('closeout-cleanup.ts'))
    );
  });
  if (!runsCloseoutScript) return undefined;
  const match = CLOSEOUT_COMMAND.exec(command);
  if (!match?.groups?.script) return { kind: 'unresolved' };
  const directory = match.groups.directory
    ? nodePath.resolve(shellDirectory, match.groups.directory.replaceAll('"', ''))
    : shellDirectory;
  const tree = nearestGitTree(directory) ?? directory;
  return isCloseoutCleanupPath(match.groups.script, pluginRoot, tree)
    ? { kind: 'tree', projectDirectory: tree }
    : { kind: 'unresolved' };
}

/** The plain recovery for a closeout command whose working tree the hook cannot tell. */
export const CLOSEOUT_UNRESOLVED_DIRECTORY_MESSAGE =
  'Closeout must confirm this session in the worktree it runs in, so it runs only as its own ' +
  "command with the worktree's own script, optionally after one `cd <absolute path> &&`: " +
  '`bun .safeword/scripts/closeout-cleanup.ts --pr <number>`. Run it that way.';

export function rememberCloseoutBinding(input: RememberCloseoutBindingInput): boolean {
  const id = nonEmptyString(input.id);
  if (id === undefined || !hasSafewordProjectMarker(input.projectDirectory)) return false;
  const transcriptPath = nonEmptyString(input.transcriptPath);
  try {
    const cachePath = closeoutBindingPath(input.projectDirectory);
    mkdirSync(nodePath.dirname(cachePath), { recursive: true });
    appendFileSync(
      cachePath,
      `${JSON.stringify({
        runtime: input.runtime,
        id,
        projectRoot: realpathSync(input.projectDirectory),
        ...(transcriptPath === undefined ? {} : { transcriptPath }),
        recordedAt: (input.now ?? new Date()).toISOString(),
      } satisfies CloseoutBindingCache)}\n`,
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
}

export function readFreshCloseoutBinding(
  input: ReadFreshCloseoutBindingInput,
): CloseoutBinding | undefined {
  let cachePath: string;
  try {
    cachePath = closeoutBindingPath(input.projectDirectory);
  } catch {
    return undefined;
  }
  if (!existsSync(cachePath)) return undefined;
  const claimPath = `${cachePath}.claim-${randomUUID()}`;
  try {
    // rename(2) is atomic within this directory: concurrent closeout commands
    // cannot both consume the same short-lived host-session proof.
    renameSync(cachePath, claimPath);
    const now = (input.now ?? new Date()).getTime();
    const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const candidates = readFileSync(claimPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => {
        const candidate = parseFreshBindingRecord(line, now, maxAgeMs);
        return candidate === undefined ? [] : [candidate];
      });
    const currentProjectRoot = realpathSync(input.projectDirectory);
    const distinctCandidates = [
      ...new Map(
        candidates
          .filter(candidate => candidate.projectRoot === currentProjectRoot)
          .map(candidate => [
            `${candidate.runtime}\0${candidate.id}\0${candidate.projectRoot}`,
            candidate,
          ]),
      ).values(),
    ];
    const candidate = distinctCandidates.length === 1 ? distinctCandidates[0] : undefined;
    return candidate;
  } catch {
    return undefined;
  } finally {
    rmSync(claimPath, { force: true });
  }
}
