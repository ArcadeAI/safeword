import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import nodePath from 'node:path';

export type MonitorSourceKey = 'claude-code' | 'codex-cli' | 'codex-project-plugins' | 'cursor';

export interface MonitorSource {
  key: MonitorSourceKey;
  label: string;
  platformEpic: string;
  snapshotPath: string;
  url: string;
  normalize(raw: string): string;
  /** Opening line of the filed issue. Defaults to changelog-drift wording. */
  headline?: string;
  /** Triage checklist for the filed issue. Defaults to the changelog checklist. */
  checklist?: readonly string[];
}

export interface SourceChangeInput {
  currentFetchedAt?: string;
  liveContent: string;
  snapshotContent: string;
  source: MonitorSource;
}

export interface SourceChange {
  changed: boolean;
  current: string;
  hash: string;
  previous: string;
  source: MonitorSource;
}

export interface IssuePayload {
  body: string;
  title: string;
}

export interface GitHubIssueClient {
  createIssue(payload: IssuePayload): Promise<number>;
  findOpenIssueByTitle(title: string): Promise<number | undefined>;
  updateIssue(issueNumber: number, payload: IssuePayload): Promise<void>;
}

export interface ReportResult {
  action: 'created' | 'updated';
  issueNumber: number;
}

export interface MonitorDependencies {
  fetchText(url: string): Promise<string>;
  issueClient: GitHubIssueClient;
  now(): Date;
  readText(path: string): Promise<string>;
  rootDirectory: string;
  sources?: readonly MonitorSource[];
  log?(message: string): void;
}

const SNAPSHOT_DIRECTORY = '.github/changelog-snapshots';

/** Triage prompts for a changelog-drift source, used when one defines no checklist. */
const CHANGELOG_RELEVANCE_CHECKLIST: readonly string[] = [
  '- [ ] Touches hooks lifecycle?',
  '- [ ] Touches skills/commands?',
  '- [ ] Touches settings/config schema?',
  '- [ ] Creates or closes a gate-bypass risk?',
  '- [ ] Needs Breaks / Adopt / Watch triage?',
];

const MONITOR_SOURCES: readonly MonitorSource[] = [
  {
    key: 'claude-code',
    label: 'Claude Code',
    platformEpic: '8R54HV',
    snapshotPath: `${SNAPSHOT_DIRECTORY}/claude-code.txt`,
    url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md',
    normalize: normalizeMarkdown,
  },
  {
    key: 'codex-cli',
    label: 'Codex CLI',
    platformEpic: 'QM5G9M',
    snapshotPath: `${SNAPSHOT_DIRECTORY}/codex-cli.txt`,
    url: 'https://github.com/openai/codex/releases.atom',
    normalize: normalizeReleaseAtom,
  },
  // Tripwire source (#1907): Safeword works around Codex having no
  // project-scoped plugin activation by gating every Codex hook on the
  // `.safeword/SAFEWORD.md` enrollment marker. Removal depends on this
  // upstream issue, which nothing in this repo would otherwise notice.
  // Complements the pinned-version tripwire in
  // packages/cli/tests/codex-project-scope-tripwire.test.ts: the pin fires when
  // we upgrade Codex, this fires when upstream moves. Either alone can sit
  // silently green.
  {
    key: 'codex-project-plugins',
    label: 'Codex project-scoped plugins (openai/codex#18115)',
    platformEpic: 'QM5G9M',
    snapshotPath: `${SNAPSHOT_DIRECTORY}/codex-project-plugins.txt`,
    url: 'https://api.github.com/repos/openai/codex/issues/18115',
    normalize: normalizeIssueState,
    headline:
      'The upstream issue behind a Safeword workaround changed state: **openai/codex#18115** (project-scoped plugin activation).',
    checklist: [
      '- [ ] Did project-scoped plugin activation actually ship, or was the issue closed as stale/duplicate?',
      '- [ ] If it shipped: is the `.safeword/SAFEWORD.md` enrollment marker still load-bearing as a scope substitute?',
      '- [ ] Reassess the `hasSafewordProjectMarker` guards, the packaged hook copies, and the ARCHITECTURE.md ADR "Explicit Project Enrollment for Profile-Scoped Codex Hooks".',
      '- [ ] If it shipped and the workaround is gone: delete `packages/cli/tests/codex-project-scope-tripwire.test.ts` and this monitor source.',
      '- [ ] If it did not ship: advance the snapshot and leave both tripwires in place.',
    ],
  },
  {
    key: 'cursor',
    label: 'Cursor',
    platformEpic: 'VAX3Z2',
    snapshotPath: `${SNAPSHOT_DIRECTORY}/cursor.txt`,
    url: 'https://cursor.com/changelog',
    normalize: normalizeCursorHtml,
  },
];

