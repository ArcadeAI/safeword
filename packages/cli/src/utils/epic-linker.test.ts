import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linkChildToEpic } from './epic-linker.js';

function writeEpic(cwd: string, id: string, children: string[]): void {
  const dir = nodePath.join(cwd, '.project', 'tickets', `${id}-epic`);
  mkdirSync(dir, { recursive: true });
  const quoted = children.map(child => `'${child}'`).join(', ');
  const list = `[${quoted}]`;
  writeFileSync(
    nodePath.join(dir, 'ticket.md'),
    `---\nid: ${id}\nslug: epic\ntype: epic\nphase: intake\nstatus: in_progress\nchildren: ${list}\ncreated: 2026-01-01T00:00:00.000Z\nlast_modified: 2026-01-01T00:00:00.000Z\n---\n\n# Epic\n`,
  );
}

function readEpicChildren(cwd: string, id: string): string[] {
  const content = readFileSync(
    nodePath.join(cwd, '.project', 'tickets', `${id}-epic`, 'ticket.md'),
    'utf8',
  );
  const match = /^children:\s*\[(.*)\]\s*$/m.exec(content);
  if (match?.[1] === undefined) return [];
  const inner = match[1].trim();
  return inner === ''
    ? []
    : inner.split(',').map(entry => entry.trim().replaceAll(/^['"]|['"]$/g, ''));
}

describe('linkChildToEpic', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'epic-linker-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  // epic-child-linker.TB1.AC4.second_child_preserves_first
  it('appends a second child without dropping the first', () => {
    writeEpic(cwd, 'EPIC01', ['CHILD1']);
    const result = linkChildToEpic(cwd, 'CHILD2', 'EPIC01');
    expect(result.ok).toBe(true);
    expect(readEpicChildren(cwd, 'EPIC01')).toEqual(['CHILD1', 'CHILD2']);
  });

  // epic-child-linker.TB1.AC4.linking_twice_adds_at_most_once
  it('linking the same child twice adds it at most once', () => {
    writeEpic(cwd, 'EPIC01', []);
    expect(linkChildToEpic(cwd, 'CHILD2', 'EPIC01').ok).toBe(true);
    expect(linkChildToEpic(cwd, 'CHILD2', 'EPIC01').ok).toBe(true);
    expect(readEpicChildren(cwd, 'EPIC01')).toEqual(['CHILD2']);
  });
});
