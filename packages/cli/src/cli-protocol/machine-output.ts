export function machineOutputRequested(arguments_: readonly string[]): boolean {
  for (const argument of arguments_) {
    if (argument === '--') return false;
    if (argument === '--json') return true;
  }
  return false;
}
