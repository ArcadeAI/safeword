/**
 * What a compatible reviewer advertises when asked what it supports.
 *
 * Fake reviewers must advertise every flag the runtime requires, or candidate
 * selection discards them and a test fails as `not_installed` for reasons that
 * have nothing to do with what it is testing. Adding a required capability
 * used to mean editing nine copies of these strings; it is one edit here.
 *
 * `--model` is included because the alternate-model route asks for it, even
 * though the runtime does not require it for selection.
 */
export const REVIEWER_CAPABILITIES = {
  claude: [
    '--output-format',
    '--json-schema',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--setting-sources',
    '--strict-mcp-config',
    '--tools',
    '--model',
  ].join(' '),
  codex: [
    '--json',
    '--sandbox',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable',
    '--config',
    '--model',
    '--output-schema',
  ].join(' '),
} as const satisfies Record<'claude' | 'codex', string>;
