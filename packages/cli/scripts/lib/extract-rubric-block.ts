export function extractRubricBlock(
  source: string,
  startMarker: string,
  endMarker: string,
  errors: { missingPair: string; outOfOrder: string; empty: string },
): string {
  if (source.split(startMarker).length !== 2 || source.split(endMarker).length !== 2)
    throw new Error(errors.missingPair);

  const start = source.indexOf(startMarker) + startMarker.length;
  const end = source.indexOf(endMarker);
  if (end <= start) throw new Error(errors.outOfOrder);

  const rubric = source.slice(start, end).trim();
  if (rubric === '') throw new Error(errors.empty);
  return rubric;
}
