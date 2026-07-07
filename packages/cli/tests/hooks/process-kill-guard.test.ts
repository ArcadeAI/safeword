/**
 * Unit tests for the broad-process-kill predicate (ticket K4STDR, issue #773).
 * Pure function over a command string — no filesystem.
 *
 * detectBroadProcessKill returns a { command, target } detection when a
 * killall/pkill invocation targets a shared interpreter runtime by bare name
 * (which kills every project's processes on the machine), and undefined
 * otherwise. The allow-side tests are precision pins for the guide-sanctioned
 * project-scoped kill patterns — they flip if the predicate ever over-denies.
 */

import { describe, expect, it } from 'vitest';

import { requiresFailClosedShellGate } from '../../templates/hooks/cursor/gate-adapter.js';
import { detectBroadProcessKill } from '../../templates/hooks/lib/process-kill-guard.js';

describe('detectBroadProcessKill', () => {
  describe('Rule: killall/pkill targeting a bare runtime name is detected', () => {
    it.each([
      ['killall node', 'killall', 'node'],
      ['pkill node', 'pkill', 'node'],
      ['pkill -9 node', 'pkill', 'node'],
      ['pkill -SIGKILL node', 'pkill', 'node'],
      ['killall -9 bun', 'killall', 'bun'],
      ['killall -s KILL node', 'killall', 'node'],
      ['pkill -f node', 'pkill', 'node'],
      ['killall python', 'killall', 'python'],
      ['pkill -9 python3', 'pkill', 'python3'],
      ['killall java', 'killall', 'java'],
      ['pkill deno', 'pkill', 'deno'],
      ['pkill ruby', 'pkill', 'ruby'],
    ])('Scenario: %s is detected', (command, kill, target) => {
      expect(detectBroadProcessKill(command)).toEqual({ command: kill, target });
    });

    it('Scenario: detection survives compound commands and prefixes', () => {
      expect(detectBroadProcessKill('cd packages/app && killall node')).toEqual({
        command: 'killall',
        target: 'node',
      });
      expect(detectBroadProcessKill('sleep 1; pkill -9 node')).toEqual({
        command: 'pkill',
        target: 'node',
      });
      expect(detectBroadProcessKill('env killall node')).toEqual({
        command: 'killall',
        target: 'node',
      });
      expect(detectBroadProcessKill('sudo killall node')).toEqual({
        command: 'killall',
        target: 'node',
      });
      // env matched by basename and with its options consumed (EDDABK).
      expect(detectBroadProcessKill('/usr/bin/env killall node')).toEqual({
        command: 'killall',
        target: 'node',
      });
      expect(detectBroadProcessKill('env -i pkill node')).toEqual({
        command: 'pkill',
        target: 'node',
      });
      // POSIX single-quote rule: the backslash does not escape the closing
      // quote, so the `;` splits and the kill segment is visible (EDDABK).
      expect(detectBroadProcessKill(String.raw`echo 'a\'; pkill node`)).toEqual({
        command: 'pkill',
        target: 'node',
      });
    });

    it('Scenario: regex anchors around a bare name do not evade detection', () => {
      expect(detectBroadProcessKill(`pkill '^node$'`)).toEqual({
        command: 'pkill',
        target: 'node',
      });
      expect(detectBroadProcessKill('pkill -x node')).toEqual({
        command: 'pkill',
        target: 'node',
      });
      // In an ERE, `\j` is a literal `j` — `pkill '\java'` still kills every
      // java process, so the escape must not evade detection (EDDABK).
      expect(detectBroadProcessKill(String.raw`pkill '\java'`)).toEqual({
        command: 'pkill',
        target: 'java',
      });
    });
  });

  describe('Rule: project-scoped kill patterns stay allowed', () => {
    it('Scenario: the guide-sanctioned scoped patterns pass', () => {
      // These are the exact alternatives zombie-process-cleanup.md recommends.
      expect(detectBroadProcessKill('pkill -f "playwright.*$(pwd)"')).toBeUndefined();
      expect(
        detectBroadProcessKill('lsof -ti:3000 -ti:4000 | xargs kill -9 2> /dev/null'),
      ).toBeUndefined();
      expect(detectBroadProcessKill('./.safeword/scripts/cleanup-zombies.sh')).toBeUndefined();
    });

    it('Scenario: targeted kills by PID or specific name pass', () => {
      expect(detectBroadProcessKill('kill -9 12345')).toBeUndefined();
      expect(detectBroadProcessKill('killall my-custom-daemon')).toBeUndefined();
      expect(detectBroadProcessKill('pkill -f "node scripts/dev.js"')).toBeUndefined();
    });

    it('Scenario: a runtime name as a flag VALUE is a filter, not a target', () => {
      // `node` is a real user in official Node.js Docker images — these kill
      // myapp filtered to that user, not every node process.
      expect(detectBroadProcessKill('pkill -u node myapp')).toBeUndefined();
      expect(detectBroadProcessKill('pkill -U node -f myapp')).toBeUndefined();
      // ...but a runtime target AFTER a consumed flag value still detects.
      expect(detectBroadProcessKill('pkill --signal KILL node')).toEqual({
        command: 'pkill',
        target: 'node',
      });
    });

    it('Scenario: a runtime name that is not a kill target passes', () => {
      expect(detectBroadProcessKill(`git commit -m 'killall node'`)).toBeUndefined();
      expect(detectBroadProcessKill('echo killall node')).toBeUndefined();
      expect(detectBroadProcessKill('node scripts/run.js')).toBeUndefined();
      expect(detectBroadProcessKill('pgrep -f node')).toBeUndefined();
    });
  });
});

describe('requiresFailClosedShellGate (cursor routing)', () => {
  it('Scenario: a broad process kill routes to the delegated gate', () => {
    expect(requiresFailClosedShellGate({ command: 'killall node' })).toBe(true);
    expect(requiresFailClosedShellGate({ command: 'pkill -9 node' })).toBe(true);
  });

  it('Scenario: a scoped kill does not force the delegated gate', () => {
    expect(requiresFailClosedShellGate({ command: 'pkill -f "playwright.*$(pwd)"' })).toBe(false);
  });
});
