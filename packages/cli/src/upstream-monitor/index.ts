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
  liveContent: string;
  snapshotContent: string;
  source: MonitorSource;
}

export interface SourceChange {
  changed: boolean;
  current: string;
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
  readText(path: string): Promise<string>;
  rootDirectory: string;
  sources?: readonly MonitorSource[];
  log?(message: string): void;
}

const SNAPSHOT_DIRECTORY = '.github/changelog-snapshots';

/** Per-request ceiling, so one stalled connection cannot consume the whole run. */
const REQUEST_TIMEOUT_MS = 30_000;

const ISSUE_LOOKUP_PAGE_SIZE = 100;

/** Bounds the open-issue scan. Exceeding it is reported, never assumed empty. */
const ISSUE_LOOKUP_MAX_PAGES = 10;

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
    previous,
    source: input.source,
  };
}

export function buildIssuePayload(change: Omit<SourceChange, 'changed'>): IssuePayload {
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
  log?(message: string): void;
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
      // Without this a hung connection blocks until the workflow's own
      // timeout, turning one stalled request into a whole missed run.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  return {
    async findOpenIssueByTitle(title) {
      // Lists open issues rather than using the search API. Search is
      // eventually consistent: a manual re-run shortly after a scheduled one
      // would not see the just-created issue and would file a duplicate. The
      // list endpoint is read-after-write consistent.
      let found: number | undefined;
      let lastPageReached = false;

      for (let page = 1; page <= ISSUE_LOOKUP_MAX_PAGES && !found && !lastPageReached; page += 1) {
        const query = new URLSearchParams({
          state: 'open',
          per_page: String(ISSUE_LOOKUP_PAGE_SIZE),
          page: String(page),
        });
        const issues = await request<{ number: number; title: string; pull_request?: unknown }[]>(
          `/repos/${options.owner}/${options.repo}/issues?${query}`,
        );

        // This endpoint returns pull requests alongside issues.
        found = issues.find(issue => !issue.pull_request && issue.title === title)?.number;
        lastPageReached = issues.length < ISSUE_LOOKUP_PAGE_SIZE;
      }

      // Hitting the cap is not the same as "no such issue" — treating it that
      // way files a fresh duplicate every run. Say so rather than guess.
      if (!found && !lastPageReached) {
        const message = `issue lookup hit the ${ISSUE_LOOKUP_MAX_PAGES}-page cap without finding "${title}"; refusing to risk a duplicate`;
        options.log?.(message);
        throw new Error(message);
      }

      return found;
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  const lowercaseRaw = raw.toLowerCase();
  let cursor = 0;
  for (;;) {
    const start = lowercaseRaw.indexOf('<entry', cursor);
    if (start === -1) {
      return blocks;
    }
    const contentStart = tagEndIndex(raw, start);
    if (contentStart === raw.length) {
      return blocks;
    }
    const end = lowercaseRaw.indexOf('</entry>', contentStart);
    if (end === -1) {
      return blocks;
    }
    blocks.push(raw.slice(contentStart, end));
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

/**
 * Index just past the ">" closing the tag that opens at `start`.
 *
 * A ">" inside a quoted attribute value does not close the tag. Third-party
 * markup routinely carries one in a URL or inline style, and mistaking it for
 * the tag's end spills the rest of the attribute into the page text —
 * corrupting the snapshot so the monitor diffs on markup rather than content.
 */
function tagEndIndex(raw: string, start: number): number {
  let quote: string | undefined;
  for (let index = start + 1; index < raw.length; index += 1) {
    const character = raw[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index + 1;
  }
  return raw.length;
}

function stripTags(raw: string): string {
  let output = '';
  let cursor = 0;
  for (;;) {
    const open = raw.indexOf('<', cursor);
    if (open === -1) return output + raw.slice(cursor);
    // Two spaces stand in for the removed "<" and ">"; normalizeWhitespace
    // collapses them, and they keep adjacent words from fusing.
    output += `${raw.slice(cursor, open)}  `;
    cursor = tagEndIndex(raw, open);
  }
}

function unwrapCdata(text: string): string {
  return text.replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeXml(text: string): string {
  // Atom feeds may wrap a title or link in CDATA. Leaving the markers in place
  // would bake them into the snapshot, so every later non-CDATA release diffs
  // against them and the monitor reports markup as news.
  return unwrapCdata(text)
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
      decodeNumericCharacterReference(Number.parseInt(codePoint, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, codePoint: string) =>
      decodeNumericCharacterReference(Number(codePoint)),
    );
}

function decodeNumericCharacterReference(codePoint: number): string {
  const isInvalidScalar =
    codePoint === 0 || codePoint > 0x10_ff_ff || (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff);
  return isInvalidScalar ? '\u{FFFD}' : String.fromCodePoint(codePoint);
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
