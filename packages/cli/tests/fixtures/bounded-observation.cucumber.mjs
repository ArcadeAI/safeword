import nodePath from 'node:path';
import process from 'node:process';

const root = nodePath.resolve(import.meta.dirname, '../../../..');
const selectedFeature = process.argv.some(
  argument =>
    nodePath.basename(argument.split(':', 1)[0] ?? '') === 'observe-bounded-delivery-proof.feature',
);

// RED-only selection of this accepted WIP feature; ordinary repository tags stay unchanged.
export default {
  ...(!selectedFeature && {
    paths: [nodePath.join(root, 'features/observe-bounded-delivery-proof.feature')],
  }),
  import: [
    'tsx/esm',
    nodePath.join(root, 'packages/cli/features/steps/bounded-observation.steps.ts'),
  ],
  tags: 'not @manual and not @live',
  parallel: 1,
};
