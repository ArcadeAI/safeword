export const CLAUDE_PLUGIN_ID = 'safeword@safeword';

export const CLAUDE_MIGRATION_SCHEMA = {
  paths: {
    proof: 'plugins/data/safeword-safeword/execution-proof-v1.json',
    proofDirectory: 'plugins/data/safeword-safeword/execution-proofs-v2',
    pluginMarker: '.safeword/claude-plugin/plugin-mode-v1.json',
    transaction: '.safeword/claude-plugin/cleanup-transaction-v1.json',
  },
} as const;
