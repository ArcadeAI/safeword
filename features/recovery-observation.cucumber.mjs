// Opt-in proof of the observer itself. The observed 142-case lane uses cucumber.mjs.
export default {
  paths: ['features/observe-bounded-completion-recovery.feature'],
  import: ['steps/world.ts', 'steps/observe-bounded-completion-recovery.steps.ts'],
  tags: '@live',
};
