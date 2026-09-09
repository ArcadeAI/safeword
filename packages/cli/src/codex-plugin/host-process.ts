/* eslint-disable unicorn/no-null -- host observations use explicit null when ancestry is unavailable */

import { spawnSync } from 'node:child_process';

export interface CodexHostProcessIdentity {
  pid: number;
  started_at: string;
}

interface ProcessRow extends CodexHostProcessIdentity {
  parentPid: number;
  command: string;
}

export interface CodexHostProcessObservation {
  available: boolean;
  running: CodexHostProcessIdentity[];
  current: CodexHostProcessIdentity | null;
}

const WINDOWS_PROCESS_COMMAND =
  'Get-CimInstance Win32_Process | ForEach-Object { $started = [DateTimeOffset]$_.CreationDate; Write-Output ("{0}`t{1}`t{2}`t{3}" -f $_.ProcessId, $_.ParentProcessId, $started.ToUnixTimeMilliseconds(), $_.CommandLine) }';

function parseProcessRows(output: string): ProcessRow[] {
  return output.split('\n').flatMap(line => {
    const columns = line.trim().split(/\s+/u);
    if (columns.length < 8) return [];
    const pid = Number(columns[0]);
    const parentPid = Number(columns[1]);
    if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(parentPid)) return [];
    const startedAt = new Date(columns.slice(2, 7).join(' '));
    if (Number.isNaN(startedAt.getTime())) return [];
    return [
      {
        pid,
        parentPid,
        started_at: startedAt.toISOString(),
        command: columns.slice(7).join(' '),
      },
    ];
  });
}

function parseWindowsProcessRows(output: string): ProcessRow[] {
  return output.split('\n').flatMap(line => {
    const [pidText, parentPidText, startedAtText, ...command] = line.trimEnd().split('\t');
    const pid = Number(pidText);
    const parentPid = Number(parentPidText);
    const startedAt = new Date(Number(startedAtText));
    if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(parentPid) || command.length === 0)
      return [];
    if (Number.isNaN(startedAt.getTime())) return [];
    return [
      {
        pid,
        parentPid,
        started_at: startedAt.toISOString(),
        command: command.join('\t'),
      },
    ];
  });
}

function isCodexAppServer(row: ProcessRow): boolean {
  const command = row.command.replaceAll('\\', '/');
  return (
    /(?:^|\/)codex(?:\.exe)?["']?\s/iu.test(command) && /(?:^|\s)app-server(?:\s|$)/u.test(command)
  );
}

export function codexHostsFromProcessTable(
  output: string,
  parentPid: number,
  format: 'posix' | 'windows' = 'posix',
): CodexHostProcessObservation {
  const rows = format === 'windows' ? parseWindowsProcessRows(output) : parseProcessRows(output);
  const running = rows
    .filter(row => isCodexAppServer(row))
    .map(({ pid, started_at }) => ({ pid, started_at }));
  const byPid = new Map(rows.map(row => [row.pid, row]));
  let candidate = byPid.get(parentPid);
  const visited = new Set<number>();
  while (candidate !== undefined && !visited.has(candidate.pid)) {
    if (isCodexAppServer(candidate)) {
      return {
        available: true,
        running,
        current: { pid: candidate.pid, started_at: candidate.started_at },
      };
    }
    visited.add(candidate.pid);
    candidate = byPid.get(candidate.parentPid);
  }
  return { available: true, running, current: null };
}

export function observeCodexHostProcesses(): CodexHostProcessObservation {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_COMMAND],
      { encoding: 'utf8', timeout: 2000 },
    );
    if (result.status !== 0) return { available: false, running: [], current: null };
    return codexHostsFromProcessTable(result.stdout, process.ppid, 'windows');
  }
  const result = spawnSync('ps', ['-axo', 'pid=,ppid=,lstart=,command='], {
    encoding: 'utf8',
    timeout: 2000,
  });
  if (result.status !== 0) return { available: false, running: [], current: null };
  return codexHostsFromProcessTable(result.stdout, process.ppid);
}

export function sameCodexHost(
  left: CodexHostProcessIdentity,
  right: CodexHostProcessIdentity,
): boolean {
  return left.pid === right.pid && left.started_at === right.started_at;
}
