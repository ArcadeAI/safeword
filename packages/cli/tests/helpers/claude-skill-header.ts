import { parse, stringify } from 'yaml';

export function normalizeClaudeSkillHeader(content: string): string {
  return content.replace(
    /^---\n([\s\S]*?)\n---\n/u,
    (_header, yaml: string) => `---\n${stringify(parse(yaml), { lineWidth: 0 })}---\n`,
  );
}
