import { expect, it } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json';
import { nativeArchitectureCap, nativeHookRecords } from '../helpers/cursor-native-observations.js';
import { prepareCursorRetainedFixture } from './cursor-retained-fixture.js';

it.each(['portable', 'project-hooks'] as const)(
  'prepares the installed Cursor actor and observes its same-chat followup through %s',
  async delivery => {
    const fixture = await prepareCursorRetainedFixture(delivery);
    try {
      const { stops, cap, installation } = fixture.prior;
      expect(installation).toBe(fixture.actor.observedInstallation());
      expect(stops).toHaveLength(1);
      expect(stops[0]?.followup).toContain('cited evidence');
      expect(cap?.response.input.conversation_id).toBe(stops[0]?.input.conversation_id);
      expect(cap?.skip).toMatchObject({ loop: 1, limit: 1 });
      if (!cap) throw new Error('captured cap missing');
      const stop = nativeHookRecords(fixture.prior.raw).find(
        row => row.input.hook_event_name === 'stop',
      );
      if (!stop) throw new Error('captured Stop missing');
      const args = stop.words.slice(1);
      const context = {
        workspace: fixture.actor.workspace,
        version: hostReleases.cursorIde.version,
        conversation: stops[0]?.input.conversation_id ?? '',
      };
      const decode = (raw: string, command = args) =>
        nativeArchitectureCap(
          [{ path: cap.window, text: raw }],
          command,
          cap.response.words.slice(1),
          context,
          cap.binding,
        );
      expect(decode(fixture.prior.raw).skip).toMatchObject({ loop: 1, limit: 1 });
      const foreignResponse = cap.response.raw.replace(
        context.conversation,
        'foreign-conversation',
      );
      expect(() =>
        decode(fixture.prior.raw.replace(cap.response.raw, () => foreignResponse)),
      ).toThrow('foreign or incomplete automatic response');
      expect(() => decode(fixture.prior.raw.replace(cap.skip.raw, 'missing skip'))).toThrow(
        'exact managed cap missing',
      );
      const noFollowup = stop.raw.replace(/OUTPUT:\n[\s\S]*?\n═/u, 'OUTPUT:\n{}\n═');
      expect(() => decode(fixture.prior.raw.replace(stop.raw, () => noFollowup))).toThrow(
        'initial correction missing',
      );
      expect(() => decode(fixture.prior.raw, ['/foreign/dispatch.js', 'stop:0'])).toThrow(
        'ambiguous architecture window',
      );
    } finally {
      fixture.close();
    }
  },
  180_000,
);
