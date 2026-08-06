export type CodexMigrationErrorCode =
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
  readonly profileChanged: boolean;
  readonly recoveryCommand?: string;

  constructor(
    code: CodexMigrationErrorCode,
    message: string,
    options?: ErrorOptions & { profileChanged?: boolean; recoveryCommand?: string },
  ) {
    super(message, options);
    this.name = 'CodexMigrationError';
    this.code = code;
    this.profileChanged = options?.profileChanged === true;
    this.recoveryCommand = options?.recoveryCommand;
  }
}
