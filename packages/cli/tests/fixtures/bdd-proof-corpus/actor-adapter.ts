export interface HostEvidence {
  readonly host: string;
  readonly observationClass: 'host-adapter';
  readonly reviewSettingsInstalled: boolean;
}

export function observeInstalledReviewSettings(
  host: string,
  readInstalledState: (host: string) => boolean,
): HostEvidence {
  return {
    host,
    observationClass: 'host-adapter',
    reviewSettingsInstalled: readInstalledState(host),
  };
}
