/** Node 22-compatible Error narrowing. */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
