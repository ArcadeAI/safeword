import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getStateFilePath } from '../../templates/hooks/lib/quality-state.js';
import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { eventually } from './cursor-native-window.js';
import { CursorNativePluginActor } from './cursor-native-write.js';

interface NativeStop {
  conversation_id?: string;
  hook_event_name?: string;
  cursor_version?: string;
  status?: string;
  loop_count?: number;
}

function successfulCandidate(header: string | undefined, candidate: string): boolean {
  return header?.includes(candidate) === true && header.endsWith('exit code: 0');
}

/** Read actual host hook logs; this observer never supplies a continuation. */
export function nativeStopDecisions(log: string, candidate: string, conversation: string) {
  const stops: { input: NativeStop; followup?: string }[] = [];
  for (const block of log.matchAll(
    /Command: ([^\n]+)\n\nINPUT:\n([\s\S]*?)\n\nOUTPUT:\n([\s\S]*?)\n═+\r?\n/gu,
  )) {
    if (!successfulCandidate(block[1], candidate)) continue;
    const input = JSON.parse(block[2] ?? '{}') as NativeStop;
    if (input.hook_event_name !== 'stop' || input.conversation_id !== conversation) continue;
    const output = block[3]?.trim();
    if (!output || output === '(empty)') continue;
    const result = JSON.parse(output) as { followup_message?: string };
    stops.push({ input, followup: result.followup_message });
  }
  return stops;
}

/** Real completion in one owned IDE conversation, after Given-only session setup. */
export class CursorNativeContinuationActor extends CursorNativePluginActor {
  private conversation = '';
  private start = 0;
  private readonly marker = `FINISH_${randomUUID()}`;
  private response = '';

  async prepareContinuation(host: string, version: string): Promise<void> {
    await this.prepare(host, version, 'IDE');
    const path = nodePath.join(this.workspace, '.cursor/hooks.json');
    const hooks = JSON.parse(readFileSync(path, 'utf8')) as {
      hooks: Record<string, { command: string }[]>;
    };
    hooks.hooks.afterAgentResponse = hooks.hooks.stop ?? [];
    const loaded = this.hookConfigurationLoads();
    writeFileSync(path, JSON.stringify(hooks));
    await eventually(
      'response observer configuration loaded',
      () => this.hookConfigurationLoads() > loaded,
    );
    await this.freshAgent();
    const prompt = this.payload('session-setup.txt', 'Reply only READY. Use no tools.');
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('Given-only session completion', async () => {
      await this.snapshot();
      const stop = this.observations().find(
        row => row.event === 'stop' && row.status === 'completed' && row.conversation,
      );
      this.conversation = stop?.conversation ?? '';
      return this.conversation.length > 0;
    });
    await eventually('actual generated Stop hook dispatch', () =>
      nativeStopDecisions(this.hookLog(), this.candidate, this.conversation).some(
        row => row.input.cursor_version === version && row.input.status === 'completed',
      ),
    );
    const initial = nativeStopDecisions(this.hookLog(), this.candidate, this.conversation);
    assert.equal(initial.length, 1, 'CURSOR_SETUP_UNAVAILABLE: expected one setup completion');
    assert.equal(
      initial[0]?.input.loop_count,
      0,
      'CURSOR_SETUP_UNAVAILABLE: continuation already consumed',
    );
    assert.equal(
      initial[0]?.followup,
      undefined,
      'CURSOR_SETUP_UNAVAILABLE: setup unexpectedly continued',
    );
  }

  setMissingVerification(): void {
    const ticket = nodePath.join(this.workspace, '.project/tickets/UNFNSH-unfinished');
    mkdirSync(ticket, { recursive: true });
    writeFileSync(
      nodePath.join(ticket, 'ticket.md'),
      '---\nid: UNFNSH\ntype: task\nphase: done\nstatus: in_progress\n---\n\n# Verify the synthetic work\n',
    );
    const identity = resolveRunIdentity(
      { conversation_id: this.conversation },
      { runtime: 'cursor' },
    );
    // Given-only session state: bind the unfinished ticket to the observed host
    // conversation. No state or decision is injected after the When begins.
    writeFileSync(
      getStateFilePath(this.workspace, identity),
      JSON.stringify({
        activeTicket: 'UNFNSH',
        locSinceCommit: 0,
        lastCommitHash: '',
        // QualityState stores an explicitly empty gate as JSON null.
        // eslint-disable-next-line unicorn/no-null -- preserve the actual QualityState storage contract
        gate: null,
        recentFailures: [],
        incrementedPatterns: [],
      }),
    );
    assert.equal(existsSync(nodePath.join(ticket, 'verify.md')), false);
    this.start = this.observations().length;
  }

  async attemptCompletion(): Promise<void> {
    const prompt = this.payload(
      'finish-prompt.txt',
      `The isolated setup is complete. Reply only ${this.marker} and end this turn. ` +
        'Use no tools and change no files. If the host automatically supplies a further instruction, report the unmet requirement honestly without changing files.',
    );
    await this.action('fill', prompt);
    await this.action('submit', prompt);
    await eventually('real IDE completion attempt', async () => {
      this.response = await this.snapshot();
      return this.observations()
        .slice(this.start)
        .some(
          row =>
            row.event === 'stop' &&
            row.conversation === this.conversation &&
            row.status === 'completed',
        );
    });
    await eventually(
      'generated completion decision observed',
      () => nativeStopDecisions(this.hookLog(), this.candidate, this.conversation).length >= 2,
    );
    const decision = nativeStopDecisions(this.hookLog(), this.candidate, this.conversation)[1];
    if (decision?.followup) {
      await eventually('automatic subsequent IDE turn', async () => {
        this.response = await this.snapshot();
        return this.observations()
          .slice(this.start)
          .some(
            row =>
              row.event === 'stop' &&
              row.conversation === this.conversation &&
              row.loop === 1 &&
              row.status === 'completed',
          );
      });
    }
    writeFileSync(nodePath.join(this.runDirectory, 'continuation-ui.txt'), this.response);
    writeFileSync(nodePath.join(this.runDirectory, 'native-hooks.log'), this.hookLog());
    console.log(`Cursor IDE continuation evidence: ${this.runDirectory}`);
  }

  assertContinuation(): void {
    const decisions = nativeStopDecisions(this.hookLog(), this.candidate, this.conversation);
    const rows = this.observations()
      .slice(this.start)
      .filter(row => row.conversation === this.conversation && row.version === this.version);
    assert.ok(
      decisions[1]?.followup?.includes('verify.md') &&
        rows.some(row => row.event === 'stop' && row.loop === 1) &&
        rows.some(row => row.event === 'afterAgentResponse' && row.text?.includes('verify.md')) &&
        this.response.includes('verify.md'),
      'HOST_CONTINUATION_MISSING: the native IDE must continue the same conversation with the unmet verification requirement',
    );
  }
}
