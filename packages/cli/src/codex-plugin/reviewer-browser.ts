import { spawn } from 'node:child_process';
import nodePath from 'node:path';

const SPAWN_OPTIONS = { shell: false, stdio: 'ignore', detached: true } as const;
type BrowserOpener = { command: string; args: string[]; options: typeof SPAWN_OPTIONS };

/** The URL is always one argument to a fixed OS executable; no shell parses it. */
export function browserOpenerCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): BrowserOpener | undefined {
  if (platform === 'darwin')
    return { command: '/usr/bin/open', args: [url], options: SPAWN_OPTIONS };
  if (platform === 'linux')
    return { command: '/usr/bin/xdg-open', args: [url], options: SPAWN_OPTIONS };
  if (platform === 'win32') {
    const windowsRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
    return {
      command: nodePath.win32.join(windowsRoot, 'System32', 'rundll32.exe'),
      args: ['url.dll,FileProtocolHandler', url],
      options: SPAWN_OPTIONS,
    };
  }
  return undefined;
}

/** Report only that an OS opener process started; the browser may still decline. */
export async function requestBrowserOpen(url: string): Promise<boolean> {
  const opener = browserOpenerCommand(url);
  if (opener === undefined) return false;
  return new Promise(resolve => {
    const child = spawn(opener.command, opener.args, opener.options);
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
    child.once('error', () => {
      resolve(false);
    });
  });
}
