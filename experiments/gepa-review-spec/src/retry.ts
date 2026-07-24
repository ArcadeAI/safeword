/**
 * Retry a transient runner failure (a fetch timeout, a 5xx) before giving up — a
 * long paid batch must not die on one hiccup. Shared by the paid multi-run scripts
 * (compute-protected, stability, validate-skill) so the retry policy lives in ONE
 * place. A persistent failure still throws after `attempts` tries, so a caller
 * never mistakes an exhausted retry for a clean result.
 */
import type { RunOutput, SkillRunner } from './types';

export async function runWithRetry(
  runner: SkillRunner,
  skill: string,
  feature: string,
  attempts = 4,
): Promise<RunOutput> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await runner.run(skill, feature);
    } catch (error) {
      if (index === attempts - 1) throw error;
      process.stderr.write(`    retry ${index + 1}: ${(error as Error).message}\n`);
    }
  }
  throw new Error('unreachable');
}
