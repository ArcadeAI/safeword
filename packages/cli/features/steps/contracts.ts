export function captureContractError(contract: () => void): Error | undefined {
  try {
    contract();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
