import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

export function reviewerScript(
  agent: 'claude' | 'codex',
  marker: string,
  packetPath: string,
  codexFails: boolean,
  codexConfirmed: boolean,
): string {
  const help =
    agent === 'codex' && codexConfirmed
      ? `process.argv.includes('app-server') ? '--stdio --config' : ${JSON.stringify(REVIEWER_CAPABILITIES.codex)}`
      : JSON.stringify(REVIEWER_CAPABILITIES[agent]);
  const review =
    agent === 'codex' && codexConfirmed
      ? String.raw`let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
    if (message.id === 2) console.log(JSON.stringify({ id: 2, result: { thread: { id: 'thread-1' }, model: message.params.model, modelProvider: 'openai' } }));
    if (message.id === 3) {
      const packet = JSON.parse(message.params.input[0].text.trim().split('\n').pop());
      console.log(JSON.stringify({ id: 3, result: { turn: { id: 'turn-1' } } }));
      console.log(JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', items: [{ type: 'agentMessage', phase: 'final_answer', text: JSON.stringify(reviewOutput(packet)) }] } } }));
    }
  }
});`
      : String.raw`let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  const output = reviewOutput(packet);
  console.log(JSON.stringify('${agent}' === 'codex' ? { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } } : { structured_output: output }));
});`;
  return `#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('${agent} 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${help}); process.exit(0); }
writeFileSync(${JSON.stringify(marker)}, 'yes');
${agent === 'codex' && codexFails ? 'process.exit(7);' : ''}
function reviewOutput(packet) {
  writeFileSync(${JSON.stringify(packetPath)}, JSON.stringify(packet));
  return { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: '${agent}', verdict: 'approve', summary: 'Review approved.', findings: [], evidence_records: { schema_version: 1, records: [] } };
}
${review}
`;
}
