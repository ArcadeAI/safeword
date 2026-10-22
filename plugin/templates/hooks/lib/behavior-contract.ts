export type BehaviorTrigger =
  'session_start' | 'prompt_submit' | 'pre_tool' | 'post_tool' | 'stop' | 'session_end';

export interface SharedBehaviorBinding {
  readonly id: string;
  readonly owner: string;
  readonly trigger: BehaviorTrigger;
  readonly guarantees: readonly ('observe' | 'reject_action' | 'bounded_continuation')[];
}

/** Shared semantics only. Native event names and delivery belong to the integration registry. */
export const SHARED_BEHAVIOR_BINDINGS: SharedBehaviorBinding[] = [
  {
    id: 'session.quality-state-cleanup',
    owner: 'hooks/session-cleanup-quality.ts',
    trigger: 'session_end',
    guarantees: ['observe'],
  },
  {
    id: 'session.auto-upgrade',
    owner: 'hooks/session-auto-upgrade.ts',
    trigger: 'session_start',
    guarantees: ['observe'],
  },
  {
    id: 'retrospective.extract',
    owner: 'hooks/stop-retro.ts',
    trigger: 'stop',
    guarantees: ['observe'],
  },
  {
    id: 'git.repair-bare-state',
    owner: 'hooks/pre-tool-git-bare-fix.sh',
    trigger: 'pre_tool',
    guarantees: ['observe'],
  },
];
