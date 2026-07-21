import { describe, expect, it } from 'vitest';

import { ARCADE_MCP_TOOL_GRANT, buildTrackerMcpConfig } from '../../src/pr-review/tracker.js';

const GATEWAY = 'https://api.bosslevel.dev/mcp/gw_3F3PbNNz9DdEJ6zdHqbegVC7mMo';

describe('assembling the tracker MCP config (36EEMY, R6)', () => {
  it('builds a valid Claude HTTP-MCP config for the gateway', () => {
    const json = buildTrackerMcpConfig({ gatewayUrl: GATEWAY, userId: 'alex@arcade.dev' });
    const parsed = JSON.parse(json ?? '') as {
      mcpServers: Record<string, { type: string; url: string; headers: Record<string, string> }>;
    };

    // The verified schema (code.claude.com/docs/en/mcp): mcpServers → type http → url → headers.
    const server = parsed.mcpServers.arcade;
    expect(server?.type).toBe('http');
    expect(server?.url).toBe(GATEWAY);
    expect(server?.headers['Arcade-User-ID']).toBe('alex@arcade.dev');
  });

  it('references the token by ${env-var}, never embeds a literal secret', () => {
    // Claude Code expands ${VAR} from the child env at runtime, so the file
    // carries a REFERENCE. The bearer then lives only in env — never the file,
    // never argv. Nothing to leak from either surface.
    const json = buildTrackerMcpConfig({ gatewayUrl: GATEWAY, userId: 'u' }) ?? '';

    expect(json).toContain('Bearer ${ARCADE_API_KEY}');
    // A caller who wrongly passed a real key must not see it embedded — the
    // function takes no secret at all, by design.
    expect(json).not.toMatch(/Bearer\s+(?!\$\{)/);
  });

  it('honours a custom env-var name for the key', () => {
    const json = buildTrackerMcpConfig({
      gatewayUrl: GATEWAY,
      userId: 'u',
      apiKeyEnvVar: 'ARCADE_PROD_KEY',
    });
    expect(json).toContain('Bearer ${ARCADE_PROD_KEY}');
  });

  it('returns undefined with no gateway — R6 degrades to the bare linkback', () => {
    // No tracker configured is a normal state, not an error: the reviewer reads
    // whatever intent the PR linkback carries and lowers its certainty (R7).
    expect(buildTrackerMcpConfig({ gatewayUrl: undefined, userId: 'u' })).toBeUndefined();
    expect(buildTrackerMcpConfig({ gatewayUrl: '', userId: 'u' })).toBeUndefined();
  });

  it('the tool grant matches the server name the config assigns', () => {
    const json = buildTrackerMcpConfig({ gatewayUrl: GATEWAY, userId: 'u' }) ?? '';
    // If these two drift, the config attaches but no tools are permitted.
    expect(json).toContain('"arcade"');
    expect(ARCADE_MCP_TOOL_GRANT).toBe('mcp__arcade');
  });

  it('omits the user header when no identity is resolved', () => {
    // Per-author identity that could not be mapped: send no Arcade-User-ID
    // rather than a wrong one. The gateway decides how to handle an absent user.
    const json = buildTrackerMcpConfig({ gatewayUrl: GATEWAY, userId: undefined }) ?? '';
    expect(json).not.toContain('Arcade-User-ID');
  });
});
