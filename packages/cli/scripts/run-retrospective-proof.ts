import { readFileSync } from 'node:fs';

import {
  type RetrospectiveProofRequest,
  runRetrospectiveProof,
} from '../src/review/retrospective-proof.js';

const [projectRoot, requestPath] = process.argv.slice(2);
if (projectRoot === undefined || requestPath === undefined) {
  throw new Error('Usage: bun run-retrospective-proof.ts <project-root> <request.json>');
}
const request = JSON.parse(readFileSync(requestPath, 'utf8')) as RetrospectiveProofRequest;
const observation = runRetrospectiveProof(projectRoot, request);
process.stdout.write(`${JSON.stringify(observation, undefined, 2)}\n`);
