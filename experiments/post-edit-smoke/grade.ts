export const UNRELATED = 'export const untouched={z:1,a:2};\n';
export const INITIAL = `${UNRELATED}export function greet(name) { return "Hello, " + name; }\n`;
export const HELPER = 'export function formatName(name) { return name.trim().toUpperCase(); }\n';

export interface HookObservation {
  before: string;
  after: string;
  output: string;
  status: number | null;
}

export interface Observation {
  agentSucceeded: boolean;
  hooks: HookObservation[];
  finalSource: string;
  helperUnchanged: boolean;
  taskWorks: boolean;
}

const hasImport = (source: string): boolean =>
  /\bimport\s*\{\s*formatName\s*\}\s*from\s*['"]\.\/name\.mjs['"]/u.test(source);

export function sawPendingFeedback(record: HookObservation): boolean {
  try {
    const context: unknown = JSON.parse(record.output)?.hookSpecificOutput?.additionalContext;
    return (
      hasImport(record.before) &&
      typeof context === 'string' &&
      context.includes('no-unused-vars') &&
      context.includes('formatName')
    );
  } catch {
    return false;
  }
}

export function grade(observation: Observation): string[] {
  const issues: string[] = [];
  if (!observation.agentSucceeded) issues.push('Agent did not finish successfully.');
  if (!observation.hooks.some(sawPendingFeedback))
    issues.push('No intermediate unused-import feedback observed.');
  if (!observation.taskWorks) issues.push('Final greeting output is incorrect.');
  if (!observation.helperUnchanged) issues.push('The helper was changed.');
  if (!hasImport(observation.finalSource)) issues.push('The required import is missing.');
  if (!observation.finalSource.split('\n').includes(UNRELATED.trimEnd()))
    issues.push('Unrelated final bytes changed.');
  let pendingSeen = false;
  for (const record of observation.hooks) {
    if (record.status !== 0) issues.push('Hook process did not succeed.');
    if (record.before !== record.after) issues.push('Hook mutated the file.');
    if (
      ![record.before, record.after].every(source =>
        source.split('\n').includes(UNRELATED.trimEnd()),
      )
    )
      issues.push('Unrelated bytes changed during an edit.');
    pendingSeen ||= sawPendingFeedback(record);
    if (pendingSeen && !hasImport(record.after))
      issues.push('Pending import was removed after feedback.');
  }
  return [...new Set(issues)];
}
