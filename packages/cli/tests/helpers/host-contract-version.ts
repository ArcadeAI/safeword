export type HostVersionObservation =
  | { readonly state: 'verified'; readonly version: string }
  | {
      readonly state: 'unavailable';
      readonly reason: 'unreadable-version' | 'version-mismatch';
      readonly expectedVersion: string;
      readonly observedVersion?: string;
    };

/** Validate version-only host output before attempting real-host conformance. */
export function observeExactHostVersion(
  expectedVersion: string,
  output: string,
): HostVersionObservation {
  const observedVersion = /^(?:codex-cli |opencode v)?(\d+\.\d+\.\d+)(?: \(Claude Code\))?$/u.exec(
    output.trim(),
  )?.[1];
  if (observedVersion === undefined) {
    return { state: 'unavailable', reason: 'unreadable-version', expectedVersion };
  }
  if (observedVersion !== expectedVersion) {
    return {
      state: 'unavailable',
      reason: 'version-mismatch',
      expectedVersion,
      observedVersion,
    };
  }
  return { state: 'verified', version: observedVersion };
}
