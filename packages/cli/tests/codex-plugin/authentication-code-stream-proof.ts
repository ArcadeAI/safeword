import { parseReviewerLoginOutput } from '../../src/codex-plugin/reviewer-login.js';

// A stream chunk can end at a valid-looking prefix of a longer device code.
const parse = parseReviewerLoginOutput as (
  reviewer: 'codex',
  output: string,
  complete: boolean,
) => ReturnType<typeof parseReviewerLoginOutput>;
const prefix = 'Open https://auth.openai.com/codex/device\nEnter ABCDE-FGHI';
if (parse('codex', prefix, false) !== undefined)
  throw new Error('streamed device code must wait for its final delimiter');
if (parse('codex', `${prefix}J`, false) !== undefined)
  throw new Error('streamed device code must wait even at five trailing characters');
if (parse('codex', `${prefix}J\n`, false)?.device_code !== 'ABCDE-FGHIJ')
  throw new Error('complete streamed device code must preserve every character');
if (parseReviewerLoginOutput('codex', prefix)?.device_code !== 'ABCDE-FGHI')
  throw new Error('complete-string parser must preserve its existing contract');
console.log('PASS: device code waits for a delimiter without changing complete-string parsing');
