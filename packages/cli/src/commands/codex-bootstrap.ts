import { type CliResult, createResult } from '../cli-protocol/result.js';
import { codexPluginVersionMatchesPackage } from '../codex-plugin/migration.js';
import { installCodexPlugin, observeCodexMigrationResult } from '../codex-plugin/operations.js';
import {
  codexActivationIsPending,
  type CodexActivationMarkerIssue,
  codexActivationMarkerIssue,
  type CodexSessionProofObservation,
  observeCodexSessionProof,
} from '../codex-plugin/profile-proof.js';
import { resolveCodexProjectDirectory } from '../codex-plugin/project-directory.js';

interface SessionStartInput {
  session_id?: string;
}

const RETRY_COMMAND = 'bunx --bun safeword@latest codex install';
const UNVERIFIED_PROTECTION =
  'SAFEWORD PROTECTION IS UNVERIFIED IN THIS TASK. You can continue working, but current protection is unknown.';
const PROFILE_RESTART_REQUIRED =
  'Safeword is installed for your Codex profile, but this task has not verified the installed update. An older Safeword runtime may still be loaded. Restart Codex and start a new task before relying on the installed update.';
const OBSERVED_PROFILE_RESTART_REQUIRED =
  'Safeword is installed for your Codex profile, but this task has not verified the installed update. Restart Codex and start a new task before relying on the installed update.';
const PROFILE_MARKER_REPAIR_REQUIRED = `Safeword is installed for your Codex profile, but its activation marker could not be verified. Repair the profile once with: ${RETRY_COMMAND}`;
const PROFILE_MARKER_VERSION_REPAIR_REQUIRED = `Safeword is installed for your Codex profile, but its activation marker belongs to a different Safeword version. Repair the profile once with: ${RETRY_COMMAND}`;
const PROFILE_IDENTITY_UNAVAILABLE =
  "Safeword is installed for your Codex profile, but this packaged runtime's identity could not be verified. Reinstall Safeword before relying on this task's protection.";
const OBSERVED_RUNTIME =
  "Safeword protection from this task's previously loaded runtime was observed.";
const PROFILE_PROOF_UNVERIFIED =
  'Safeword is installed for your Codex profile, but exact SessionStart proof for this task is not yet available. This evidence alone does not establish that a restart is required.';
const INSTALL_COMPLETED_RESTART_REQUIRED =
  'Safeword was installed for your Codex profile, but the newly installed runtime is not active in this already-open task. Restart Codex and start a new task before relying on the installed version.';

type ProfileCurrency = 'current' | 'needs-install' | 'unverified';

interface ProfileObservation {
  currency: ProfileCurrency;
  /** Current profile state only; it cannot prove what an already-open task loaded. */
  installed: boolean | undefined;
}

type UnverifiedReason =
  | 'install-failed'
  | 'install-unverified'
  | 'installed'
  | 'marker-repair-required'
  | 'offline'
  | 'profile-unverified'
  | 'proof-untrusted'
  | 'proof-unverified'
  | 'restart-required';

type HookResultOptions = {
  changed?: boolean;
  configurationChanged?: boolean;
  installed?: boolean;
  networkOperation?: 'attempted' | 'succeeded';
  observedPluginVersion?: string;
} & (
  | { verification: 'current'; reason: 'current' }
  | { verification: 'older-observed'; reason: UnverifiedReason }
  | { verification: 'unverified'; reason: UnverifiedReason }
);

type NonCurrentVerification =
  | { observedPluginVersion: string | undefined; verification: 'older-observed' }
  | { observedPluginVersion?: never; verification: 'unverified' };

function sessionIdFromInput(rawInput: string): string | undefined {
  try {
    const sessionId = (JSON.parse(rawInput) as SessionStartInput).session_id?.trim();
    return sessionId === '' ? undefined : sessionId;
  } catch {
    return undefined;
  }
}

