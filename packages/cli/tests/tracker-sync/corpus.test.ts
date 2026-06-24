import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backLinkUrl, readCorpus, toTicketInput } from '../../src/tracker-sync/corpus.js';

describe('sync-tracker corpus mapping', () => {
  it('builds a github tree URL when a repo is configured', () => {
    expect(backLinkUrl('.project/tickets/AB12CD-wire', 'acme/repo')).toBe(
      'https://github.com/acme/repo/tree/HEAD/.project/tickets/AB12CD-wire',
    );
  });

  it('falls back to the in-repo relative path when no repo is configured', () => {
    expect(backLinkUrl('.project/tickets/AB12CD-wire', undefined)).toBe(
      '.project/tickets/AB12CD-wire',
    );
  });

  it('maps a ticket entry and its type to the neutral TicketInput', () => {
    const input = toTicketInput(
      {
        id: 'AB12CD',
        title: 'Wire it up',
        status: 'in_progress',
        epic: 'bridge',
        relativePath: '.project/tickets/AB12CD-wire',
      },
      'feature',
      'acme/repo',
      'body text',
    );
    expect(input).toEqual({
      id: 'AB12CD',
      title: 'Wire it up',
      status: 'in_progress',
      type: 'feature',
      epic: 'bridge',
      ticketUrl: 'https://github.com/acme/repo/tree/HEAD/.project/tickets/AB12CD-wire',
      bodyMarkdown: 'body text',
    });
  });

  describe('readCorpus (characterization)', () => {
    let cwd: string;

    beforeEach(() => {
      cwd = mkdtempSync(nodePath.join(tmpdir(), 'corpus-'));
    });

    afterEach(() => {
      rmSync(cwd, { recursive: true, force: true });
    });

    function writeTicket(folder: string, frontmatter: string[], body = ''): void {
      const dir = nodePath.join(cwd, '.project', 'tickets', folder);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        nodePath.join(dir, 'ticket.md'),
        ['---', ...frontmatter, '---', '', body, ''].join('\n'),
      );
    }

    it('maps an active ticket: parses type, includes full body, derives the back-link', () => {
      writeTicket(
        'AB12CD-wire',
        ['id: AB12CD', 'type: feature', 'status: in_progress', 'epic: bridge', 'title: Wire it up'],
        '# Wire it up\n\nspec body',
      );

      const corpus = readCorpus(cwd, 'acme/repo');

      expect(corpus).toHaveLength(1);
      expect(corpus[0]?.type).toBe('feature');
      expect(corpus[0]?.epic).toBe('bridge');
      expect(corpus[0]?.ticketUrl).toBe(
        'https://github.com/acme/repo/tree/HEAD/.project/tickets/AB12CD-wire',
      );
      expect(corpus[0]?.bodyMarkdown).toContain('spec body');
    });

    it('defaults type to task when the frontmatter omits it', () => {
      writeTicket('CD34EF-bare', ['id: CD34EF', 'status: in_progress', 'title: Bare']);
      expect(readCorpus(cwd, undefined)[0]?.type).toBe('task');
    });
  });
});
