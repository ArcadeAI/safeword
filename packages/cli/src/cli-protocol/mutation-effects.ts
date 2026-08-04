import type { CliResult } from './result.js';

export interface JournalMutation {
  readonly surface: 'file' | 'configuration' | 'network';
  readonly kind: string;
  readonly target: string;
  readonly operation: string;
}

export function effectsFromMutationJournal(
  mutations: readonly JournalMutation[],
): Partial<CliResult['effects']> {
  const toEffect = ({ kind, target, operation }: JournalMutation) => ({
    kind,
    target,
    operation,
  });
  return {
    files: mutations
      .filter(mutation => mutation.surface === 'file')
      .map(mutation => toEffect(mutation)),
    configuration: mutations
      .filter(mutation => mutation.surface === 'configuration')
      .map(mutation => toEffect(mutation)),
    network: mutations
      .filter(mutation => mutation.surface === 'network')
      .map(mutation => toEffect(mutation)),
  };
}
