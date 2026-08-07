export function requirePinnedBunVersion(
  packageManager: string | undefined,
  actualVersion: string,
): string {
  const expectedVersion = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager ?? '')?.[1];
  if (expectedVersion === undefined) {
    throw new Error('Root package.json must pin Bun with `"packageManager": "bun@<version>"`.');
  }
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Claude plugin generation requires Bun ${expectedVersion} from root package.json; ` +
        `found ${actualVersion}. Install the pinned version and ensure it is first on PATH.`,
    );
  }
  return expectedVersion;
}
