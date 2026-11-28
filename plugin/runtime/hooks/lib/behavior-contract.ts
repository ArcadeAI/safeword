export type BehaviorTrigger =
  'session_start' | 'prompt_submit' | 'pre_tool' | 'post_tool' | 'stop' | 'session_end';

export interface SharedBehaviorBinding {
  readonly id: string;
  /** Migrated bindings require validated host registration adoption, not path membership. */
  readonly requireExplicitRoutes?: boolean;
  readonly owner: string;
  /** Shared library export; host wrappers remain mechanical callers. */
  readonly entrypoint?: string;
  readonly permittedAlternatives?: SharedBehaviorBinding['guarantees'];
  readonly trigger: BehaviorTrigger;
  readonly guarantees: readonly ('observe' | 'reject_action' | 'bounded_continuation')[];
}

/** Shared semantics only. Native event names and delivery belong to the integration registry. */
export const SHARED_BEHAVIOR_BINDINGS: SharedBehaviorBinding[] = [
  {
    id: 'session.quality-state-cleanup',
    requireExplicitRoutes: true,
    owner: 'hooks/session-cleanup-quality.ts',
    trigger: 'session_end',
    guarantees: ['observe'],
  },
  {
    id: 'session.auto-upgrade',
    requireExplicitRoutes: true,
    owner: 'hooks/lib/auto-upgrade.ts',
    entrypoint: 'runAutoUpgrade',
    trigger: 'session_start',
    guarantees: ['observe'],
  },
  {
    id: 'retrospective.extract',
    requireExplicitRoutes: true,
    owner: 'hooks/stop-retro.ts',
    trigger: 'stop',
    guarantees: ['observe'],
  },
  {
    id: 'git.repair-bare-state',
    requireExplicitRoutes: true,
    owner: 'hooks/pre-tool-git-bare-fix.sh',
    trigger: 'pre_tool',
    guarantees: ['observe'],
  },
  {
    id: 'quality.pre-tool',
    requireExplicitRoutes: true,
    owner: 'hooks/pre-tool-quality.ts',
    trigger: 'pre_tool',
    guarantees: ['reject_action'],
  },
  ...(
    [
      ['prompt.timestamp', 'hooks/prompt-timestamp.ts', 'prompt_submit', 'observe'],
      ['prompt.work-reminders', 'hooks/prompt-questions.ts', 'prompt_submit', 'observe'],
      ['retrospective.filing-nudge', 'hooks/prompt-retro-nudge.ts', 'prompt_submit', 'observe'],
      // Done/artifact gates can reject Stop without a blanket continuation cap.
      ['quality.stop', 'hooks/stop-quality.ts', 'stop', 'reject_action'],
      ['session.reentry-capture', 'hooks/stop-reentry.ts', 'stop', 'observe'],
      ['diagnostics.self-report', 'hooks/stop-self-report.ts', 'stop', 'observe'],
      ['retrospective.filing', 'hooks/stop-retro-filing.ts', 'stop', 'bounded_continuation'],
    ] as const
  ).map(([id, owner, trigger, guarantee]) => ({
    id,
    owner,
    trigger,
    requireExplicitRoutes: true,
    guarantees: [guarantee],
  })),
  ...(
    [
      ['session.runtime-readiness', 'hooks/session-bun-check.sh'],
      ['session.dependencies', 'hooks/session-dependency-readiness.ts'],
      ['session.standing-context', 'hooks/session-safeword-context.ts'],
      ['session.reply-format', 'hooks/session-reply-format.ts'],
      ['session.version-advice', 'hooks/session-version.ts'],
      ['session.lint-advice', 'hooks/session-lint-check.ts'],
      ['session.architecture-heal', 'hooks/session-architecture-heal.ts'],
      ['session.reentry-context', 'hooks/session-start-reentry.ts'],
      ['session.compact-context', 'hooks/session-compact-context.ts'],
    ] as const
  ).map(([id, owner]) => ({
    id,
    owner,
    requireExplicitRoutes: true,
    trigger: 'session_start' as const,
    guarantees: ['observe'] as const,
  })),
  ...(
    [
      ['dependencies.pre-tool', 'hooks/pre-tool-dependency-readiness.ts', 'reject_action'],
      // Approval requests are not unconditional denial or bounded continuation.
      ['config.approval-request', 'hooks/pre-tool-config-guard.ts', 'observe'],
      ['architecture.stage', 'hooks/pre-tool-architecture-stage.ts', 'observe'],
      ['git.stale-branch-warning', 'hooks/pre-tool-stale-main.ts', 'observe'],
    ] as const
  ).map(([id, owner, guarantee]) => ({
    id,
    owner,
    requireExplicitRoutes: true,
    trigger: 'pre_tool' as const,
    guarantees: [guarantee],
  })),
  ...(
    [
      ['feedback.quality', 'hooks/post-tool-quality.ts'],
      ['feedback.language-skill', 'hooks/post-tool-skill-nudge.ts'],
      ['feedback.bypass-warning', 'hooks/post-tool-bypass-warn.ts'],
      ['learning.index-sync', 'hooks/post-tool-sync-learnings.ts'],
      ['ticket.phase-work-log', 'hooks/post-tool-work-log.ts'],
      ['dependencies.install-stamp', 'hooks/post-tool-dependency-readiness.ts'],
    ] as const
  ).map(([id, owner]) => ({
    id,
    owner,
    requireExplicitRoutes: true,
    trigger: 'post_tool' as const,
    guarantees: ['observe'] as const,
  })),
  {
    id: 'feedback.lint',
    requireExplicitRoutes: true,
    owner: 'hooks/lib/lint.ts',
    entrypoint: 'lintFile',
    trigger: 'post_tool',
    guarantees: ['observe'],
  },
  ...(
    [
      ['completion.session-evidence', 'done-gate', 'evaluateSessionDoneEvidence', 'reject_action'],
      [
        'presentation.terminal-handoff',
        'quality',
        'evaluateDecisionBriefCompliance',
        'reject_action',
      ],
      ['review.stop-option', 'review-ledger', 'isStopQualityReviewEnabled', 'observe'],
      [
        'architecture.done-advice',
        'architecture-document-nudge',
        'architectureDocumentNudgeForProject',
        'observe',
      ],
      [
        'retrospective.filing-decision',
        'retro-filing-gate',
        'decideRetroFilingGate',
        'bounded_continuation',
      ],
      ['retrospective.availability', 'retro-trigger', 'decideRetroAvailableNudge', 'observe'],
    ] as const
  ).map(([id, file, entrypoint, guarantee]) => ({
    id,
    owner: `hooks/lib/${file}.ts`,
    entrypoint,
    requireExplicitRoutes: true,
    trigger: 'stop' as const,
    guarantees: [guarantee],
    ...(guarantee === 'reject_action' && {
      permittedAlternatives: ['bounded_continuation'] as const,
    }),
  })),
  {
    id: 'session.standing-context.read',
    owner: 'hooks/lib/safeword-context.ts',
    entrypoint: 'readSafewordContext',
    requireExplicitRoutes: true,
    trigger: 'session_start',
    guarantees: ['observe'],
  },
];