export function getMonitorSource(key: MonitorSourceKey): MonitorSource {
  const source = MONITOR_SOURCES.find(candidate => candidate.key === key);
  if (!source) {
    throw new Error(`Unknown monitor source: ${key}`);
  }
  return source;
}

function normalizeMarkdown(raw: string): string {
  return normalizeWhitespace(raw);
}

export function normalizeReleaseAtom(raw: string): string {
  const entries = atomEntryBlocks(raw).map(entry => {
    const title = decodeXml(titleText(entry));
    const updated = decodeXml(updatedText(entry));
    const link = decodeXml(linkHref(entry)) || decodeXml(linkText(entry));
    return [
      title,
      updated ? `Updated: ${updated}` : undefined,
      link ? `Link: ${link}` : undefined,
    ].filter((line): line is string => Boolean(line));
  });

  return entries
    .map(lines => lines.join('\n'))
    .join('\n\n')
    .trim();
}

/**
 * Reduce a GitHub issue API response to the only facts worth waking someone
 * for: whether it is still open, and how it was closed.
 *
 * Deliberately excludes title, body, labels, comment counts, and timestamps.
 * An upstream issue attracts comments and edits constantly; including any of
 * that turns a weekly watch into weekly noise, and a tripwire that cries wolf
 * gets its snapshot advanced without anyone reading the diff.
 */
export function normalizeIssueState(raw: string): string {
  const issue = JSON.parse(raw) as { state?: unknown; state_reason?: unknown };
  const state = typeof issue.state === 'string' ? issue.state : 'unknown';
  const reason = typeof issue.state_reason === 'string' ? issue.state_reason : 'none';
  return `state: ${state}\nstate_reason: ${reason}`;
}

