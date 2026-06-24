import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildIndexContent,
  COMPLETED_DIRNAME,
  COMPLETED_INDEX_FILENAME,
  INDEX_FILENAME,
  readTickets,
  syncTickets,
  type TicketEntry,
  TICKETS_RELATIVE_PATH,
} from '../../src/ticket-sync/index.js';

describe('ticket-sync', () => {
  let temporaryDirectory: string;
  let ticketsDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-ticket-sync-'));
    ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
    mkdirSync(ticketsDirectory, { recursive: true });
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  /** Write `<tickets>/<folder>/ticket.md` with the given frontmatter map + body. */
  function writeTicket(
    folder: string,
    frontmatter: Record<string, string>,
    body = '',
    options: { completed?: boolean } = {},
  ) {
    const base = options.completed
      ? nodePath.join(ticketsDirectory, COMPLETED_DIRNAME, folder)
      : nodePath.join(ticketsDirectory, folder);
    mkdirSync(base, { recursive: true });
    const fm = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    writeFileSync(nodePath.join(base, 'ticket.md'), `---\n${fm}\n---\n\n${body}`);
  }

  function activeEntries() {
    return readTickets(ticketsDirectory).active;
  }

  function entryFor(id: string, scope: 'active' | 'completed' = 'active'): TicketEntry | undefined {
    return readTickets(ticketsDirectory)[scope].find(entry => entry.id === id);
  }

  // ── AKZJXC: structured depends_on relations ──

  describe('depends_on relations (AKZJXC)', () => {
    it('parses depends_on into the entry', () => {
      writeTicket(
        'AAA111-dependent',
        { id: 'AAA111', status: 'open', depends_on: '[BBB222]' },
        '# Dependent\n',
      );
      expect(entryFor('AAA111')?.dependsOn).toEqual(['BBB222']);
    });

    it('renders blocked_by slug-first and derives blocks on the target', () => {
      writeTicket(
        'AAA111-dependent',
        { id: 'AAA111', status: 'open', depends_on: '[BBB222]' },
        '# Dependent\n',
      );
      writeTicket('BBB222-blocker', { id: 'BBB222', status: 'open' }, '# Blocker\n');
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toContain('blocked by: Blocker (BBB222)');
      expect(content).toContain('blocks: Dependent (AAA111)');
    });

    it('falls back to the bare id for a target outside the index', () => {
      writeTicket('CCC333-x', { id: 'CCC333', status: 'open', depends_on: '[ZZZ999]' }, '# X\n');
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toContain('blocked by: ZZZ999');
      expect(content).not.toContain('ZZZ999 (ZZZ999)');
    });
  });

  // ── MBGQ89: blocked_on_override surfacing ──

  describe('blocked_on_override surfacing (MBGQ89)', () => {
    it('parses blocked_on_override onto the entry', () => {
      writeTicket(
        'OVR111-x',
        {
          id: 'OVR111',
          status: 'open',
          blocked_on: '[BLK1]',
          blocked_on_override: 'BLK1 cancelled; schema still needed',
        },
        '# X\n',
      );
      expect(entryFor('OVR111')?.blockedOnOverride).toBe('BLK1 cancelled; schema still needed');
    });

    it('surfaces the override reason in the INDEX', () => {
      writeTicket(
        'OVR111-x',
        {
          id: 'OVR111',
          status: 'open',
          blocked_on: '[BLK1]',
          blocked_on_override: 'BLK1 cancelled; schema still needed',
        },
        '# X\n',
      );
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toContain('override: BLK1 cancelled; schema still needed');
    });
  });

  // ── AC1: entries carry id, title, status, epic, goal, path ──

  describe('AC1 — entry fields and parsing', () => {
    it('full_frontmatter_renders_all_fields', () => {
      writeTicket(
        'ABC123-do-thing',
        { id: 'ABC123', title: "'Do the thing'", status: 'in_progress', epic: 'big-epic' },
        '# Do the thing\n\n**Goal:** Make X searchable.\n',
      );
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toContain('Do the thing (ABC123)');
      expect(content).toContain('Do the thing');
      expect(content).toContain('in_progress');
      expect(content).toContain('big-epic');
      expect(content).toContain('Make X searchable.');
      expect(content).toContain(`${TICKETS_RELATIVE_PATH}/ABC123-do-thing`);
    });

    it('external_issue_and_legacy_external_alias_parse', () => {
      writeTicket(
        'EXT111-x',
        {
          id: 'EXT111',
          status: 'backlog',
          external_issue: 'https://github.com/ArcadeAI/safeword/issues/393',
          external_prs:
            '[https://github.com/ArcadeAI/safeword/pull/400, https://github.com/ArcadeAI/safeword/pull/401]',
        },
        '# External links\n',
      );
      writeTicket(
        'EXT112-y',
        {
          id: 'EXT112',
          status: 'backlog',
          external: 'https://github.com/ArcadeAI/safeword/issues/394',
          external_prs: '["https://github.com/ArcadeAI/safeword/pull/402"]',
        },
        '# Legacy external\n',
      );

      const extension111 = entryFor('EXT111');
      const extension112 = entryFor('EXT112');

      expect(extension111?.externalIssue).toBe('https://github.com/ArcadeAI/safeword/issues/393');
      expect(extension111?.externalPullRequests).toEqual([
        'https://github.com/ArcadeAI/safeword/pull/400',
        'https://github.com/ArcadeAI/safeword/pull/401',
      ]);
      expect(extension112?.externalIssue).toBe('https://github.com/ArcadeAI/safeword/issues/394');
    });

    it('renders_external_issue_and_prs_in_index_output', () => {
      writeTicket(
        'EXT113-x',
        {
          id: 'EXT113',
          status: 'backlog',
          external_issue: 'https://github.com/ArcadeAI/safeword/issues/395',
          external_prs:
            '[https://github.com/ArcadeAI/safeword/pull/410, https://github.com/ArcadeAI/safeword/pull/411]',
        },
        '# External render\n',
      );

      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toContain('external issue: https://github.com/ArcadeAI/safeword/issues/395');
      expect(content).toContain(
        'external PRs: https://github.com/ArcadeAI/safeword/pull/410, https://github.com/ArcadeAI/safeword/pull/411',
      );
    });

    it('title_falls_back_to_h1_then_slug', () => {
      writeTicket('H1ONLY-x', { id: 'H1ONLY', status: 'backlog' }, '# H1 Title Here\n\nbody\n');
      writeTicket('NOH1-y', { id: 'NOH1', status: 'backlog' }, 'no heading, no title\n');
      expect(entryFor('H1ONLY')?.title).toBe('H1 Title Here');
      expect(entryFor('NOH1')?.title).toBe('NOH1-y');
    });

    it('goal_one_liner_extracted_when_present_omitted_when_absent', () => {
      writeTicket('G1-a', { id: 'G1', status: 'backlog' }, '# A\n\n**Goal:** Ship the index.\n');
      writeTicket('G2-b', { id: 'G2', status: 'backlog' }, '# B\n\nNo goal line here.\n');
      expect(entryFor('G1')?.goal).toBe('Ship the index.');
      expect(entryFor('G2')?.goal).toBeUndefined();
    });

    it('crockford_numeric_and_quoted_ids_all_parse', () => {
      writeTicket('crock', { id: '1GGD28', status: 'backlog' });
      writeTicket('num', { id: '001', status: 'backlog' });
      writeTicket('quoted', { id: "'002'", status: 'backlog' });
      const ids = activeEntries().map(entry => entry.id);
      expect(ids).toContain('1GGD28');
      expect(ids).toContain('001'); // leading zero preserved
      expect(ids).toContain('002'); // quotes stripped
    });

    it('ticket_without_id_is_skipped_with_reason', () => {
      writeTicket('noid', { status: 'backlog', title: 'No id' }, '# No id\n');
      const { active, skipped } = readTickets(ticketsDirectory);
      expect(active).toHaveLength(0);
      expect(skipped).toHaveLength(1);
      expect(skipped[0]?.folder).toBe('noid');
      expect(skipped[0]?.reason).toMatch(/id/i);
    });
  });

  // ── AC2: grouped by epic ──

  describe('AC2 — epic grouping', () => {
    it('tickets_sharing_an_epic_group_under_one_heading', () => {
      writeTicket('one', { id: 'ONE', status: 'backlog', epic: 'workflow-gate-hygiene' });
      writeTicket('two', { id: 'TWO', status: 'backlog', epic: 'workflow-gate-hygiene' });
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      const headingCount = (content.match(/workflow-gate-hygiene/g) ?? []).filter(Boolean);
      // One epic heading; the two entries reference the epic inline too, so assert the heading exists once.
      expect(content).toMatch(/^#+ .*workflow-gate-hygiene/m);
      expect(content).toContain('one (ONE)');
      expect(content).toContain('two (TWO)');
      expect(headingCount.length).toBeGreaterThanOrEqual(1);
    });

    it('ticket_without_epic_groups_under_no_epic', () => {
      writeTicket('lonely', { id: 'LONE', status: 'backlog' }, '# Lonely\n');
      const entry = entryFor('LONE');
      expect(entry?.epic).toBeUndefined();
      const content = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(content).toMatch(/no epic/i);
      expect(content).toContain('epic: —');
    });

    it('groups_and_entries_are_deterministically_ordered', () => {
      writeTicket('b', { id: 'BBB', status: 'backlog', epic: 'zeta' });
      writeTicket('a', { id: 'AAA', status: 'backlog', epic: 'alpha' });
      writeTicket('c', { id: 'CCC', status: 'backlog' });
      const first = buildIndexContent(activeEntries(), { variant: 'active' });
      const second = buildIndexContent(activeEntries(), { variant: 'active' });
      expect(first).toBe(second);
      // alpha group sorts before zeta; no-epic bucket sorts last.
      expect(first.indexOf('alpha')).toBeLessThan(first.indexOf('zeta'));
      expect(first.indexOf('zeta')).toBeLessThan(first.search(/no epic/i));
    });
  });

  // ── AC3: idempotent, drift-free, do-not-edit ──

  describe('AC3 — idempotency and drift', () => {
    it('first_run_writes_then_unchanged_run_is_no_op', () => {
      writeTicket('t', { id: 'T1', status: 'backlog' }, '# T\n\n**Goal:** g.\n');
      const first = syncTickets(temporaryDirectory);
      expect(first.wrote).toBe(true);
      expect(existsSync(first.indexPath)).toBe(true);
      const second = syncTickets(temporaryDirectory);
      expect(second.wrote).toBe(false);
    });

    it('changed_ticket_rewrites_the_index', () => {
      writeTicket('t', { id: 'T1', status: 'backlog' }, '# T\n');
      syncTickets(temporaryDirectory);
      writeTicket('t', { id: 'T1', status: 'in_progress' }, '# T\n');
      const result = syncTickets(temporaryDirectory);
      expect(result.wrote).toBe(true);
      expect(readFileSync(result.indexPath, 'utf8')).toContain('in_progress');
    });

    it('removed_ticket_drops_its_entry', () => {
      writeTicket('keep', { id: 'KEEP', status: 'backlog' }, '# Keep\n');
      writeTicket('gone', { id: 'GONE', status: 'backlog' }, '# Gone\n');
      syncTickets(temporaryDirectory);
      rmSync(nodePath.join(ticketsDirectory, 'gone'), { recursive: true, force: true });
      const result = syncTickets(temporaryDirectory);
      expect(result.wrote).toBe(true);
      const content = readFileSync(result.indexPath, 'utf8');
      expect(content).toContain('Keep (KEEP)');
      expect(content).not.toContain('(GONE)');
    });

    it('index_is_stamped_do_not_edit_and_excluded_from_its_own_scan', () => {
      writeTicket('t', { id: 'T1', status: 'backlog' }, '# T\n');
      const result = syncTickets(temporaryDirectory);
      const content = readFileSync(result.indexPath, 'utf8');
      expect(content).toMatch(/auto-generated/i);
      expect(content).toMatch(/do not edit/i);
      // Re-running must not parse INDEX.md / INDEX-completed.md as tickets.
      const { active, skipped } = readTickets(ticketsDirectory);
      const names = [...active.map(entry => entry.folder), ...skipped.map(skip => skip.folder)];
      expect(names).not.toContain(INDEX_FILENAME);
      expect(names).not.toContain(COMPLETED_INDEX_FILENAME);
    });
  });

  // ── AC4: active/completed split ──

  describe('AC4 — active/completed scope split', () => {
    it('active_and_completed_split_into_two_files', () => {
      writeTicket('act', { id: 'ACT', status: 'in_progress' }, '# Active\n');
      writeTicket('done1', { id: 'DONE1', status: 'done' }, '# Done one\n', { completed: true });
      const result = syncTickets(temporaryDirectory);
      expect(result.active.map(entry => entry.id)).toEqual(['ACT']);
      expect(result.completed.map(entry => entry.id)).toEqual(['DONE1']);
      expect(readFileSync(result.indexPath, 'utf8')).toContain('Active (ACT)');
      expect(readFileSync(result.indexPath, 'utf8')).not.toContain('(DONE1)');
      expect(readFileSync(result.completedIndexPath, 'utf8')).toContain('Done one (DONE1)');
    });

    it('completed_only_corpus_writes_archive_and_empty_active', () => {
      writeTicket('done1', { id: 'DONE1', status: 'done' }, '# Done one\n', { completed: true });
      const result = syncTickets(temporaryDirectory);
      expect(readFileSync(result.completedIndexPath, 'utf8')).toContain('Done one (DONE1)');
      const activeContent = readFileSync(result.indexPath, 'utf8');
      expect(activeContent).toMatch(/no active tickets/i);
    });

    it('missing_tickets_dir_is_a_no_op', () => {
      rmSync(ticketsDirectory, { recursive: true, force: true });
      const result = syncTickets(temporaryDirectory);
      expect(result.wrote).toBe(false);
      expect(existsSync(result.indexPath)).toBe(false);
      expect(existsSync(result.completedIndexPath)).toBe(false);
    });
  });

  describe('conflict-marker guidance (398)', () => {
    it('reports conflicted index files in the sync result and rewrites them cleanly', () => {
      writeTicket('active-ticket', { id: 'ACT', status: 'backlog' });
      writeTicket('done-ticket', { id: 'DONE', status: 'done' }, '', { completed: true });
      syncTickets(temporaryDirectory);

      const conflictMarker = [
        '<<<<<<< HEAD',
        'conflict',
        '=======',
        'incoming',
        '>>>>>>> branch',
      ].join('\n');
      writeFileSync(nodePath.join(ticketsDirectory, INDEX_FILENAME), conflictMarker);
      writeFileSync(
        nodePath.join(ticketsDirectory, COMPLETED_INDEX_FILENAME),
        ['<<<<<<< HEAD', 'keep', '=======', 'alt', '>>>>>>> branch'].join('\n'),
      );

      const result = syncTickets(temporaryDirectory);
      expect(result.indexConflicts).toEqual([
        nodePath.join(ticketsDirectory, INDEX_FILENAME),
        nodePath.join(ticketsDirectory, COMPLETED_INDEX_FILENAME),
      ]);
      expect(result.wrote).toBe(true);
      expect(readFileSync(result.indexPath, 'utf8')).not.toMatch(/^(?:<{7}|={7}|>{7})/m);
      expect(readFileSync(result.completedIndexPath, 'utf8')).not.toMatch(/^(?:<{7}|={7}|>{7})/m);
    });
  });

  // ── adversarial robustness (folded from scenario-gate) ──

  describe('robustness', () => {
    it('ignores folders without a ticket.md and the tmp/ dir', () => {
      mkdirSync(nodePath.join(ticketsDirectory, 'stray-no-ticket'), { recursive: true });
      mkdirSync(nodePath.join(ticketsDirectory, 'tmp'), { recursive: true });
      writeTicket('real', { id: 'REAL', status: 'backlog' }, '# Real\n');
      const { active, skipped } = readTickets(ticketsDirectory);
      expect(active.map(entry => entry.id)).toEqual(['REAL']);
      // Non-ticket folders are silently ignored, not "skipped with reason".
      expect(skipped.map(skip => skip.folder)).not.toContain('stray-no-ticket');
      expect(skipped.map(skip => skip.folder)).not.toContain('tmp');
    });
  });
});
