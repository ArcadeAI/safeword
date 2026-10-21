import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const execFileAsync = promisify(execFile);
export type RankedCase = 'first' | 'alternate' | 'later' | 'unsupported';

function writeRankedReviewerExecutables(bin: string, example: RankedCase): string {
  const log = nodePath.join(bin, 'launches.jsonl');
  writeFileSync(log, '');
  for (const agent of ['codex', 'claude'] as const) {
    const help =
      example === 'unsupported' && agent === 'codex'
        ? REVIEWER_CAPABILITIES.codex.replace('--model', '')
        : REVIEWER_CAPABILITIES[agent];
    writeFileSync(
      nodePath.join(bin, agent),
      String.raw`#!${process.execPath}
const { appendFileSync } = require('node:fs');
const agent = ${JSON.stringify(agent)};
if (process.argv.includes('--version')) { console.log(agent + ' 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(process.argv.includes('app-server') ? ${example === 'unsupported' ? "''" : "'--stdio --config'"} : ${JSON.stringify(help)}); process.exit(0); }
function log(model, packet) { appendFileSync(${JSON.stringify(log)}, JSON.stringify({agent, model, packet}) + '\n'); }
function output(packet) { return {schema_version:1, dispatch_id:packet.dispatch_id, reviewer_agent:agent, verdict:'approve', summary:'Qualified route completed.', findings:[]}; }
if (agent === 'codex' && !process.argv.includes('app-server')) { log('default'); process.exit(7); }
let buffer = '', model = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
 buffer += chunk;
 if (agent === 'claude') return;
 let end;
 while ((end = buffer.indexOf('\n')) !== -1) {
  const m = JSON.parse(buffer.slice(0,end)); buffer = buffer.slice(end+1);
  if (m.id) console.log(JSON.stringify({id:m.id,method:'item/commandExecution/requestApproval',params:{threadId:'t',turnId:'u'}}));
  if (m.id === 1) console.log(JSON.stringify({id:1,result:{}}));
  if (m.id === 2) { model=m.params.model; console.log(JSON.stringify({id:2,result:{thread:{id:'t'},model,modelProvider:'openai'}})); }
  if (m.id === 3) {
   const packet=JSON.parse(m.params.input[0].text.trim().split('\n').pop()); log(model ?? 'default',packet);
   console.log(JSON.stringify({id:3,result:{turn:{id:'u'}}}));
   console.log(JSON.stringify({method:'turn/completed',params:{threadId:'t',turn:{id:'u',status:model === 'gpt-6-astra' ? 'completed' : 'failed',items:[{type:'agentMessage',phase:'final_answer',text:JSON.stringify(output(packet))}]}}}));
  }
 }
});
process.stdin.on('end', () => { if (agent === 'claude') { const packet=JSON.parse(buffer.trim().split('\n').pop()); log('default',packet); console.log(JSON.stringify({structured_output:output(packet)})); } });
`,
      { mode: 0o755 },
    );
  }
  return log;
}

function writeRankedPlanningProject(project: string, example: RankedCase): string {
  const codex = (model?: string) => ({ reviewer: 'codex', ...(model && { model }) });
  const same = { reviewer: 'claude' };
  const routes = {
    first: [same, codex('gpt-6-astra')],
    alternate: [codex(), same, codex('gpt-6-astra')],
    later: [codex(), same, codex('gpt-6-sol'), codex('gpt-6-astra')],
    unsupported: [codex(), codex('gpt-6-astra'), same],
  }[example];
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(project, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReview: 'prefer',
      crossAgentReviewRoutes: { claude: routes },
    }),
  );
  writePlanningInventories(project);
  const ticket = '.project/tickets/RNK123-ranked';
  mkdirSync(nodePath.join(project, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(project, ticket, 'ticket.md'),
    '---\nid: RNK123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: truthful review\nout_of_scope: bypass\ndone_when: qualified reviewer wins\n---\n',
  );
  writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(project, ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nKeep the existing approval authority.\n\n## Decisions\n\nTry every eligible independent route before same-agent review.\n\n## Design alignment\n\nPreserve truthful approval.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/ranked.feature'),
    '@ranked.BU1.R1\nFeature: Ranked review\n  Scenario: Independent review precedes fallback\n    Given eligible routes\n    When review runs\n    Then the qualified route wins\n',
  );
  return ticket;
}

/** Real CLI/config/catalogue/job wiring; only the external reviewer processes are fake. */
export async function rankedPlanningReview(project: string, bin: string, example: RankedCase) {
  const ticket = writeRankedPlanningProject(project, example);
  const log = writeRankedReviewerExecutables(bin, example);
  const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
  let result;
  try {
    result = await execFileAsync(
      process.execPath,
      [
        cli,
        'review',
        'run',
        'plan-implementation',
        `${ticket}/impl-plan.md`,
        '--context',
        `${ticket}/spec.md`,
        '--cwd',
        project,
        '--json',
        '--no-input',
      ],
      {
        cwd: project,
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_AUTHOR_MODEL: 'claude-opus-5',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(bin, 'keys'),
          SAFEWORD_REVIEW_FOREGROUND_MS: '25000',
          SAFEWORD_REVIEW_TIMEOUT_MS: '3000',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '20000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message: string };
    throw new Error(`${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`, {
      cause: error,
    });
  }
  return {
    output: JSON.parse(result.stdout),
    launches: readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line)),
  };
}