export function normalizeCursorHtml(raw: string): string {
  const withoutScripts = raw
    .replaceAll(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const withBreaks = withoutScripts
    .replaceAll(/<\/(?:h[1-6]|p|li|article|section|div|main)>/gi, '\n')
    .replaceAll(/<br\s*\/?>/gi, '\n');
  const text = decodeHtml(stripTags(withBreaks));
  return normalizeWhitespace(text);
}

export function snapshotBody(snapshotContent: string): string {
  const trimmedStart = snapshotContent.trimStart();
  if (!trimmedStart.startsWith('---')) {
    return normalizeWhitespace(snapshotContent);
  }

  const withoutOpening = trimmedStart.slice(3);
  const closingIndex = withoutOpening.indexOf('\n---');
  if (closingIndex === -1) {
    return normalizeWhitespace(snapshotContent);
  }

  return normalizeWhitespace(withoutOpening.slice(closingIndex + '\n---'.length));
}

export function createSnapshotText(
  source: MonitorSource,
  normalizedContent: string,
  reviewedAt: string,
): string {
  return [
    '---',
    `source: ${source.url}`,
    `source_key: ${source.key}`,
    `reviewed_at: ${reviewedAt}`,
    '---',
    '',
    normalizeWhitespace(normalizedContent),
    '',
  ].join('\n');
}

export function detectSourceChange(input: SourceChangeInput): SourceChange {
  const current = normalizeWhitespace(input.liveContent);
  const previous = snapshotBody(input.snapshotContent);
  return {
    changed: current !== previous,
    current,
    hash: hashText(current),
    previous,
    source: input.source,
  };
}

export function buildIssuePayload(change: Omit<SourceChange, 'changed' | 'hash'>): IssuePayload {
  const diff = createBoundedDiff(change.previous, change.current);
  return {
    title: `[upstream-changelog] ${change.source.label} changed`,
    body: [
      change.source.headline ?? `Upstream changelog changed for **${change.source.label}**.`,
      '',
      `- Source: ${change.source.url}`,
      `- Snapshot: \`${change.source.snapshotPath}\``,
      `- Platform epic: \`${change.source.platformEpic}\``,
      '',
      '## Relevance Checklist',
      '',
      ...(change.source.checklist ?? CHANGELOG_RELEVANCE_CHECKLIST),
      '',
      '## Diff',
      '',
      '```diff',
      diff,
      '```',
      '',
      'Detection is read-only. Advance the snapshot in the review-closing PR after triage.',
    ].join('\n'),
  };
}

export async function reportSourceChange(
  client: GitHubIssueClient,
  payload: IssuePayload,
): Promise<ReportResult> {
  const existingIssue = await client.findOpenIssueByTitle(payload.title);
  if (existingIssue !== undefined) {
    await client.updateIssue(existingIssue, payload);
    return { action: 'updated', issueNumber: existingIssue };
  }

  const issueNumber = await client.createIssue(payload);
  return { action: 'created', issueNumber };
}

/**
 * Check one source. Returns the filed/updated issue, or undefined when the
 * source has not changed. Throws on fetch, read, or parse failure — the caller
 * owns isolation so one source cannot cancel the rest.
 */
async function checkSource(
  source: MonitorSource,
  dependencies: MonitorDependencies,
): Promise<ReportResult | undefined> {
  const raw = await dependencies.fetchText(source.url);
  const liveContent = source.normalize(raw);
  const snapshotPath = nodePath.join(dependencies.rootDirectory, source.snapshotPath);
  const snapshotContent = await dependencies.readText(snapshotPath);
  const change = detectSourceChange({ liveContent, snapshotContent, source });

  if (!change.changed) return undefined;

  return await reportSourceChange(
    dependencies.issueClient,
    buildIssuePayload({
      current: change.current,
      previous: change.previous,
      source,
    }),
  );
}

export interface MonitorRunResult {
  reported: number;
  failed: number;
}

export async function runUpstreamMonitor(
  dependencies: MonitorDependencies,
): Promise<MonitorRunResult> {
  const sources = dependencies.sources ?? MONITOR_SOURCES;
  let reported = 0;
  let failed = 0;

  for (const source of sources) {
    // Each source is an independent watch, so one must not be able to cancel
    // the others. A transient fetch error or a scraper broken by a third-party
    // markup change would otherwise abort the loop, and every source after it
    // — including the workaround tripwires, whose whole value is firing on the
    // week upstream moves — would go silently unchecked.
    try {
      const result = await checkSource(source, dependencies);

      if (!result) {
        dependencies.log?.(`${source.key}: no change`);
        continue;
      }

      reported += 1;
      dependencies.log?.(`${source.key}: ${result.action} issue #${result.issueNumber}`);
    } catch (error) {
      // Distinct from "no change" on purpose: an unchecked source is missing
      // evidence, not a clean bill of health. The caller exits non-zero so a
      // permanently broken watch shows up as a red run instead of a quiet log.
      failed += 1;
      dependencies.log?.(
        `${source.key}: check FAILED — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { reported, failed };
}

export function createGitHubIssueClient(options: {
  fetch: typeof fetch;
  owner: string;
  repo: string;
  token: string;
}): GitHubIssueClient {
  const baseUrl = 'https://api.github.com';
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${options.token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'safeword-upstream-changelog-monitor',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function request<T>(
    path: string,
    init: Pick<RequestInit, 'body' | 'method'> = {},
  ): Promise<T> {
    const response = await options.fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  return {
    async findOpenIssueByTitle(title) {
      const query = new URLSearchParams({
        q: `repo:${options.owner}/${options.repo} is:issue is:open in:title ${JSON.stringify(title)}`,
      });
      const result = await request<{ items: { number: number; title: string }[] }>(
        `/search/issues?${query}`,
      );
      return result.items.find(issue => issue.title === title)?.number;
    },
    async createIssue(payload) {
      const issue = await request<{ number: number }>(
        `/repos/${options.owner}/${options.repo}/issues`,
        {
          body: JSON.stringify(payload),
          method: 'POST',
        },
      );
      return issue.number;
    },
    async updateIssue(issueNumber, payload) {
      await request(`/repos/${options.owner}/${options.repo}/issues/${issueNumber}`, {
        body: JSON.stringify(payload),
        method: 'PATCH',
      });
    },
  };
}

export async function fetchText(url: string, token?: string): Promise<string> {
  // api.github.com allows 60 unauthenticated requests per hour per IP, and CI
  // runners share addresses — an unauthenticated read can fail on a busy
  // runner even though this monitor asks once a week. Other hosts get no
  // Authorization header; sending the workflow token off-origin would leak it.
  const isGitHubApi = new URL(url).hostname === 'api.github.com';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'safeword-upstream-changelog-monitor',
      ...(isGitHubApi && {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token && { Authorization: `Bearer ${token}` }),
      }),
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return await response.text();
}

export async function readText(path: string): Promise<string> {
  return await readFile(path, 'utf8');
}

function normalizeWhitespace(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map(line =>
      line
        .replaceAll(/\s+/g, ' ')
        .replaceAll(' !', '!')
        .replaceAll(' ,', ',')
        .replaceAll(' .', '.')
        .replaceAll(' ?', '?')
        .replaceAll(' :', ':')
        .replaceAll(' ;', ';')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

function atomEntryBlocks(raw: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = raw.toLowerCase().indexOf('<entry', cursor);
    if (start === -1) {
      return blocks;
    }
    const startClose = raw.indexOf('>', start);
    if (startClose === -1) {
      return blocks;
    }
    const end = raw.toLowerCase().indexOf('</entry>', startClose);
    if (end === -1) {
      return blocks;
    }
    blocks.push(raw.slice(startClose + 1, end));
    cursor = end + '</entry>'.length;
  }
}

function titleText(raw: string): string {
  return /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1]?.trim() ?? '';
}

function updatedText(raw: string): string {
  return /<updated\b[^>]*>([\s\S]*?)<\/updated>/i.exec(raw)?.[1]?.trim() ?? '';
}

function linkText(raw: string): string {
  return /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(raw)?.[1]?.trim() ?? '';
}

function linkHref(raw: string): string {
  return /<link\b[^>]*\shref=["']([^"']+)["'][^>]*>/i.exec(raw)?.[1] ?? '';
}

function stripTags(raw: string): string {
  let output = '';
  let insideTag = false;
  for (const character of raw) {
    if (character === '<') {
      insideTag = true;
      output += ' ';
      continue;
    }
    if (character === '>') {
      insideTag = false;
      output += ' ';
      continue;
    }
    if (!insideTag) {
      output += character;
    }
  }
  return output;
}

function decodeXml(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function decodeHtml(text: string): string {
  return decodeXml(text)
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/&#x([\da-f]+);/gi, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    );
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function createBoundedDiff(previous: string, current: string): string {
  const previousLines = previous.split('\n');
  const currentLines = current.split('\n');
  let prefix = 0;
  while (
    prefix < previousLines.length &&
    prefix < currentLines.length &&
    previousLines[prefix] === currentLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix + prefix < previousLines.length &&
    suffix + prefix < currentLines.length &&
    previousLines[previousLines.length - 1 - suffix] ===
      currentLines[currentLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldChanged = previousLines.slice(prefix, previousLines.length - suffix);
  const newChanged = currentLines.slice(prefix, currentLines.length - suffix);
  const lines = [
    `@@ changed lines after ${prefix} common line(s) @@`,
    ...oldChanged.slice(0, 40).map(line => `-${line}`),
    ...newChanged.slice(0, 40).map(line => `+${line}`),
  ];
  if (oldChanged.length > 40 || newChanged.length > 40) {
    lines.push('... diff truncated ...');
  }
  return lines.join('\n');
}