function additionalContext(message: string): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: message,
    },
  })}\n`;
}

function hookResult(body: string, options: HookResultOptions): CliResult {
  // Keep the compatibility boolean exact-current only. Consumers that need
  // the observed prior-runtime state use protection_verification.
  const protectionIsCurrent = options.verification === 'current';
  return createResult({
    state: options.changed === true ? 'changed' : 'healthy',
    changed: options.changed,
    effects:
      options.configurationChanged === true || options.networkOperation !== undefined
        ? {
            configuration:
              options.configurationChanged === true
                ? [{ kind: 'enable', target: 'Safeword Codex profile plugin' }]
                : [],
            network:
              options.networkOperation === undefined
                ? []
                : [
                    {
                      kind: 'fetch',
                      target: 'Safeword stable Codex marketplace',
                      operation: options.networkOperation,
                    },
                  ],
          }
        : undefined,
    presentation: { kind: 'raw', body },
    data: {
      command: 'codex bootstrap',
      protected_in_current_task: protectionIsCurrent ? true : undefined,
      protection_verification: options.verification,
      profile_plugin_installed: options.installed,
      observed_plugin_version: options.observedPluginVersion,
      reason: options.reason,
    },
  });
}

function observeProfilePlugin(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  observe: typeof observeCodexMigrationResult,
): ProfileObservation {
  try {
    const plugin = observe(cwd, environment).plugin;
    if (plugin.observation !== 'observed' || plugin.enabled === null) {
      return { currency: 'unverified', installed: undefined };
    }
    return {
      currency:
        plugin.enabled && codexPluginVersionMatchesPackage(plugin) ? 'current' : 'needs-install',
      installed: plugin.installed,
    };
  } catch {
    return { currency: 'unverified', installed: undefined };
  }
}

function installProfilePlugin(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  install: typeof installCodexPlugin,
): boolean {
  try {
    install({ cwd, environment, json: true, reportMigrationState: false });
    return true;
  } catch {
    return false;
  }
}

function unverifiedContext(detail: string): string {
  return additionalContext(`${UNVERIFIED_PROTECTION} ${detail}`);
}

function protectionContext(
  detail: string,
  proof: CodexSessionProofObservation | undefined,
): string {
  return proof?.status === 'prior-observed'
    ? additionalContext(`${OBSERVED_RUNTIME} ${detail}`)
    : unverifiedContext(detail);
}

function verificationOptions(
  proof: CodexSessionProofObservation | undefined,
): NonCurrentVerification {
  return proof?.status === 'prior-observed'
    ? {
        observedPluginVersion: proof.plugin_version ?? undefined,
        verification: 'older-observed',
      }
    : { verification: 'unverified' };
}

function profileRestartDetail(
  markerIssue: CodexActivationMarkerIssue | undefined,
  priorProtectionObserved: boolean,
): string {
  if (markerIssue === 'malformed') return PROFILE_MARKER_REPAIR_REQUIRED;
  if (markerIssue === 'identity-mismatch') return PROFILE_MARKER_VERSION_REPAIR_REQUIRED;
  if (markerIssue === 'package-unavailable') return PROFILE_IDENTITY_UNAVAILABLE;
  return priorProtectionObserved ? OBSERVED_PROFILE_RESTART_REQUIRED : PROFILE_RESTART_REQUIRED;
}

function profileVerificationReason(
  markerIssue: CodexActivationMarkerIssue | undefined,
  restartRequired: boolean,
  proof: CodexSessionProofObservation | undefined,
): UnverifiedReason {
  if (markerIssue === 'package-unavailable') return 'profile-unverified';
  if (markerIssue !== undefined) return 'marker-repair-required';
  if (restartRequired) return 'restart-required';
  return proof?.status === 'untrusted' ? 'proof-untrusted' : 'proof-unverified';
}

// eslint-disable-next-line complexity -- one fail-open boundary coordinates task proof, offline mode, profile observation, and installation
export function bootstrapCodexPlugin(
  cwd: string,
  rawInput: string,
  options: {
    environment?: NodeJS.ProcessEnv;
    offline?: boolean;
    observe?: typeof observeCodexMigrationResult;
    install?: typeof installCodexPlugin;
  } = {},
): CliResult {
  const environment = options.environment ?? process.env;
  const projectDirectory = resolveCodexProjectDirectory(cwd, environment);
  const sessionId = sessionIdFromInput(rawInput);
  const sessionProof =
    sessionId === undefined
      ? undefined
      : observeCodexSessionProof(projectDirectory, sessionId, environment);
  if (sessionProof?.status === 'current') {
    return hookResult('', { reason: 'current', verification: 'current' });
  }
  const priorProtectionObserved = sessionProof?.status === 'prior-observed';
  const taskVerification = verificationOptions(sessionProof);

  const observe = options.observe ?? observeCodexMigrationResult;
  const install = options.install ?? installCodexPlugin;
  const before = observeProfilePlugin(projectDirectory, environment, observe);

  if (before.currency === 'unverified') {
    return hookResult(
      protectionContext(
        `Safeword's Codex profile state could not be verified, so automatic installation was not attempted. Retry once with: ${RETRY_COMMAND}`,
        sessionProof,
      ),
      { reason: 'profile-unverified', ...taskVerification },
    );
  }

  if (before.currency === 'current') {
    const restartRequired = priorProtectionObserved || codexActivationIsPending(environment);
    const markerIssue = codexActivationMarkerIssue(environment);
    const restartDetail = profileRestartDetail(markerIssue, priorProtectionObserved);
    return hookResult(
      protectionContext(restartRequired ? restartDetail : PROFILE_PROOF_UNVERIFIED, sessionProof),
      {
        installed: before.installed,
        reason: profileVerificationReason(markerIssue, restartRequired, sessionProof),
        ...taskVerification,
      },
    );
  }

  if (options.offline === true) {
    return hookResult(
      protectionContext(
        'Automatic profile installation was skipped because Codex is offline. Start a new online Codex task in this repository to install and activate the current Safeword version.',
        sessionProof,
      ),
      { installed: before.installed, reason: 'offline', ...taskVerification },
    );
  }

  const installation = installProfilePlugin(projectDirectory, environment, install);
  if (!installation) {
    return hookResult(
      protectionContext(
        `Automatic profile installation failed. Retry once with: ${RETRY_COMMAND}`,
        sessionProof,
      ),
      {
        installed: before.installed,
        networkOperation: 'attempted',
        reason: 'install-failed',
        ...taskVerification,
      },
    );
  }

  const after = observeProfilePlugin(projectDirectory, environment, observe);
  if (after.currency !== 'current') {
    return hookResult(
      protectionContext(
        `Automatic profile installation completed, but the resulting profile state could not be verified. Retry once with: ${RETRY_COMMAND}`,
        sessionProof,
      ),
      {
        changed: true,
        installed: after.installed,
        networkOperation: 'succeeded',
        reason: 'install-unverified',
        ...taskVerification,
      },
    );
  }

  return hookResult(protectionContext(INSTALL_COMPLETED_RESTART_REQUIRED, sessionProof), {
    changed: true,
    configurationChanged: true,
    installed: after.installed,
    networkOperation: 'succeeded',
    reason: 'installed',
    ...taskVerification,
  });
}
