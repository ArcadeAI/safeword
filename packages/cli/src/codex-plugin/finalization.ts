export async function resolveCodexFinalizationConfirmation(_options: {
  assumeYes: boolean;
  confirm?: () => Promise<boolean>;
}): Promise<boolean> {
  if (_options.assumeYes) return true;
  if (_options.confirm === undefined) {
    throw new Error(
      'Finalization requires confirmation. Re-run interactively or pass --finalize --yes.',
    );
  }
  return _options.confirm();
}
