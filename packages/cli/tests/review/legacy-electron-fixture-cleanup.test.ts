import { rmSync } from 'node:fs';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it('restores the fixture environment when its initial frozen install fails', async () => {
  const previous = {
    path: process.env.PATH,
    keyRoot: process.env.SAFEWORD_REVIEW_KEY_ROOT,
    worker: process.env.SAFEWORD_CLI_ENTRYPOINT,
  };
  vi.stubEnv('SAFEWORD_ELECTRON_FIXTURE_MODE', 'install-failure');
  try {
    await expect(electronAuthorizationFixture()).rejects.toThrow('Electron frozen install failed');
    expect(process.env.PATH).toBe(previous.path);
    expect(process.env.SAFEWORD_REVIEW_KEY_ROOT).toBe(previous.keyRoot);
    expect(process.env.SAFEWORD_CLI_ENTRYPOINT).toBe(previous.worker);
  } finally {
    // Clean only directories allocated by this failed constructor while RED.
    // Once construction is exception-safe, these overrides are already restored.
    const keyRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
    if (keyRoot !== undefined && keyRoot !== previous.keyRoot) {
      const owned = path.dirname(keyRoot);
      if (path.basename(owned).startsWith('safeword-electron-runner-'))
        rmSync(owned, { recursive: true, force: true });
    }
    const worker = process.env.SAFEWORD_CLI_ENTRYPOINT;
    if (worker !== undefined && worker !== previous.worker) {
      const owned = path.dirname(worker);
      if (path.basename(owned).startsWith('electron-authorization-'))
        rmSync(owned, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
  }
}, 30_000);
