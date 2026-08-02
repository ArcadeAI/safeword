import { describe, expect, it } from 'vitest';

import { codexHostsFromProcessTable } from '../../src/codex-plugin/host-process.js';

const TABLE = `
  741     1 Fri Jul 31 16:02:31 2026 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT
 1288   741 Fri Jul 31 16:02:45 2026 /Applications/ChatGPT.app/Contents/Resources/codex -c features.code_mode_host=true app-server --analytics-default-enabled
63476  1288 Sun Aug  2 09:22:05 2026 /bin/zsh -c safeword codex install
70187 67233 Sun Aug  2 09:07:09 2026 /Applications/ChatGPT.app/Contents/Resources/codex app-server --listen stdio://
70000 63476 Sun Aug  2 09:22:06 2026 bunx --bun safeword@0.71.0-rc.2
malformed row
`;
const POSIX_START = new Date('Fri Jul 31 16:02:45 2026').toISOString();
const SECOND_POSIX_START = new Date('Sun Aug  2 09:07:09 2026').toISOString();

describe('Codex app-server process identity', () => {
  it('finds every running host and the current process ancestry', () => {
    expect(codexHostsFromProcessTable(TABLE, 70_000)).toEqual({
      available: true,
      running: [
        { pid: 1288, started_at: POSIX_START },
        { pid: 70_187, started_at: SECOND_POSIX_START },
      ],
      current: { pid: 1288, started_at: POSIX_START },
    });
  });

  it('returns no current host for a process outside every Codex ancestry', () => {
    expect(codexHostsFromProcessTable(TABLE, 741).current).toBeNull();
  });

  it('parses the static Windows PowerShell process-table format', () => {
    const table = [
      '1288\t741\t1785538965000\tC:\\Program Files\\Codex\\codex.exe app-server',
      '70000\t1288\t1785539000000\tbunx.exe safeword codex install',
    ].join('\n');

    expect(codexHostsFromProcessTable(table, 70_000, 'windows')).toEqual({
      available: true,
      running: [{ pid: 1288, started_at: '2026-07-31T23:02:45.000Z' }],
      current: { pid: 1288, started_at: '2026-07-31T23:02:45.000Z' },
    });
  });

  it('recognizes a quoted Windows executable path', () => {
    const table = '1288\t741\t1785538965000\t"C:\\Program Files\\Codex\\codex.exe" app-server';

    expect(codexHostsFromProcessTable(table, 1288, 'windows').current).toEqual({
      pid: 1288,
      started_at: '2026-07-31T23:02:45.000Z',
    });
  });
});
