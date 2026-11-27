// Only the model response is scripted. The trace CLI reads and writes real files.
import { mock } from 'bun:test';
import { resolve } from 'node:path';

const clientModule = resolve('packages/extractor/src/extract.ts');
const original = await import(clientModule);
const { mode, intentId, scenarioKey } = JSON.parse(process.env.HARBOR_MATCHER);

mock.module(clientModule, () => ({
  ...original,
  resolveClient: () => ({
    messages: {
      async parse(request) {
        if (
          mode === 'partial-match' &&
          JSON.stringify(request.messages).includes('Second fixture area')
        ) {
          throw new Error('fixture matcher unavailable');
        }
        const picks = ['match', 'partial-match'].includes(mode)
          ? [{ intent_id: intentId, scenario_keys: [scenarioKey] }]
          : [];
        return { parsed_output: { picks }, stop_reason: 'end_turn', content: [] };
      },
    },
  }),
}));
