import { spawn } from 'node:child_process';

import type { ReviewAgent, ReviewerOutput, ReviewPacket } from './contract.js';

const ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    '-p',
    '--output-format',
    'json',
    '--permission-mode',
    'bypassPermissions',
    '--no-session-persistence',
  ],
  codex: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '-'],
};

const ASSIGNED_MODELS: Readonly<Record<ReviewAgent, string>> = {
  claude: 'claude-default',
  codex: 'codex-default',
};

export function assignedReviewerModel(reviewer: ReviewAgent): string {
  return ASSIGNED_MODELS[reviewer];
}

export async function runHeadlessReviewer(
  reviewer: ReviewAgent,
  packet: ReviewPacket,
): Promise<ReviewerOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(reviewer, ARGUMENTS[reviewer], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`${reviewer} review failed (${code ?? 'signal'}): ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as ReviewerOutput);
      } catch {
        reject(new Error(`${reviewer} returned invalid review output`));
      }
    });
    child.stdin.end(JSON.stringify(packet));
  });
}
