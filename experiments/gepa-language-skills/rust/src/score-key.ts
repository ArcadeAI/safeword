import type { RustModelFamily } from './evaluator';

export function rustScoreGroupKey(repositoryId: string, modelFamily: RustModelFamily): string {
  return `${repositoryId}\0${modelFamily}`;
}
