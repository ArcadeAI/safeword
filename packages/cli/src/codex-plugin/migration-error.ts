import type { Effect } from '../cli-protocol/result.js';

export type CodexMigrationErrorCode =
  | 'PLUGIN_INSTALL_FAILED'
  | 'PLUGIN_ENABLEMENT_UNKNOWN'
  | 'PLUGIN_ENABLEMENT_FAILED'
  | 'PLUGIN_MARKETPLACE_FAILED'
  | 'PLUGIN_PROFILE_BUSY'
  | 'PLUGIN_NEWER_PIN_PRESERVED'
  | 'AMBIGUOUS_LEGACY_CONFIG'
  | 'UNSAFE_MIGRATION_PATH'
  | 'BACKUP_EXISTS'
  | 'ROLLBACK_FAILED'
  | 'RECOVERY_CONFLICT'
  | 'PLAN_STALE'
  | 'FINALIZATION_PROOF_REQUIRED';

export class CodexMigrationError extends Error {
  readonly code: CodexMigrationErrorCode;
  readonly marketplaceReplaced: boolean;
  readonly profileChanged: boolean;
  readonly recoveryCommand?: string;

  constructor(
    code: CodexMigrationErrorCode,
    message: string,
    options?: ErrorOptions & {
      marketplaceReplaced?: boolean;
      profileChanged?: boolean;
      recoveryCommand?: string;
    },
  ) {
    super(message, options);
    this.name = 'CodexMigrationError';
    this.code = code;
    this.marketplaceReplaced = options?.marketplaceReplaced === true;
    this.profileChanged = options?.profileChanged === true;
    this.recoveryCommand = options?.recoveryCommand;
  }
}

function marketplaceRestorationFailed(error: unknown): boolean {
  return (
    error instanceof CodexMigrationError &&
    error.code === 'PLUGIN_MARKETPLACE_FAILED' &&
    error.profileChanged
  );
}

function pluginInstallIncomplete(error: unknown): boolean {
  return (
    error instanceof CodexMigrationError &&
    error.profileChanged &&
    (error.code === 'PLUGIN_INSTALL_FAILED' || error.code === 'PLUGIN_ENABLEMENT_UNKNOWN')
  );
}

export function codexProfileFailureEffects(error: unknown): Effect[] {
  if (marketplaceRestorationFailed(error)) {
    return [
      {
        kind: 'remove',
        target: 'Safeword Codex marketplace',
        operation: 'restoration-failed',
      },
    ];
  }
  if (pluginInstallIncomplete(error)) {
    return [
      {
        kind: 'install',
        target: 'Safeword Codex profile plugin',
        operation: 'enablement-unverified',
      },
    ];
  }
  if (error instanceof CodexMigrationError && error.profileChanged) {
    return [
      {
        kind: 'update',
        target: 'Safeword Codex profile',
        operation: 'mutation-incomplete',
      },
    ];
  }
  return [];
}

export function codexProfileFailureDestructiveEffects(error: unknown): Effect[] {
  return error instanceof CodexMigrationError && error.marketplaceReplaced
    ? [
        {
          kind: 'replace',
          target: 'Safeword Codex marketplace',
          operation: 'stable-channel',
        },
      ]
    : [];
}
