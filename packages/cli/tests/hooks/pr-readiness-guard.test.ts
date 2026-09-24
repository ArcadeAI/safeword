/**
 * Unit contract for local pull-request readiness command classification.
 *
 * The hard gate runs only for commands that can leave a pull request Ready.
 * Draft creation and `ready --undo` deliberately remain available so agents
 * can collect evidence or move a pull request back to Draft.
 */

import { describe, expect, it } from 'vitest';

import { classifyPrReadinessCommand } from '../../templates/hooks/lib/pr-readiness-guard.js';

describe('classifyPrReadinessCommand', () => {
  it.each([
    ['gh pr ready', 'ready promotion'],
    ['/opt/homebrew/bin/gh pr ready 42', 'absolute GitHub CLI path'],
    ['gh -R ArcadeAI/safeword pr ready', 'repository flag before subcommands'],
    ['gh -RArcadeAI/safeword pr ready', 'attached short repository flag'],
    ['gh --repo=ArcadeAI/safeword pr ready', 'attached repository flag before subcommands'],
    ['gh pr -R ArcadeAI/safeword ready', 'repository flag between subcommands'],
    ['/usr/bin/env gh pr ready --repo ArcadeAI/safeword', 'environment prefix'],
    ['cd packages/cli && gh pr ready', 'compound command'],
    ['gh pr create --title change', 'ready-by-default creation'],
    ['gh pr new --fill', 'documented create alias'],
    ['command gh pr create --fill', 'command prefix'],
    ['gh pr create --title "--draft" --fill', 'Draft-looking option value'],
    ['gh pr create --draft --fill && gh pr ready', 'Ready wins across chained segments'],
  ])('classifies %s as Ready-making (%s)', (command, _shape) => {
    expect(classifyPrReadinessCommand(command)).toBe('ready');
  });

  it.each([
    ['gh pr create --draft', 'Draft flag'],
    ['gh pr new --draft', 'Draft flag on documented create alias'],
    ['gh pr -R ArcadeAI/safeword create --draft', 'Draft creation with repository flag'],
    ['gh pr create -d --fill', 'short Draft flag'],
    ['gh pr ready --undo', 'return to Draft'],
  ])('classifies %s as Draft-safe (%s)', (command, _shape) => {
    expect(classifyPrReadinessCommand(command)).toBe('draft');
  });

  it.each([
    ['gh pr view', 'read-only GitHub CLI command'],
    ['gh issue create', 'different GitHub resource'],
    ["printf '%s' 'gh pr ready'", 'quoted mention'],
    ['echo ready && git status', 'unrelated compound command'],
  ])('classifies %s as unrelated (%s)', (command, _shape) => {
    expect(classifyPrReadinessCommand(command)).toBe('other');
  });
});
