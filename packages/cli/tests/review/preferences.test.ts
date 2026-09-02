import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  effectiveConfiguredRoutes,
  resetScopedReviewRoutes,
  resolveSafewordUserConfigPath,
  setScopedReviewRoutes,
} from '../../src/review/preferences.js';

describe('review route preferences', () => {
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const originalHome = process.env.HOME;
  afterEach(() => {
    process.env.XDG_CONFIG_HOME = originalXdg;
    process.env.HOME = originalHome;
  });

  function fixture(): { cwd: string; user: string } {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-preferences-'));
    const cwd = nodePath.join(root, 'project');
    const xdg = nodePath.join(root, 'xdg');
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdg;
    return { cwd, user: nodePath.join(xdg, 'safeword', 'config.json') };
  }

  it('resolves XDG and Windows profile paths', () => {
    expect(
      resolveSafewordUserConfigPath({ platform: 'unix', env: { XDG_CONFIG_HOME: '/cfg' } }),
    ).toBe('/cfg/safeword/config.json');
    expect(
      resolveSafewordUserConfigPath({
        platform: 'windows',
        env: { APPDATA: String.raw`C:\Users\a\AppData` },
      }),
    ).toBe(String.raw`C:\Users\a\AppData\Safeword\config.json`);
    expect(resolveSafewordUserConfigPath({ platform: 'unix', env: { HOME: '/home/alex' } })).toBe(
      '/home/alex/.config/safeword/config.json',
    );
    expect(
      resolveSafewordUserConfigPath({
        platform: 'windows',
        env: { USERPROFILE: String.raw`C:\Users\a` },
      }),
    ).toBe(String.raw`C:\Users\a\.config\safeword\config.json`);
  });

  it('treats an empty project route map as absent but rejects an empty author list', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: {} }),
    );
    expect(effectiveConfiguredRoutes(cwd, 'claude')?.source).toBe('user');
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { claude: [] } }),
    );
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow('non-empty array');
  });

  it('uses project then user precedence independently per author', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'opencode', model: 'vendor/user' }],
          codex: [{ reviewer: 'claude' }],
        },
      }),
    );
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: { codex: [{ reviewer: 'opencode', model: 'vendor/project' }] },
      }),
    );
    expect(effectiveConfiguredRoutes(cwd, 'claude')?.source).toBe('user');
    expect(effectiveConfiguredRoutes(cwd, 'codex')).toMatchObject({
      source: 'project',
      routes: [{ model: 'vendor/project' }],
    });
  });

  it('sets and resets one author without changing unrelated content', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({
        theme: 'dark',
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] },
      }),
    );
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'opencode', model: 'vendor/model' }]);
    expect(JSON.parse(readFileSync(user, 'utf8'))).toMatchObject({
      theme: 'dark',
      crossAgentReviewRoutes: {
        codex: [{ reviewer: 'claude' }],
        claude: [{ reviewer: 'opencode', model: 'vendor/model' }],
      },
    });
    expect(resetScopedReviewRoutes(cwd, 'user', 'claude')).toBe(true);
    expect(JSON.parse(readFileSync(user, 'utf8'))).toEqual({
      theme: 'dark',
      crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] },
    });
  });

  it('replaces an existing same-author list without merging', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'opencode' }] } }),
    );

    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex', model: 'model-a' }]);

    expect(JSON.parse(readFileSync(user, 'utf8'))).toMatchObject({
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex', model: 'model-a' }] },
    });
  });

  it('refuses to overwrite malformed scoped configuration', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, '{ malformed');
    expect(() => {
      setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    }).toThrow(user);
    expect(readFileSync(user, 'utf8')).toBe('{ malformed');
    expect(() => resetScopedReviewRoutes(cwd, 'user', 'claude')).toThrow(user);
    expect(readFileSync(user, 'utf8')).toBe('{ malformed');
  });

  it('project set ignores a malformed user scope', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, '{ malformed');
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(
      project,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'opencode' }]);
    expect(readFileSync(user, 'utf8')).toBe('{ malformed');
  });

  it('user set ignores a malformed project scope', () => {
    const { cwd, user } = fixture();
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(project, '{ malformed');
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'opencode' }]);
    expect(readFileSync(project, 'utf8')).toBe('{ malformed');
    expect(existsSync(user)).toBe(true);
  });

  it('project reset ignores a malformed user scope', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, '{ malformed');
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'opencode' }]);
    expect(resetScopedReviewRoutes(cwd, 'project', 'claude')).toBe(true);
    expect(readFileSync(user, 'utf8')).toBe('{ malformed');
  });

  it('user reset ignores a malformed project scope', () => {
    const { cwd } = fixture();
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(project, '{ malformed');
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'opencode' }]);
    expect(resetScopedReviewRoutes(cwd, 'user', 'claude')).toBe(true);
    expect(readFileSync(project, 'utf8')).toBe('{ malformed');
  });

  it('creates only the selected scope and leaves an absent reset as a no-op', () => {
    const { cwd, user } = fixture();
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    expect(resetScopedReviewRoutes(cwd, 'user', 'claude')).toBe(false);
    expect(existsSync(user)).toBe(false);
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    expect(existsSync(user)).toBe(true);
    expect(existsSync(project)).toBe(false);
  });

  it('fails effective resolution when either scoped file is malformed', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(project, '{ malformed');
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow(project);
  });

  it('fails effective resolution when the user profile is malformed', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, '{ malformed');
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow(user);
  });

  it('refuses to overwrite malformed project configuration', () => {
    const { cwd } = fixture();
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(project, '{ malformed');
    expect(() => {
      setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'codex' }]);
    }).toThrow(project);
    expect(readFileSync(project, 'utf8')).toBe('{ malformed');
  });

  it('refuses to reset malformed project configuration', () => {
    const { cwd } = fixture();
    const project = nodePath.join(cwd, '.safeword', 'config.json');
    writeFileSync(project, '{ malformed');
    expect(() => resetScopedReviewRoutes(cwd, 'project', 'claude')).toThrow(project);
    expect(readFileSync(project, 'utf8')).toBe('{ malformed');
  });

  it('rejects an empty user route list before using project routes', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, JSON.stringify({ crossAgentReviewRoutes: { claude: [] } }));
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'codex' }]);
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow('non-empty array');
  });

  it('keeps user routes when the project configures another author', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] } }),
    );
    expect(effectiveConfiguredRoutes(cwd, 'claude')?.source).toBe('user');
  });

  it('replaces a user list with the complete project list', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'opencode' }] } }),
    );
    expect(effectiveConfiguredRoutes(cwd, 'claude')).toMatchObject({
      source: 'project',
      routes: [{ reviewer: 'opencode' }],
    });
  });

  it('removes only the selected author during reset', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(
      user,
      JSON.stringify({
        theme: 'dark',
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex' }],
          codex: [{ reviewer: 'claude' }],
        },
      }),
    );
    resetScopedReviewRoutes(cwd, 'user', 'claude');
    expect(JSON.parse(readFileSync(user, 'utf8'))).toEqual({
      theme: 'dark',
      crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] },
    });
  });

  it('refuses to reset malformed target configuration', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, '{ malformed');
    expect(() => resetScopedReviewRoutes(cwd, 'user', 'claude')).toThrow(user);
    expect(readFileSync(user, 'utf8')).toBe('{ malformed');
  });

  it('falls back to built-in routes when both scopes are absent', () => {
    const { cwd } = fixture();
    expect(effectiveConfiguredRoutes(cwd, 'claude')).toBeUndefined();
  });

  it('reveals built-in routes after the only configured list is reset', () => {
    const { cwd } = fixture();
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    resetScopedReviewRoutes(cwd, 'user', 'claude');
    expect(effectiveConfiguredRoutes(cwd, 'claude')).toBeUndefined();
  });

  it('reveals the user list after the project list is reset', () => {
    const { cwd } = fixture();
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'opencode' }]);
    resetScopedReviewRoutes(cwd, 'project', 'claude');
    expect(effectiveConfiguredRoutes(cwd, 'claude')?.source).toBe('user');
  });

  it('first user write creates no project file', () => {
    const { cwd, user } = fixture();
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    expect(existsSync(user)).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword', 'config.json'))).toBe(false);
  });

  it('first project write creates no user file', () => {
    const { cwd, user } = fixture();
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'codex' }]);
    expect(existsSync(nodePath.join(cwd, '.safeword', 'config.json'))).toBe(true);
    expect(existsSync(user)).toBe(false);
  });

  it('uses a project-only route list as authority', () => {
    const { cwd } = fixture();
    setScopedReviewRoutes(cwd, 'project', 'codex', [{ reviewer: 'claude' }]);
    expect(effectiveConfiguredRoutes(cwd, 'codex')?.source).toBe('project');
  });

  it('sets project routes without creating a user profile', () => {
    const { cwd, user } = fixture();
    setScopedReviewRoutes(cwd, 'project', 'codex', [{ reviewer: 'claude' }]);
    expect(existsSync(user)).toBe(false);
  });

  it('resets project routes without changing the user list', () => {
    const { cwd, user } = fixture();
    setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    const before = readFileSync(user, 'utf8');
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'opencode' }]);
    resetScopedReviewRoutes(cwd, 'project', 'claude');
    expect(readFileSync(user, 'utf8')).toBe(before);
  });

  it('rejects an empty project author list', () => {
    const { cwd } = fixture();
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { claude: [] } }),
    );
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow('non-empty array');
  });

  it('treats an unlocatable user profile as absent during reads', () => {
    const { cwd } = fixture();
    process.env.XDG_CONFIG_HOME = '';
    process.env.HOME = '';
    setScopedReviewRoutes(cwd, 'project', 'claude', [{ reviewer: 'codex' }]);
    expect(effectiveConfiguredRoutes(cwd, 'claude')?.source).toBe('project');
  });

  it('rejects null and invalid route maps with the config path', () => {
    const { cwd, user } = fixture();
    mkdirSync(nodePath.dirname(user), { recursive: true });
    writeFileSync(user, 'null');
    expect(() => effectiveConfiguredRoutes(cwd, 'claude')).toThrow(user);
    writeFileSync(user, JSON.stringify({ crossAgentReviewRoutes: [] }));
    expect(() => {
      setScopedReviewRoutes(cwd, 'user', 'claude', [{ reviewer: 'codex' }]);
    }).toThrow(user);
    expect(() => resetScopedReviewRoutes(cwd, 'user', 'claude')).toThrow(user);
  });
});
