import { describe, expect, it } from 'vitest';

import { browserOpenerCommand } from '../../src/codex-plugin/reviewer-browser.js';

describe('reviewer sign-in browser opener', () => {
  it.each(['darwin', 'linux', 'win32'] as const)(
    'passes the entire URL as one argument on %s without a shell',
    platform => {
      const url =
        'https://auth.openai.com/codex/device?state=$(touch%20/tmp/unsafe)&name=two words';
      const opener = browserOpenerCommand(url, platform);
      expect(opener).toBeDefined();
      const expected = {
        darwin: /\/usr\/bin\/open$/u,
        linux: /\/usr\/bin\/xdg-open$/u,
        win32: /rundll32\.exe$/u,
      };
      expect(opener?.command).toMatch(expected[platform]);
      expect(opener?.args.at(-1)).toBe(url);
      expect(opener?.options.shell).toBe(false);
    },
  );

  it('leaves unsupported systems to the MCP Apps fallback', () => {
    expect(browserOpenerCommand('https://claude.com/login', 'freebsd')).toBeUndefined();
  });
});
