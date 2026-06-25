/**
 * Live interactive prompt (2TK5AD) — the untested-by-unit boundary. A yes/no
 * confirm over stdin; injected everywhere else so tests never touch real input.
 */

import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import type { Prompt } from './types.js';

export function createPrompt(): Prompt {
  return {
    async confirm(question: string, defaultValue: boolean): Promise<boolean> {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const raw = await rl.question(`${question} ${defaultValue ? '[Y/n]' : '[y/N]'} `);
        const answer = raw.trim().toLowerCase();
        if (answer === '') return defaultValue;
        return answer === 'y' || answer === 'yes';
      } finally {
        rl.close();
      }
    },
  };
}
