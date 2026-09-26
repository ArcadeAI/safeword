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
        `found ${actualVersion}. Run \`mise install\`, then retry the command with \`mise exec --\` (for example, \`mise exec -- bun run fix:generated-surfaces\`).`,
    );
  }
  return expectedVersion;
}
