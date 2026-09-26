import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { enableCodexReviewApproval } from '../../src/codex-plugin/review-approval.js';

const homes: string[] = [];

function codexHome(): string {
  const home = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-approval-'));
  homes.push(home);
  return home;
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('one-time Codex review-tool approval', () => {
  it('adds only the named tool, preserves existing config, and stays idempotent', () => {
    const home = codexHome();
    const config = nodePath.join(home, 'config.toml');
    writeFileSync(config, '# customer comment\n[mcp_servers.github]\ncommand = "gh"\n', {
      mode: 0o600,
    });
    expect(enableCodexReviewApproval({ CODEX_HOME: home })).toBe(true);
    const first = readFileSync(config, 'utf8');
    expect(first).toContain('# customer comment\n[mcp_servers.github]\ncommand = "gh"');
    expect(first).toContain(
      '[plugins."safeword@safeword".mcp_servers.safeword_review.tools.start_review]\napproval_mode = "approve"',
    );
    expect(first).not.toContain('default_tools_approval_mode');
    expect(enableCodexReviewApproval({ CODEX_HOME: home })).toBe(false);
    expect(readFileSync(config, 'utf8')).toBe(first);
    expect(lstatSync(config).mode & 0o777).toBe(0o600);
  });

  it('leaves a conflicting user policy and a symlinked config untouched', () => {
    const home = codexHome();
    const config = nodePath.join(home, 'config.toml');
    const denied =
      '[plugins."safeword@safeword".mcp_servers.safeword_review.tools.start_review]\napproval_mode = "prompt"\n';
    writeFileSync(config, denied);
    expect(() => enableCodexReviewApproval({ CODEX_HOME: home })).toThrow(
      'already has a review-tool policy',
    );
    expect(readFileSync(config, 'utf8')).toBe(denied);
    rmSync(config);
    const customerFile = nodePath.join(home, 'customer.toml');
    writeFileSync(customerFile, '# owned by customer\n');
    symlinkSync(customerFile, config);
    expect(() => enableCodexReviewApproval({ CODEX_HOME: home })).toThrow('not a regular file');
    expect(readFileSync(customerFile, 'utf8')).toBe('# owned by customer\n');
  });
});
