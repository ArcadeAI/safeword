import { describe, expect, it } from 'vitest';

import { codexProjectBootstrapContent } from '../../src/codex-plugin/project-bootstrap.js';

describe('Codex project bootstrap configuration', () => {
  it('preserves user configuration and adds only a SessionStart advisory bootstrap', () => {
    const original = '[mcp_servers.github]\ncommand = "gh-mcp"\n';

    const result = codexProjectBootstrapContent(original);

    expect(result).toContain(original.trim());
    expect(result).toContain('[[hooks.SessionStart]]');
    expect(result).toContain('bunx --bun safeword@latest codex bootstrap');
    expect(result).toContain('.safeword/hooks/dependency-bootstrap.ts');
    expect(result).not.toContain('PreToolUse');
    expect(result).not.toContain('permissionDecision');
  });

  it('replaces its exact managed block without duplicating it', () => {
    const once = codexProjectBootstrapContent('');
    const twice = codexProjectBootstrapContent(once);

    expect(twice).toBe(once);
    expect(twice.match(/command = "bunx --bun safeword@latest codex bootstrap"/gu)).toHaveLength(1);
    expect(twice.match(/statusMessage = "Preparing safeword dependencies"/gu)).toHaveLength(1);
  });

  it('refuses malformed markers and unrecognized bootstrap ownership', () => {
    expect(() =>
      codexProjectBootstrapContent('# --- safeword codex bootstrap: begin ---\n'),
    ).toThrow('malformed Safeword bootstrap markers');
    expect(() =>
      codexProjectBootstrapContent(
        '[[hooks.SessionStart.hooks]]\ncommand = "bunx --bun safeword@latest codex bootstrap"\n',
      ),
    ).toThrow('unrecognized Safeword bootstrap command');
    expect(() =>
      codexProjectBootstrapContent(
        "[[hooks.SessionStart.hooks]]\ncommand = 'bun .safeword/hooks/dependency-bootstrap.ts'\n",
      ),
    ).toThrow('unrecognized Safeword bootstrap command');
  });

  it('preserves user-owned blank-line formatting outside its managed block', () => {
    const original =
      '[mcp_servers.one]\ncommand = "one"\n\n\n\n[mcp_servers.two]\ncommand = "two"\n';
    const installed = codexProjectBootstrapContent(original);

    expect(installed).toContain(
      '[mcp_servers.one]\ncommand = "one"\n\n\n\n[mcp_servers.two]\ncommand = "two"',
    );
    expect(codexProjectBootstrapContent(installed)).toBe(installed);
  });
});
