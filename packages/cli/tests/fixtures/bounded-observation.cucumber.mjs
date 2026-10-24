import nodePath from 'node:path';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

// RED-only selection of this accepted WIP feature; ordinary repository tags stay unchanged.
export default {
  paths: [nodePath.join(root, 'features/observe-bounded-delivery-proof.feature')],
  import: [
    'tsx/esm',
    nodePath.join(root, 'packages/cli/features/steps/bounded-observation.steps.ts'),
  ],
  tags: 'not @manual and not @live',
  parallel: 1,
};
