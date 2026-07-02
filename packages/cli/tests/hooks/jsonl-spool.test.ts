import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendJsonlRecords,
  atomicWriteFile,
  countJsonlRecords,
  readJsonlRecords,
} from '../../templates/hooks/lib/jsonl-spool.js';

interface Rec {
  n: number;
}
const parseRec = (value: unknown): Rec | undefined =>
  typeof value === 'object' && value !== null && typeof (value as Rec).n === 'number'
    ? { n: (value as Rec).n }
    : undefined;
const line = (n: number): string => JSON.stringify({ n });

describe('jsonl-spool — shared per-session JSONL I/O (self-report + retro spools)', () => {
  let directory: string;
  let file: string;
  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'jsonl-spool-'));
    file = nodePath.join(directory, 'sub', 'sess.jsonl');
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('appends and round-trips records, creating the parent dir', () => {
    appendJsonlRecords(file, [line(1), line(2)], 20);
    expect(readJsonlRecords(file, parseRec)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(countJsonlRecords(file)).toBe(2);
  });

  it('appends across calls (accumulates)', () => {
    appendJsonlRecords(file, [line(1)], 20);
    appendJsonlRecords(file, [line(2)], 20);
    expect(readJsonlRecords(file, parseRec)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('caps: once the file holds `cap` records, later appends drop the overflow', () => {
    appendJsonlRecords(
      file,
      Array.from({ length: 50 }, (_, i) => line(i)),
      20,
    );
    expect(countJsonlRecords(file)).toBe(20);
    appendJsonlRecords(file, [line(999)], 20);
    expect(countJsonlRecords(file)).toBe(20); // still capped
  });

  it('reads [] for an absent file and skips torn/rejected lines (fail-open)', () => {
    expect(readJsonlRecords(file, parseRec)).toEqual([]);
    expect(countJsonlRecords(file)).toBe(0);
    mkdirSync(nodePath.dirname(file), { recursive: true });
    // a torn line, a valid line, and a well-formed-but-rejected line
    writeFileSync(file, `{"n":1}\n{"n":\n{"nope":true}\n{"n":2}\n`, 'utf8');
    expect(readJsonlRecords(file, parseRec)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('never throws on an append to an unwritable path (fail-open)', () => {
    expect(() => {
      appendJsonlRecords('/', [line(1)], 20); // '/' dir — write must not throw
    }).not.toThrow();
  });

  it('atomicWriteFile replaces the file whole (temp + rename), creating the dir', () => {
    atomicWriteFile(file, 'first\n');
    expect(readFileSync(file, 'utf8')).toBe('first\n');
    atomicWriteFile(file, 'second\n');
    expect(readFileSync(file, 'utf8')).toBe('second\n');
    // no leftover temp sibling
    expect(() => readFileSync(`${file}.${process.pid}.tmp`, 'utf8')).toThrow();
  });
});
