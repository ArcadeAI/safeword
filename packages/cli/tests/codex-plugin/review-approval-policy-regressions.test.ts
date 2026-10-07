import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { enableCodexReviewApproval } from '../../src/codex-plugin/review-approval.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('existing Codex review restrictions', () => {
  it.each([
    '[plugins."safeword@safeword"]\nenabled = false\n',
    '[plugins."safeword@safeword".mcp_servers.safeword_review]\nenabled = false\n',
    '[plugins."safeword@safeword".mcp_servers.safeword_review]\ndefault_tools_approval_mode = "deny"\n',
    '[plugins."safeword@safeword".mcp_servers.safeword_review]\nenabled_tools = ["start_review"]\n',
    '[plugins."safeword@safeword".mcp_servers.safeword_review]\ndisabled_tools = ["start_reviewer_login"]\n',
    '[plugins."safeword@safeword".mcp_servers.safeword_review.tools.start_review]\napproval_mode = "approve"\nenabled = false\n',
  ])('preserves the original restricted profile: %s', original => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-policy-'));
    roots.push(root);
    const config = nodePath.join(root, 'config.toml');
    writeFileSync(config, original);
    expect(() => enableCodexReviewApproval({ CODEX_HOME: root })).toThrow('review');
    expect(readFileSync(config, 'utf8')).toBe(original);
  });
});
