#!/usr/bin/env bun

import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import nodePath from 'node:path';

import { checkPrincipleTrace } from './lib/principle-trace.ts';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';

const projectDirectory = process.argv[2] ?? process.cwd();
const explicitPlan = process.argv[3];
const plans =
  explicitPlan === undefined ? activeImplPlans(projectDirectory) : [nodePath.resolve(explicitPlan)];

for (const planPath of plans) {
  const plan = readFileSync(planPath, 'utf8');
  for (const finding of checkPrincipleTrace(projectDirectory, plan)) {
    process.stdout.write(`${finding} (${nodePath.relative(projectDirectory, planPath)})\n`);
  }
}

function activeImplPlans(directory: string): string[] {
  const ticketsDirectory = nodePath.join(resolveNamespaceRoot(directory), 'tickets');
  try {
    return readdirSync(ticketsDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => nodePath.join(ticketsDirectory, entry.name))
      .filter(ticketDirectory => {
        try {
          return /^status:\s*in_progress\s*$/mu.test(
            readFileSync(nodePath.join(ticketDirectory, 'ticket.md'), 'utf8'),
          );
        } catch {
          return false;
        }
      })
      .map(ticketDirectory => nodePath.join(ticketDirectory, 'impl-plan.md'))
      .filter(planPath => {
        try {
          readFileSync(planPath, 'utf8');
          return true;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}
