export async function resolveCodexFinalizationConfirmation(_options: {
  assumeYes: boolean;
  confirm?: () => Promise<boolean>;
}): Promise<boolean> {
  await Promise.resolve();
  throw new Error('Codex finalization confirmation is not implemented.');
}
