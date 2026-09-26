import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { REVIEW_LOGIN_HTML } from '../../src/codex-plugin/review-login-ui.js';

describe('reviewer sign-in view', () => {
  it('requests a browser open when the host delivers the CLI sign-in URL', () => {
    const messages: { method: string; params?: { url?: string } }[] = [];
    const elements = new Map<
      string,
      { hidden: boolean; textContent: string; append: () => void; addEventListener: () => void }
    >();
    const element = (id: string) => {
      let value = elements.get(id);
      if (value === undefined) {
        value = {
          hidden: false,
          textContent: '',
          append: () => 0,
          addEventListener: () => 0,
        };
        elements.set(id, value);
      }
      return value;
    };
    let receiveMessage: ((event: { source: object; data: unknown }) => void) | undefined;
    const parent = {
      postMessage: (message: { method: string; params?: { url?: string } }) => {
        messages.push(message);
      },
    };
    const script = /<script>([\s\S]*?)<\/script>/u.exec(REVIEW_LOGIN_HTML)?.[1];
    expect(script).toBeDefined();
    // The only evaluated script is the checked-in static view source.
    // eslint-disable-next-line sonarjs/code-eval -- Test the packaged static MCP Apps script.
    runInNewContext(script ?? '', {
      document: { getElementById: element, createElement: () => ({ textContent: '' }) },
      window: {
        parent,
        addEventListener: (_name: string, listener: typeof receiveMessage) => {
          receiveMessage = listener;
        },
      },
    });
    expect(messages[0]?.method).toBe('ui/initialize');
    receiveMessage?.({
      source: parent,
      data: {
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: {
          structuredContent: {
            reviewer: 'codex',
            auth_url: 'https://auth.openai.com/codex/device',
            device_code: 'ABCDE-12345',
          },
        },
      },
    });
    expect(messages.at(-1)).toMatchObject({
      method: 'ui/open-link',
      params: { url: 'https://auth.openai.com/codex/device' },
    });
    expect(element('code').hidden).toBe(false);
  });
});
