import { describe, expect, it } from 'vitest';

import {
  createSnapshotText,
  detectSourceChange,
  getMonitorSource,
  normalizeCursorHtml,
  normalizeReleaseAtom,
  snapshotBody,
} from '../../src/upstream-monitor/index.js';

describe('upstream monitor source adapters', () => {
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
