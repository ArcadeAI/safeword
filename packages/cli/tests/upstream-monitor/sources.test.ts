import { describe, expect, it } from 'vitest';

import {
  buildIssuePayload,
  createSnapshotText,
  detectSourceChange,
  getMonitorSource,
  normalizeCursorHtml,
  normalizeIssueState,
  normalizeReleaseAtom,
  parseGitHubRepo,
  snapshotBody,
} from '../../src/upstream-monitor/index.js';

describe('upstream monitor source adapters', () => {
  it.each(['owner/repo/extra', 'owner/', '/repo'])(
    'rejects malformed repository name %s',
    value => {
      expect(parseGitHubRepo(value)).toBeUndefined();
    },
  );

  it('parses an owner/repo repository name', () => {
    expect(parseGitHubRepo('ArcadeAI/safeword')).toEqual({
      owner: 'ArcadeAI',
      repo: 'safeword',
    });
  });

  it('normalizes Codex release Atom feeds into stable release text', () => {
    const normalized = normalizeReleaseAtom(`
      <?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <title>v0.141.0</title>
          <updated>2026-06-24T01:02:03Z</updated>
          <link href="https://github.com/openai/codex/releases/tag/v0.141.0" />
        </entry>
        <entry>
          <title>v0.140.0</title>
          <updated>2026-06-20T01:02:03Z</updated>
          <link href="https://github.com/openai/codex/releases/tag/v0.140.0" />
        </entry>
      </feed>
    `);

    expect(normalized).toBe(
      [
        'v0.141.0',
        'Updated: 2026-06-24T01:02:03Z',
        'Link: https://github.com/openai/codex/releases/tag/v0.141.0',
        '',
        'v0.140.0',
        'Updated: 2026-06-20T01:02:03Z',
        'Link: https://github.com/openai/codex/releases/tag/v0.140.0',
      ].join('\n'),
    );
  });

  it('reads Atom titles wrapped in CDATA without leaking the markers', () => {
    const normalized = normalizeReleaseAtom(`
      <feed>
        <entry>
          <title type="html"><![CDATA[v0.150.0]]></title>
          <updated>2026-08-01T00:00:00Z</updated>
          <link href="https://example.test/v0.150.0" />
        </entry>
      </feed>
    `);

    // A leaked "<![CDATA[" would sit in the snapshot forever and diff against
    // every non-CDATA release, firing the monitor on markup, not on news.
    expect(normalized).toContain('v0.150.0');
    expect(normalized).not.toContain('CDATA');
  });

  it('does not spill attribute text into content when an attribute value contains ">"', () => {
    // Third-party markup this repo does not control. A naive tag scanner exits
    // tag mode at the ">" inside the quoted href and emits the rest as prose.
    const normalized = normalizeCursorHtml(
      '<main><p><a href="/c?a=1>2">Shipped hooks</a></p></main>',
    );

    expect(normalized).toBe('Shipped hooks');
  });

  it('normalizes Cursor HTML without reacting to cosmetic markup differences', () => {
    const first = normalizeCursorHtml(`
      <main>
        <h1>What&#x27;s New in Cursor</h1>
        <article><h2>June 20, 2026</h2><p>Added <strong>hooks</strong>.</p></article>
      </main>
    `);
    const second = normalizeCursorHtml(`
      <html><body>
        <main class="new">
          <h1><span>What&apos;s New in Cursor</span></h1>
          <article data-id="1"><h2>June 20, 2026</h2><p>Added <b>hooks</b>.</p></article>
        </main>
      </body></html>
    `);

    expect(second).toBe(first);
    expect(first).toBe("What's New in Cursor\nJune 20, 2026\nAdded hooks.");
  });

  it.each(['&#x1FFFFFFF;', '&#9999999999;', '&#xD800;'])(
    'replaces invalid numeric character reference %s instead of disabling the watch',
    characterReference => {
      expect(normalizeCursorHtml(`<p>before ${characterReference} after</p>`)).toBe(
        'before � after',
      );
    },
  );

  // Raw API payloads, not JS objects: GitHub really does send
  // `"state_reason": null` on an open issue, and the normalizer has to survive
  // exactly that.
  const OPEN_ISSUE = '{"number":18115,"state":"open","state_reason":null,"title":"anything"}';
  const CLOSED_ISSUE = '{"number":18115,"state":"closed","state_reason":"completed"}';

  it('reduces a watched upstream issue to its open/closed state', () => {
    expect(normalizeIssueState(OPEN_ISSUE)).toBe('state: open\nstate_reason: none');
    expect(normalizeIssueState(CLOSED_ISSUE)).toBe('state: closed\nstate_reason: completed');
  });

  it('ignores upstream issue churn that is not a state change', () => {
    const busy =
      '{"number":18115,"state":"open","state_reason":null,"title":"Support project-scoped plugins (renamed)","body":"edited again","comments":47,"labels":[{"name":"enhancement"}],"updated_at":"2026-08-04T00:00:00Z"}';

    // A watched issue attracts comments and edits constantly. Only a state
    // change should wake anyone; anything else trains people to ignore it.
    expect(normalizeIssueState(busy)).toBe(normalizeIssueState(OPEN_ISSUE));
  });

  it('fires when the watched upstream issue closes', () => {
    const source = getMonitorSource('codex-project-plugins');
    const snapshot = createSnapshotText(
      source,
      normalizeIssueState(OPEN_ISSUE),
      '2026-08-04T00:00:00.000Z',
    );

    const change = detectSourceChange({
      source,
      liveContent: normalizeIssueState(CLOSED_ISSUE),
      snapshotContent: snapshot,
    });

    expect(change.changed).toBe(true);
    expect(buildIssuePayload(change).body).toContain('openai/codex#18115');
  });

  it.each([
    ['codex-plugin-hook-reload', 17_636],
    ['codex-removed-plugin-hooks', 38_339],
  ] as const)('treats %s closing as an immediate-triage condition', (key, issueNumber) => {
    const source = getMonitorSource(key);
    const snapshot = createSnapshotText(
      source,
      normalizeIssueState(`{"number":${issueNumber},"state":"open","state_reason":null}`),
      '2026-08-16T00:00:00.000Z',
    );

    const change = detectSourceChange({
      source,
      liveContent: normalizeIssueState(
        `{"number":${issueNumber},"state":"closed","state_reason":"completed"}`,
      ),
      snapshotContent: snapshot,
    });

    expect(change.changed).toBe(true);
    expect(source.failOnChange).toBe(true);
    expect(source.labels).toEqual(['impact:high']);
    expect(buildIssuePayload(change).body).toContain('Safeword');
  });

  it('compares live content against the snapshot body, not metadata headers', () => {
    const source = getMonitorSource('codex-cli');
    const snapshot = createSnapshotText(source, 'same body', '2026-06-25T00:00:00.000Z');

    expect(snapshotBody(snapshot)).toBe('same body');
    expect(
      detectSourceChange({
        source,
        liveContent: 'same body',
        snapshotContent: snapshot,
      }).changed,
    ).toBe(false);
  });
});
