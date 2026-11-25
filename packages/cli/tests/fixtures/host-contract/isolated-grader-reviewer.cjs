/* global require, __dirname -- Native Node CommonJS fixture globals. */
/* eslint-disable @typescript-eslint/no-require-imports -- Owned controlled Node CommonJS executable. */
// Controlled external process only; NOT a model, native receipt or calibration.
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'control.json'), 'utf8'));
const args = process.argv.slice(2);
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const log = value =>
  fs.appendFileSync(path.join(__dirname, 'observations.jsonl'), `${JSON.stringify(value)}\n`);
if (args.includes('--version')) {
  process.stdout.write('codex 0.160.0 CONTROL\n');
  process.exit(0);
}
if (args.includes('--help')) {
  let help = settings.help;
  if (args.includes('app-server'))
    help = settings.fault === 'unsupported' ? '' : '--stdio --config';
  process.stdout.write(`${help}\n`);
  process.exit(0);
}
log({ args, home: process.env.CODEX_HOME });
const answer = packet => {
  const counter = path.join(__dirname, 'sequence.json');
  const index = fs.existsSync(counter) ? JSON.parse(fs.readFileSync(counter, 'utf8')) : 0;
  fs.writeFileSync(counter, JSON.stringify(index + 1));
  const accepted = settings.responses === undefined ? true : settings.responses.at(index);
  if (typeof accepted !== 'boolean') throw new Error('Missing controlled response');
  return {
    schema_version: 1,
    dispatch_id: packet.dispatch_id,
    reviewer_agent: 'codex',
    verdict: accepted ? 'approve' : 'request_changes',
    summary: 'Controlled process result',
    findings: accepted ? [] : [{ severity: 'error', message: 'Controlled reference rejection' }],
  };
};
function finish(m) {
  const packet = JSON.parse(m.params.input[0].text.trim().split('\n').at(-1));
  log({ packet });
  if (settings.fault === 'missing-turn') return;
  send({ id: 3, result: { turn: { id: 'u' } } });
  if (settings.fault === 'reroute')
    send({ method: 'model/rerouted', params: { threadId: 't', turnId: 'u' } });
  switch (settings.fault) {
    case 'process': {
      process.exit(7);
      break;
    }
    case 'timeout': {
      return;
    }
    case 'invalid': {
      process.stdout.write('invalid protocol\n');
      return;
    }
    case 'missing-model': {
      // Thread acknowledgement deliberately omits identity; review remains legible.
      break;
    }
    // No default
  }
  send({
    method: 'turn/completed',
    params: {
      threadId: settings.fault === 'foreign' ? 'foreign' : 't',
      turn: {
        id: 'u',
        status: 'completed',
        items: [
          {
            type: 'agentMessage',
            phase: 'final_answer',
            text: JSON.stringify(
              settings.fault === 'bad-schema'
                ? { ...answer(packet), verdict: 'unknown' }
                : answer(packet),
            ),
          },
        ],
      },
    },
  });
}
function handle(m) {
  log(m);
  switch (m.id) {
    case 1: {
      send({ id: 1, result: {} });
      break;
    }
    case 2: {
      const started = {
        id: 2,
        result: {
          thread: { id: 't' },
          ...(settings.fault !== 'missing-model' && {
            model: settings.fault === 'mismatch' ? 'foreign-model' : m.params.model,
          }),
          modelProvider: 'openai',
        },
      };
      send(started);
      if (settings.fault === 'duplicate-start') send(started);
      break;
    }
    case 3: {
      {
        finish(m);
        // No default
      }
      break;
    }
  }
}
const state = { pending: '' };
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  state.pending += chunk;
  if (!args.includes('app-server')) return;
  let end;
  while ((end = state.pending.indexOf('\n')) !== -1) {
    const m = JSON.parse(state.pending.slice(0, end));
    state.pending = state.pending.slice(end + 1);
    handle(m);
  }
});
process.stdin.on('end', () => {
  if (args.includes('app-server')) return;
  const packet = JSON.parse(state.pending.trim().split('\n').at(-1));
  log({ packet });
  const text = JSON.stringify(answer(packet));
  send({ type: 'item.completed', item: { type: 'agent_message', text } });
});
/* eslint-enable @typescript-eslint/no-require-imports */
