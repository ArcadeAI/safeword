export function extractFencedBashBlock(content: string, selector: number | string): string {
  const blocks = content
    .matchAll(/```bash\n([\s\S]*?)\n```/g)
    .map(match => match[1] ?? '')
    .toArray();
  const block =
    typeof selector === 'number'
      ? blocks[selector - 1]
      : blocks.find(candidate => candidate.includes(selector));
  if (block === undefined) throw new Error(`Missing bash block ${selector}`);
  return block;
}
