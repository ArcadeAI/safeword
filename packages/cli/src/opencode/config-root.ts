import nodePath from 'node:path';

export interface PlatformEnvironment {
  readonly platform: 'unix' | 'windows';
  readonly env: Readonly<Record<string, string | undefined>>;
}

function usable(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 || !nodePath.isAbsolute(trimmed)
    ? undefined
    : trimmed;
}

export function resolveOpenCodeConfigRoot(input: PlatformEnvironment): string | undefined {
  const explicit = input.env.OPENCODE_CONFIG_DIR?.trim();
  if (explicit !== undefined && explicit.length > 0 && !nodePath.isAbsolute(explicit)) {
    return undefined;
  }
  const configured = usable(input.env.OPENCODE_CONFIG_DIR);
  if (configured !== undefined) return configured;
  const xdg = usable(input.env.XDG_CONFIG_HOME);
  if (xdg !== undefined) return nodePath.join(xdg, 'opencode');
  if (input.platform === 'windows') {
    const userProfile = usable(input.env.USERPROFILE);
    return userProfile === undefined
      ? undefined
      : nodePath.join(userProfile, '.config', 'opencode');
  }
  const home = usable(input.env.HOME);
  return home === undefined ? undefined : nodePath.join(home, '.config', 'opencode');
}
