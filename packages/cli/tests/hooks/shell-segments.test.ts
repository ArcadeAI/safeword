/**
 * Direct pins for the unified shell tokenizer (ticket EDDABK). Every Bash
 * gate — process-kill-guard, bash-ledger-writes, dependency-readiness, and
 * the cursor gate-adapter — consumes these three functions, so this file
 * pins the tokenizer contract itself; the gate test files pin what each gate
 * does with it. Each divergence class from the EDDABK consolidation decision
 * gets an explicit pin so a future edit can't silently revert it.
 */

import { describe, expect, it } from 'vitest';

import {
  commandWordIndex,
  parseShellWords,
  splitShellSegments,
} from '../../templates/hooks/lib/shell-segments.js';

describe('splitShellSegments', () => {
  it('Scenario: `;`, newline, `&&`, `||`, and single `|` are segment boundaries', () => {
    expect(splitShellSegments('echo a; echo b')).toEqual(['echo a', 'echo b']);
    expect(splitShellSegments('echo a\necho b')).toEqual(['echo a', 'echo b']);
    expect(splitShellSegments('bun ci && bun run test')).toEqual(['bun ci', 'bun run test']);
    expect(splitShellSegments('command -v bun || npm ci')).toEqual(['command -v bun', 'npm ci']);
    expect(splitShellSegments('ps aux | grep node')).toEqual(['ps aux', 'grep node']);
  });

  it('Scenario: `||` yields exactly two segments, no empty middle segment', () => {
    // The pre-EDDABK shared splitter treated `||` as two `|` boundaries,
    // leaving an empty segment between them. Now it is one explicit boundary.
    expect(splitShellSegments('true || pkill node')).toEqual(['true', 'pkill node']);
  });

  it('Scenario: `>|` is a clobbering redirection, not a pipe boundary', () => {
    // Splitting here would hide the redirection target from the ledger gate
    // and manufacture phantom "commands" out of target filenames.
    expect(splitShellSegments('echo hi >| out.txt')).toEqual(['echo hi >| out.txt']);
    expect(splitShellSegments('echo x 2>| err.txt')).toEqual(['echo x 2>| err.txt']);
    expect(splitShellSegments('cat foo >| bar; pkill node')).toEqual([
      'cat foo >| bar',
      'pkill node',
    ]);
  });

  it('Scenario: quoted operators are not boundaries', () => {
    expect(splitShellSegments("echo 'a && b'")).toEqual(["echo 'a && b'"]);
    expect(splitShellSegments('echo "x; pkill node"')).toEqual(['echo "x; pkill node"']);
    expect(splitShellSegments("git commit -m 'msg with | pipe'")).toEqual([
      "git commit -m 'msg with | pipe'",
    ]);
  });

  it('Scenario: backslash is literal inside single quotes (POSIX), so the quote closes', () => {
    // Pre-EDDABK the shared splitter treated \' inside single quotes as an
    // escaped quote, staying "in quote" past the real closing quote — which
    // masked a following `; pkill node` from the kill-guard.
    expect(splitShellSegments(String.raw`echo 'a\'; pkill node`)).toEqual([
      String.raw`echo 'a\'`,
      'pkill node',
    ]);
  });

  it('Scenario: segments are trimmed and empty segments dropped', () => {
    expect(splitShellSegments('bun ci ||')).toEqual(['bun ci']);
    expect(splitShellSegments('| npm ci')).toEqual(['npm ci']);
  });
});

describe('parseShellWords', () => {
  it('Scenario: whitespace-splits and strips quotes', () => {
    expect(parseShellWords('pkill -9 node')).toEqual(['pkill', '-9', 'node']);
    expect(parseShellWords("git commit -m 'two words'")).toEqual([
      'git',
      'commit',
      '-m',
      'two words',
    ]);
  });

  it('Scenario: backslash escapes outside single quotes', () => {
    expect(parseShellWords(String.raw`echo a\ b`)).toEqual(['echo', 'a b']);
    expect(parseShellWords(String.raw`printf "a\"b"`)).toEqual(['printf', 'a"b']);
  });

  it('Scenario: backslash is literal inside single quotes (POSIX)', () => {
    // The kill-guard depends on this word shape: `pkill '\java'` must
    // tokenize to `\java` (a real ERE that matches `java`), which bareName
    // then normalizes — not silently to `java` via a bogus escape.
    expect(parseShellWords(String.raw`pkill '\java'`)).toEqual(['pkill', String.raw`\java`]);
  });
});

describe('commandWordIndex', () => {
  const resolve = (segment: string): string[] => {
    const words = parseShellWords(segment);
    return words.slice(commandWordIndex(words));
  };

  it('Scenario: skips environment assignments and the command builtin', () => {
    expect(resolve('FOO=1 BAR=2 npm ci')).toEqual(['npm', 'ci']);
    expect(resolve('command npm ci')).toEqual(['npm', 'ci']);
  });

  it('Scenario: skips env by basename, including its options', () => {
    expect(resolve('env FOO=1 bun ci')).toEqual(['bun', 'ci']);
    expect(resolve('/usr/bin/env FOO=1 bun test')).toEqual(['bun', 'test']);
    expect(resolve('env -i PATH=/x pnpm install')).toEqual(['pnpm', 'install']);
    expect(resolve('env -u FOO npm ci')).toEqual(['npm', 'ci']);
    expect(resolve('env -- npm ci')).toEqual(['npm', 'ci']);
  });

  it('Scenario: skips the corepack launcher by basename', () => {
    expect(resolve('corepack pnpm install')).toEqual(['pnpm', 'install']);
    expect(resolve('corepack enable')).toEqual(['enable']);
  });

  it('Scenario: loops over chained prefixes', () => {
    expect(resolve('FOO=1 env BAR=2 /usr/bin/env npm ci')).toEqual(['npm', 'ci']);
    expect(resolve('env FOO=1 corepack pnpm install')).toEqual(['pnpm', 'install']);
  });

  it('Scenario: skips leading subshell/group openers', () => {
    expect(resolve('( bun ci )')).toEqual(['bun', 'ci', ')']);
    expect(resolve('{ npm ci')).toEqual(['npm', 'ci']);
  });

  it('Scenario: sudo is deliberately not skipped (gates handle it themselves)', () => {
    expect(resolve('sudo npm ci')).toEqual(['sudo', 'npm', 'ci']);
  });
});
