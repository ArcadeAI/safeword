import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linkChildToEpic, parseChildrenList } from './epic-linker.js';

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

/** An epic whose children use the corpus's block-sequence YAML form. */
function writeBlockSequenceEpic(cwd: string, id: string, children: string[]): void {
  const dir = nodePath.join(cwd, '.project', 'tickets', `${id}-epic`);
  mkdirSync(dir, { recursive: true });
  const items = children.map(child => `  - ${child}`).join('\n');
  writeFileSync(
    nodePath.join(dir, 'ticket.md'),
    `---\nid: ${id}\nslug: epic\ntype: epic\nphase: intake\nstatus: in_progress\nchildren:\n${items}\ncreated: 2026-01-01T00:00:00.000Z\nlast_modified: 2026-01-01T00:00:00.000Z\n---\n\n# Epic\n`,
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

  // Quality-review critical #1: the corpus carries block-sequence children
  // (`children:` followed by `  - id` lines). Appending must preserve those
  // entries and leave no orphaned `- id` lines under the rewritten flow array.
  it('appends to a block-sequence children list without dropping or orphaning entries', () => {
    writeBlockSequenceEpic(cwd, 'EPIC01', ['049a', '049b']);
    expect(linkChildToEpic(cwd, 'NEWKID', 'EPIC01').ok).toBe(true);

    expect(readEpicChildren(cwd, 'EPIC01')).toEqual(['049a', '049b', 'NEWKID']);
    const content = readFileSync(
      nodePath.join(cwd, '.project', 'tickets', 'EPIC01-epic', 'ticket.md'),
      'utf8',
    );
    // No dangling block items may survive the rewrite.
    expect(content).not.toMatch(/^[ \t]+-[ \t]/m);
  });

  it('re-linking a block-sequence child is idempotent (no rewrite needed)', () => {
    writeBlockSequenceEpic(cwd, 'EPIC01', ['049a']);
    expect(linkChildToEpic(cwd, '049a', 'EPIC01').ok).toBe(true);
    // Already linked → no-op: the file may legitimately stay in block form,
    // so assert via the format-tolerant parser, not the flow-array reader.
    const content = readFileSync(
      nodePath.join(cwd, '.project', 'tickets', 'EPIC01-epic', 'ticket.md'),
      'utf8',
    );
    expect(parseChildrenList(content)).toEqual(['049a']);
  });

  // Quality-review critical #2 (throw path): a folder that resolves but has no
  // readable ticket.md must yield a reasoned failure, not an ENOENT throw.
  it('returns a reasoned failure when the resolved folder has no ticket.md', () => {
    mkdirSync(nodePath.join(cwd, '.project', 'tickets', 'EPIC01-epic'), { recursive: true });
    const result = linkChildToEpic(cwd, 'CHILD1', 'EPIC01');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no readable ticket\.md/);
  });
});
