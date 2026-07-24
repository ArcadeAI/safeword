import { collectExecutableFeatureDirectories } from '../utils/feature-source.js';

/** Print executable feature directories one per line for shell consumers. */
export function featureDirectories(cwd: string): void {
  for (const directory of collectExecutableFeatureDirectories(cwd)) {
    console.log(directory);
  }
}
