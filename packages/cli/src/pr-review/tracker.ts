// Assembling the tracker broker's MCP config (ticket 36EEMY, Rule TB1.R6).
//
// The reviewer reads the linked issue as the PR author, through an arcade.dev
// gateway. This turns a configured gateway URL into the JSON that the Claude
// path attaches via `--mcp-config`.
//
// The secret never touches this file. Claude Code expands `${VAR}` from the
// child's environment inside the config, so the config carries the literal text
// `Bearer ${ARCADE_API_KEY}` — a reference, not the key. The bearer lives only
// in the child env: never in the config file, never in argv. There is nothing
// here to leak from either surface, which is why this function takes no secret.
//
// Schema verified against code.claude.com/docs/en/mcp: `mcpServers` → `type:
// "http"` → `url` → `headers`.

/** The default env var Claude expands for the bearer. The workflow sets it from a secret. */
const DEFAULT_API_KEY_ENV = 'ARCADE_API_KEY';

/**
 * The `--allowed-tools` entry that permits the gateway's tools. Must match the
 * server NAME the config assigns below (`arcade`); if the two drift the config
 * attaches but no tool is allowed, so it is co-located with the assembly.
 */
export const ARCADE_MCP_TOOL_GRANT = 'mcp__arcade';

/** The server key inside `mcpServers`. Also the middle segment of the tool grant. */
const SERVER_NAME = 'arcade';

export interface TrackerConfigInput {
  /** The arcade.dev gateway endpoint (`.safeword/config.json` → prReview.arcade.gatewayUrl). */
  gatewayUrl: string | undefined;
  /**
   * The end user the read is brokered as (`Arcade-User-ID`). Absent when
   * per-author identity could not be mapped — then the header is omitted rather
   * than sent wrong.
   */
  userId: string | undefined;
  /** Env var Claude expands for the bearer. Defaults to `ARCADE_API_KEY`. */
  apiKeyEnvVar?: string;
}

/**
 * Build the MCP config JSON, or `undefined` when no gateway is configured.
 *
 * Undefined is a normal state (R6): the reviewer falls back to whatever the PR
 * linkback carries and lowers the certainty it claims (R7). It is never an error.
 */
export function buildTrackerMcpConfig(input: TrackerConfigInput): string | undefined {
  if (input.gatewayUrl === undefined || input.gatewayUrl.length === 0) return undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer \${${input.apiKeyEnvVar ?? DEFAULT_API_KEY_ENV}}`,
  };
  // Only broker as a user when one was resolved. A wrong id reads the wrong
  // person's permissions; an absent one lets the gateway decide.
  if (input.userId !== undefined && input.userId.length > 0) {
    headers['Arcade-User-ID'] = input.userId;
  }

  return JSON.stringify({
    mcpServers: {
      [SERVER_NAME]: {
        type: 'http',
        url: input.gatewayUrl,
        headers,
      },
    },
  });
}
