import { type CliResult, createResult, type Effect, type Effects } from './result.js';

type EffectCategory = keyof Effects;
type EffectExecutor = (effect: Effect, category: EffectCategory) => Promise<void>;

const EFFECT_ORDER: readonly EffectCategory[] = [
  'files',
  'packages',
  'configuration',
  'network',
  'destructive',
];

function emptyEffects(): Record<EffectCategory, Effect[]> {
  return {
    files: [],
    packages: [],
    configuration: [],
    network: [],
    destructive: [],
  };
}

export async function applyEffects(planned: Effects, execute: EffectExecutor): Promise<CliResult> {
  const completed = emptyEffects();

  for (const category of EFFECT_ORDER) {
    const categoryEffects = planned[category];
    for (const effect of categoryEffects) {
      try {
        await execute(effect, category);
        completed[category].push(effect);
      } catch {
        return createResult({
          state: 'failed',
          changed: EFFECT_ORDER.some(key => completed[key].length > 0),
          effects: completed,
          errors: [
            {
              code: 'EFFECT_APPLY_FAILED',
              message: `Could not apply ${effect.kind} to ${effect.target}.`,
              retryable: true,
            },
          ],
          recovery: [
            {
              command: 'safeword status --verbose',
              description: 'Inspect completed effects before retrying the remaining plan.',
              requiresHuman: true,
            },
          ],
        });
      }
    }
  }

  const changed = EFFECT_ORDER.some(category => completed[category].length > 0);
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    effects: completed,
  });
}
