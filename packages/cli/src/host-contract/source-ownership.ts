import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import ts from 'typescript';

import type { SharedBehaviorBinding } from '../../templates/hooks/lib/behavior-contract.js';
import type { Finding } from '../cli-protocol/result.js';
import { CODEX_MIGRATION_SCHEMA } from '../codex-plugin/inventory.js';
import type { HostHandlerRegistration } from '../lifecycle/integrations.js';
import type {
  CallbackBoundaryRoute,
  CallbackResourceRoute,
  CallbackSelection,
  CallbackSourceRoute,
  HandlerComposition,
  HandlerEnvelope,
  OuterCallDisposition,
} from './handlers.js';

const CODEX_ADAPTER = 'packages/cli/src/commands/codex-hook.ts';
const OPENCODE_CATALOGUE = 'packages/cli/src/opencode/catalogue.ts';
const SHARED_GATE = 'packages/cli/templates/hooks/pre-tool-quality.ts';
const SHARED_INTAKE_FIELDS = 'packages/cli/templates/hooks/lib/hierarchy.ts';
const CURSOR_WRAPPERS = 'packages/cli/src/cursor-wrappers.ts';

/** Bounded option provenance, not general control-flow or runtime delivery proof. */
export function policyOptionFindings(root: string, sources: readonly string[]): Finding[] {
  const options = new Set([
    'terminalHandoffCorrection',
    'architectureReviewGate',
    'crossModelReview',
    'designApprovalGate',
  ]);
  const adapters = new Set([
    CODEX_ADAPTER,
    ...sources.filter(path => /^packages\/cli\/templates\/hooks\/(?:cursor|codex)\//u.test(path)),
  ]);
  const findings: Finding[] = [];
  const fail = (path: string, option: string, cause: string) => {
    findings.push({
      code: 'HOST_CONTRACT_OPTION_BYPASS',
      severity: 'error',
      message: `${path}: ${option} bypasses the shared option boundary (${cause}).`,
      metadata: { path, option, cause },
    });
  };
  for (const path of adapters) {
    const file = source(root, path);
    function visit(node: ts.Node): void {
      if (
        ts.isPropertyAccessExpression(node) &&
        options.has(node.name.text) &&
        ts.isBinaryExpression(node.parent)
      )
        fail(path, node.name.text, 'adapter-local-option-predicate');
      ts.forEachChild(node, visit);
    }
    visit(file);
    if (path === CODEX_ADAPTER && !codexProjectOptionsForwarded(file))
      fail(path, 'projectDirectory', 'project-options-not-forwarded');
  }
  return findings;
}
function codexProjectOptionsForwarded(file: ts.SourceFile): boolean {
  const runner = file.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'runHookFile',
  );
  let forwarded = false;
  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(file) === 'CLAUDE_PROJECT_DIR' &&
      node.initializer.getText(file) === 'projectDirectory'
    )
      forwarded = true;
    ts.forEachChild(node, visit);
  }
  if (runner) visit(runner);
  return forwarded;
}

/** Current Claude dispatcher provenance, not control flow or host delivery proof. */
export function hasClaudeEnvelopeProvenance(root: string, envelope: HandlerEnvelope): boolean {
  const owner = 'packages/cli/src/claude-plugin/runtime/dispatch.ts';
  const scopes =
    envelope.event === 'UserPromptSubmit'
      ? ['viableLegacyAuthority', 'automaticMigrationUnsafe']
      : ['viableLegacyAuthority'];
  const childFamily = envelope.event === 'Setup' ? undefined : 'claude-native-event-groups';
  if (
    envelope.owner !== owner ||
    !['SessionStart', 'UserPromptSubmit', 'Setup'].includes(envelope.event) ||
    envelope.childFamily !== childFamily ||
    JSON.stringify(envelope.localPolicyScopes) !== JSON.stringify(scopes)
  )
    return false;
  const file = source(root, owner);
  const requirements: Readonly<Record<string, readonly (readonly string[])[]>> = {
    mainUnsafe: [['verifyPlugin', 'event', 'pluginRoot'], ['executeVerifiedPlugin']],
    executeVerifiedPlugin: [['executeConfiguredHooks', 'input'], ['completeSuccessfulExecution']],
    executeConfiguredHooks: [
      ['viableLegacyAuthority', 'input.event', 'input.projectRoot'],
      [
        'runEventGroup',
        'input.event',
        'input.eventGroupsContent',
        'input.hookInput',
        'input.standardInput',
      ],
      [
        'runFunctionalCommand',
        'input.command',
        'input.standardInput',
        "input.event === 'UserPromptSubmit'",
        'commandCwd',
      ],
    ],
    runEventGroup: [['runEventHooks']],
    runEventHooks: [['runFunctionalCommand']],
    completeSuccessfulExecution: [['postExecutionLifecycle']],
    postExecutionLifecycle: [['automaticMigration']],
    automaticMigration: [['automaticMigrationUnsafe']],
    automaticMigrationUnsafe: [['automaticMigrationProjectRoot', 'event', 'hookCwd']],
  };
  const valid = Object.entries(requirements).every(([name, required]) => {
    const scope = file.statements.find(
      node => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    const calls = scope
      ? [...callSignatures(scope, file)].map(value => JSON.parse(value) as string[])
      : [];
    return required.every(signature =>
      calls.some(call =>
        signature.length === 1
          ? call[0] === signature[0]
          : JSON.stringify(call) === JSON.stringify(signature),
      ),
    );
  });
  return (
    valid &&
    envelope.localPolicyScopes.every(name =>
      file.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === name),
    ) &&
    hasOwnerCall(
      root,
      owner,
      'packages/cli/src/claude-plugin/cleanup.ts',
      'migrateClaudeLegacyAutomatically',
    ) &&
    hasOwnerCall(
      root,
      owner,
      'packages/cli/src/claude-plugin/project-root.ts',
      'canonicalClaudeProjectRoot',
    )
  );
}

/** Exact registration/resource provenance only; no control-flow, guarantee or native proof. */
export function callbackSourceCoverage(
  root: string,
  handlers: readonly HostHandlerRegistration[],
  routes: readonly (CallbackSourceRoute & { host: string })[],
  occupied: ReadonlySet<number>,
) {
  const findings: Finding[] = [],
    rows: (CallbackSourceRoute & { registration_index: number })[] = [];
  const used = new Set(occupied),
    ids = new Set<string>();
  for (const route of routes) {
    const fail = (code: string) => {
      findings.push({
        code,
        severity: 'error',
        message: route.id,
        metadata: { id: route.id, host: route.host },
      });
    };
    const matches = handlers.flatMap((handler, index) => {
      const config = handler.configuration as {
        callback_scope?: string;
        callback_ordinal?: number;
        callback_target?: string;
        callback_callees?: string[];
      };
      return handler.host === route.host &&
        handler.event === route.event &&
        handler.source_family === route.sourceFamily &&
        handler.handler_path === route.callbackSource &&
        handler.execution === 'native-callback' &&
        config.callback_scope === route.scope &&
        config.callback_ordinal === route.ordinal &&
        matchesCallbackBody(route, config)
        ? [index]
        : [];
    });
    const index = matches[0];
    if (ids.has(route.id) || matches.length !== 1 || index === undefined || used.has(index)) {
      fail('HOST_CONTRACT_RESOURCE_SELECTION_INVALID');
      continue;
    }
    ids.add(route.id);
    used.add(index);
    const valid =
      'disposition' in route
        ? hasBoundaryProvenance(root, route)
        : hasResourceProvenance(root, route);
    if (!valid) {
      fail('HOST_CONTRACT_RESOURCE_PROVENANCE_MISSING');
      continue;
    }
    rows.push({ ...route, registration_index: index });
  }
  return {
    resources: rows.filter(row => !('disposition' in row)),
    boundaries: rows.filter(row => 'disposition' in row),
    findings,
  };
}

function matchesCallbackBody(
  route: CallbackSelection,
  config: { callback_target?: string; callback_callees?: string[] },
): boolean {
  return (
    (route.callbackTarget === undefined || config.callback_target === route.callbackTarget) &&
    route.callbackCallees.every(callee => config.callback_callees?.includes(callee))
  );
}

function hasResourceProvenance(root: string, route: CallbackResourceRoute): boolean {
  const consumer = source(root, route.callbackSource);
  const scope = consumer.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === route.scope,
  );
  const calls = scope ? callSignatures(scope, consumer) : new Set<string>();
  const callees = new Set([...calls].map(value => (JSON.parse(value) as string[])[0]));
  return (
    hasOwnerCall(root, route.producer, route.owner, route.entrypoint) &&
    calls.has(JSON.stringify(['readPackagedText', route.readerArgument])) &&
    route.requiredCallees.every(callee => callees.has(callee))
  );
}

function hasOwnerCall(
  root: string,
  producerPath: string,
  owner: string,
  entrypoint: string,
): boolean {
  const producer = source(root, producerPath);
  const relative = nodePath.posix
    .relative(nodePath.posix.dirname(producerPath), owner)
    .replace(/\.ts$/u, '.js');
  const module = relative.startsWith('.') ? relative : `./${relative}`;
  const producerCalls = [...callSignatures(producer, producer)].map(
    value => JSON.parse(value) as string[],
  );
  return (
    producer.statements.some(node =>
      [module, module.replace(/\.js$/u, '.ts')].some(specifier =>
        importsDelegateGate(node, specifier, entrypoint),
      ),
    ) &&
    producerCalls.some(call => call[0] === entrypoint) &&
    source(root, owner).statements.some(
      node =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text === entrypoint &&
        node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )
  );
}

function hasBoundaryProvenance(root: string, route: CallbackBoundaryRoute): boolean {
  const file = source(root, route.callbackSource);
  let scope: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name?.getText(file) === route.scope
    )
      scope = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  const calls = scope ? callSignatures(scope, file) : new Set<string>();
  const expressions = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) || ts.isPrefixUnaryExpression(node))
      expressions.add(node.getText(file));
    ts.forEachChild(node, collect);
  };
  if (scope) collect(scope);
  return (
    ['enrollment', 'host_policy'].includes(route.disposition) &&
    route.reason.trim().length > 0 &&
    hasBoundaryOwners(root, route) &&
    (route.readerArgument === undefined ||
      calls.has(JSON.stringify(['readPackagedText', route.readerArgument]))) &&
    route.requiredCalls.every(call => calls.has(JSON.stringify(call))) &&
    route.conditions.every(condition => expressions.has(condition))
  );
}

function hasBoundaryOwners(root: string, route: CallbackBoundaryRoute): boolean {
  return (
    hasOwnerCall(root, route.producer ?? route.callbackSource, route.owner, route.entrypoint) &&
    (route.projectionEntrypoint === undefined ||
      hasOwnerCall(root, route.callbackSource, route.owner, route.projectionEntrypoint))
  );
}
export const HOST_CONTRACT_OWNER_SOURCES = [
  CODEX_ADAPTER,
  OPENCODE_CATALOGUE,
  SHARED_GATE,
  SHARED_INTAKE_FIELDS,
  CURSOR_WRAPPERS,
] as const;

function source(root: string, path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(nodePath.join(root, path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function initializerValue(value: ts.Expression): ts.Expression {
  let expression = value;
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function declaredStringArrays(
  file: ts.SourceFile,
): { name: string; values: string[]; line: number }[] {
  const arrays: { name: string; values: string[]; line: number }[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const expression = initializerValue(node.initializer);
      if (ts.isArrayLiteralExpression(expression)) {
        const values = expression.elements.flatMap(entry =>
          ts.isStringLiteral(entry) ? [entry.text] : [],
        );
        if (values.length === expression.elements.length)
          arrays.push({
            name: node.name.text,
            values,
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return arrays;
}

function competingOwner(id: string, path: string, declaration: string, line: number): Finding {
  return {
    code: 'COMPETING_HOST_CONTRACT_OWNER',
    severity: 'error',
    message: `${id}: independently authored policy remains at ${path}:${line} (${declaration}).`,
    metadata: { owner_id: id, path, declaration, line },
  };
}

function intakeOwners(root: string): Finding[] {
  // Compare with the existing decision owner's actual inputs, not a second list.
  const gate = source(root, SHARED_GATE);
  const usesSharedFields = gate.statements.some(statement => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== './lib/hierarchy.ts'
    )
      return false;
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(binding => binding.name.text === 'REQUIRED_INTAKE_FIELDS')
    );
  });
  const owner = usesSharedFields ? source(root, SHARED_INTAKE_FIELDS) : gate;
  // Historical proof fixtures predate the shared hierarchy declaration.
  const name = usesSharedFields ? 'REQUIRED_INTAKE_FIELDS' : 'required';
  const declarations = declaredStringArrays(owner).filter(entry => entry.name === name);
  if (declarations.length !== 1 || !declarations[0]?.values.length)
    throw new Error(`Cannot identify one shared intake input declaration in ${owner.fileName}`);
  const expected = new Set(declarations[0].values);
  return declaredStringArrays(source(root, CODEX_ADAPTER))
    .filter(entry => {
      const actual = new Set(entry.values);
      return actual.size === expected.size && [...expected].every(value => actual.has(value));
    })
    .map(entry =>
      competingOwner('codex.intake.required-fields', CODEX_ADAPTER, entry.name, entry.line),
    );
}

function importedOwner(module: string, imported: string): string | undefined {
  if (module.endsWith('/codex-plugin/catalogue.js') && imported === 'generateCodexPluginAssets')
    return 'opencode.catalogue.codex-renderer-authority';
  if (module.endsWith('/cursor-wrappers.js') && imported === 'CURSOR_COMMAND_WRAPPERS')
    return 'opencode.catalogue.cursor-command-authority';
  return undefined;
}

function importOwners(file: ts.SourceFile, statement: ts.Statement): Finding[] {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
  )
    return [];
  const module = statement.moduleSpecifier.text;
  const bindings = statement.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  return bindings.elements.flatMap(binding => {
    if (binding.isTypeOnly) return [];
    const imported = (binding.propertyName ?? binding.name).text;
    const owner = importedOwner(module, imported);
    if (owner === undefined) return [];
    const line = file.getLineAndCharacterOfPosition(binding.getStart()).line + 1;
    return [competingOwner(owner, OPENCODE_CATALOGUE, imported, line)];
  });
}

function catalogueOwners(root: string): Finding[] {
  const file = source(root, OPENCODE_CATALOGUE);
  return file.statements.flatMap(statement => importOwners(file, statement));
}

function isAuthoredDescription(
  value: ts.Expression | undefined,
  strings: ReadonlySet<string>,
): value is ts.Expression {
  return (
    value !== undefined &&
    (ts.isStringLiteral(value) || (ts.isIdentifier(value) && strings.has(value.text)))
  );
}

function cursorWorkflowPurposeOwners(root: string): Finding[] {
  const path = CURSOR_WRAPPERS;
  const file = source(root, path);
  const strings = new Set<string>();
  function collect(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteral(initializerValue(node.initializer))
    )
      strings.add(node.name.text);
    ts.forEachChild(node, collect);
  }
  collect(file);
  const findings: Finding[] = [];
  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(
        node.properties.flatMap(property =>
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
            ? [[property.name.text, initializerValue(property.initializer)] as const]
            : [],
        ),
      );
      const reference = properties.get('referencePath');
      const description = properties.get('description');
      const skill =
        reference && ts.isStringLiteral(reference)
          ? /^\.safeword\/skills\/(?<skill>[\w-]+)\/(?<file>[\w-]+)\.md$/u.exec(reference.text)
              ?.groups
          : undefined;
      if (skill && isAuthoredDescription(description, strings)) {
        const line = file.getLineAndCharacterOfPosition(description.getStart()).line + 1;
        const suffix = skill.file === 'SKILL' ? '' : `.${skill.file}`;
        findings.push(
          competingOwner(
            `cursor.rule.${skill.skill}${suffix}.purpose`,
            path,
            `${skill.skill}/${skill.file}`,
            line,
          ),
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return findings;
}

/** Source facts only; no host decision or caller-authored maintenance-savings claim. */
export function findCompetingHostContractOwners(root: string): Finding[] {
  const codex = source(root, CODEX_ADAPTER);
  const timestamps = codex.statements.flatMap(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'currentTimestampContext'
      ? [
          competingOwner(
            'codex.prompt.timestamp',
            CODEX_ADAPTER,
            node.name.text,
            codex.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          ),
        ]
      : [],
  );
  return [
    ...intakeOwners(root),
    ...catalogueOwners(root),
    ...cursorWorkflowPurposeOwners(root),
    ...timestamps,
  ];
}

function importsDelegateGate(node: ts.Node, module: string, name: string): boolean {
  if (
    !ts.isImportDeclaration(node) ||
    node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
    !ts.isStringLiteral(node.moduleSpecifier) ||
    node.moduleSpecifier.text !== module
  )
    return false;
  const bindings = node.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.some(
    entry => !entry.isTypeOnly && entry.name.text === name && !entry.propertyName,
  );
}
function canonicalDelegateTarget(node: ts.Node, file: ts.SourceFile, owner: string): boolean {
  if (
    !ts.isVariableDeclaration(node) ||
    node.name.getText(file) !== 'claudeHookPath' ||
    !node.initializer
  )
    return false;
  const value = node.initializer;
  if (!ts.isCallExpression(value) || value.expression.getText(file) !== 'nodePath.join')
    return false;
  return (
    value.arguments.length === 3 &&
    value.arguments[0]?.getText(file) === 'hookDirectory' &&
    value.arguments
      .slice(1)
      .every(
        (argument, index) =>
          ts.isStringLiteral(argument) && argument.text === ['..', nodePath.basename(owner)][index],
      )
  );
}
function callsCursorSharedHook(call: ts.Node | undefined, file: ts.SourceFile): boolean {
  if (!call || !ts.isCallExpression(call) || call.expression.getText(file) !== 'runClaudeHook')
    return false;
  const options = call.arguments[0];
  return (
    !!options &&
    ts.isObjectLiteralExpression(options) &&
    options.properties.some(
      property =>
        ts.isShorthandPropertyAssignment(property) && property.name.text === 'claudeHookPath',
    )
  );
}
function mappedCursorGate(node: ts.Node, file: ts.SourceFile): boolean {
  if (!ts.isCallExpression(node) || node.expression.getText(file) !== 'decideFromGate')
    return false;
  return callsCursorSharedHook(node.arguments[0], file);
}
/** Existing post-tool transport: translatePostOutput(runClaudeHook(...).stdout). */
function mappedCursorPost(node: ts.Node, file: ts.SourceFile): boolean {
  if (!ts.isCallExpression(node) || node.expression.getText(file) !== 'translatePostOutput')
    return false;
  const output = node.arguments[0];
  if (!output || !ts.isPropertyAccessExpression(output) || output.name.text !== 'stdout')
    return false;
  return callsCursorSharedHook(output.expression, file);
}

/** Supported Cursor gate/post source shapes, not general control-flow or host execution proof. */
export function hasCursorHookDelegation(root: string, adapter: string, owner: string): boolean {
  const preTool = owner === SHARED_GATE.slice('packages/cli/templates/'.length);
  const file = source(root, `packages/cli/templates/${adapter}`);
  let imported = false,
    mapped = preTool,
    target = false,
    delegated = false;
  function visit(node: ts.Node): void {
    imported ||= importsDelegateGate(node, './gate-adapter.ts', 'runClaudeHook');
    mapped ||= importsDelegateGate(node, './gate-adapter.ts', 'translatePostOutput');
    target ||= canonicalDelegateTarget(node, file, owner);
    delegated ||= preTool ? mappedCursorGate(node, file) : mappedCursorPost(node, file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imported && mapped && target && delegated;
}

function callSignatures(node: ts.Node, file: ts.SourceFile): Set<string> {
  const calls = new Set<string>();
  function visit(child: ts.Node): void {
    if (ts.isCallExpression(child))
      calls.add(
        JSON.stringify([
          child.expression.getText(file),
          ...child.arguments.map(argument => argument.getText(file)),
        ]),
      );
    ts.forEachChild(child, visit);
  }
  visit(node);
  return calls;
}

/** Exact relative import and awaited shared-library call, not control-flow/execution proof. */
export function hasLibraryDelegation(
  root: string,
  adapter: string,
  owner: string,
  entrypoint: string,
  awaited = true,
): boolean {
  const file = source(root, `packages/cli/templates/${adapter}`);
  const relative = nodePath.posix.relative(nodePath.posix.dirname(adapter), owner);
  const module = relative.startsWith('.') ? relative : `./${relative}`;
  let imported = false,
    delegated = false;
  function visit(node: ts.Node): void {
    imported ||= importsDelegateGate(node, module, entrypoint);
    let call: ts.Node | undefined = awaited ? undefined : node;
    if (ts.isAwaitExpression(node)) call = node.expression;
    delegated ||=
      call !== undefined &&
      ts.isCallExpression(call) &&
      ts.isIdentifier(call.expression) &&
      call.expression.text === entrypoint;
    ts.forEachChild(node, visit);
  }
  visit(file);
  const exported = source(root, `packages/cli/templates/${owner}`).statements.some(
    statement =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === entrypoint &&
      statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  return imported && delegated && exported;
}
function codexRunnerDelegates(root: string, adapter: string): boolean {
  const file = source(root, CODEX_ADAPTER);
  const declarations = file.statements.flatMap(statement =>
    ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
  );
  const target = declarations.find(
    node => node.name.getText(file) === 'PRE_TOOL_QUALITY_HOOK_PATH',
  )?.initializer;
  if (!target || !ts.isStringLiteral(target) || `hooks/${target.text}` !== adapter) return false;
  const runners = declarations.find(
    node => node.name.getText(file) === 'CODEX_HOOK_RUNNERS',
  )?.initializer;
  if (!runners || !ts.isObjectLiteralExpression(runners)) return false;
  const mapped = runners.properties.some(
    property =>
      ts.isPropertyAssignment(property) &&
      ts.isStringLiteral(property.name) &&
      property.name.text === 'pre-tool-use' &&
      property.initializer.getText(file) === 'runPreToolUse',
  );
  const runner = file.statements.find(
    statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'runPreToolUse',
  );
  if (!mapped || !runner) return false;
  const calls = callSignatures(runner, file);
  return [
    ['snapshotPackagedHook', 'PRE_TOOL_QUALITY_HOOK_PATH'],
    ['runHookFile', 'snapshot.hookPath', 'rawInput', 'projectDirectory'],
    ['runEnrolledPreToolUse', 'rawInput', 'projectDirectory', 'qualityResult'],
  ].every(call => calls.has(JSON.stringify(call)));
}
/** Exact supported Codex source chain only; installed command controls remain separate proof. */
export function hasCodexQualityDelegation(root: string, adapter: string, owner: string): boolean {
  if (owner !== SHARED_GATE.slice('packages/cli/templates/'.length)) return false;
  return codexRunnerDelegates(root, adapter) && hasCodexRelayDelegation(root, adapter, owner);
}

/** Mechanical shared relay shape; not argument, reachability or output proof. */
function hasCodexRelayDelegation(root: string, adapter: string, owner: string): boolean {
  const file = source(root, `packages/cli/templates/${adapter}`);
  let imported = false,
    target = false;
  function visit(node: ts.Node): void {
    imported ||= importsDelegateGate(node, './pre-tool-quality-helpers.ts', 'runClaudeHookAsCodex');
    target ||= canonicalDelegateTarget(node, file, owner);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return (
    imported &&
    target &&
    callSignatures(file, file).has(
      JSON.stringify(['runClaudeHookAsCodex', 'claudeHookPath', 'translated']),
    )
  );
}

function openCodeBridgeDelegates(root: string): boolean {
  const file = source(root, 'packages/cli/src/opencode/dispatcher.ts');
  const imported = file.statements.some(node =>
    importsDelegateGate(node, '../commands/codex-hook.js', 'codexHook'),
  );
  const flags = new Set(
    file.statements
      .filter(node => ts.isExpressionStatement(node))
      .map(node => node.expression.getText(file)),
  );
  return (
    imported &&
    flags.has("process.env.SAFEWORD_AGENT_RUNTIME = 'opencode'") &&
    flags.has("process.env.SAFEWORD_CODEX_DENY_MODE = 'exit-code'") &&
    callSignatures(file, file).has(JSON.stringify(['codexHook', "'pre-tool-use'"]))
  );
}
function openCodeV2Setup(file: ts.SourceFile): ts.Node | undefined {
  const exported = file.statements.find(node => ts.isExportAssignment(node))?.expression;
  if (
    !exported ||
    !ts.isCallExpression(exported) ||
    exported.expression.getText(file) !== 'Plugin.define'
  )
    return undefined;
  const definition = exported.arguments[0];
  if (!definition || !ts.isObjectLiteralExpression(definition)) return undefined;
  return definition.properties.find(
    node => ts.isMethodDeclaration(node) && node.name.getText(file) === 'setup',
  );
}
function openCodeV2Envelope(envelope: ts.Node | undefined, file: ts.SourceFile): boolean {
  if (!envelope || !ts.isObjectLiteralExpression(envelope)) return false;
  const fields = new Map(
    envelope.properties.flatMap(property =>
      ts.isPropertyAssignment(property)
        ? [[property.name.getText(file), property.initializer.getText(file)]]
        : [],
    ),
  );
  return (
    fields.get('cwd') === 'project' &&
    fields.get('session_id') === 'event.sessionID' &&
    fields.get('hook_event_name') === "'PreToolUse'" &&
    envelope.properties.some(
      property =>
        ts.isSpreadAssignment(property) &&
        property.expression.getText(file) === 'canonicalTool(event.tool, event.input)',
    )
  );
}

/** Exact SDK setup/callback/transport source shape, not native execution or admission proof. */
export function hasOpenCodeV2QualityDelegation(
  root: string,
  adapter: string,
  owner: string,
): boolean {
  if (!hasCodexQualityDelegation(root, adapter, owner) || !openCodeBridgeDelegates(root))
    return false;
  const file = source(root, 'packages/opencode-v2-plugin/src/index.ts');
  if (!file.statements.some(node => importsDelegateGate(node, '@opencode/plugin', 'Plugin')))
    return false;
  if (
    !file.statements.some(node =>
      importsDelegateGate(node, '../../cli/src/opencode/tool-codec.js', 'normalizeOpenCodeTool'),
    )
  )
    return false;
  const codec = file.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'canonicalTool',
  );
  if (
    !codec ||
    !callSignatures(codec, file).has(
      JSON.stringify(['normalizeOpenCodeTool', "'v2'", 'tool', 'input']),
    )
  )
    return false;
  const setup = openCodeV2Setup(file);
  if (!setup) return false;
  let delegates = false;
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(file) === 'context.tool.hook' &&
      node.arguments[0]?.getText(file) === "'execute.before'"
    ) {
      const callback = node.arguments[1];
      if (callback && ts.isArrowFunction(callback)) {
        function callbackCall(call: ts.Node): void {
          if (
            ts.isCallExpression(call) &&
            call.expression.getText(file) === 'dispatch' &&
            call.arguments[0]?.getText(file) === 'project'
          ) {
            delegates ||= openCodeV2Envelope(call.arguments[1], file);
          }
          ts.forEachChild(call, callbackCall);
        }
        callbackCall(callback);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(setup);
  const transport = file.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'dispatch',
  );
  return (
    delegates &&
    !!transport &&
    [...callSignatures(transport, file)].some(value => {
      const [name, binary, args] = JSON.parse(value) as string[];
      return (
        name === 'spawn' &&
        binary === "'bun'" &&
        args === '[nodePath.join(packageRoot, layout.dispatcher)]'
      );
    })
  );
}

/** Exact existing Codex Stop runner shape; neither control-flow nor native-delivery proof. */
export function hasCodexStopDelegation(root: string, adapter: string): boolean {
  if (adapter !== 'hooks/codex/stop.ts') return false;
  const file = source(root, CODEX_ADAPTER);
  const runners = file.statements
    .flatMap(statement =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
    )
    .find(node => node.name.getText(file) === 'CODEX_HOOK_RUNNERS')?.initializer;
  if (!runners || !ts.isObjectLiteralExpression(runners)) return false;
  const mapped = runners.properties.some(
    property =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(file) === 'stop' &&
      property.initializer.getText(file) === 'runStop',
  );
  const runner = file.statements.find(
    statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'runStop',
  );
  return (
    mapped &&
    runner !== undefined &&
    callSignatures(runner, file).has(
      JSON.stringify(['runPackagedHook', "'codex/stop.ts'", 'rawInput', 'projectDirectory']),
    )
  );
}

function codexContextRunner(
  file: ts.SourceFile,
  event: string,
): ts.FunctionDeclaration | undefined {
  const command = Object.entries(CODEX_MIGRATION_SCHEMA.hookEventNames).find(
    ([, name]) => name === event,
  )?.[0];
  const runners = file.statements
    .flatMap(statement =>
      ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
    )
    .find(node => node.name.getText(file) === 'CODEX_HOOK_RUNNERS')?.initializer;
  if (!command || !runners || !ts.isObjectLiteralExpression(runners)) return undefined;
  const mapping = runners.properties.find(
    property =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === command,
  );
  if (!mapping || !ts.isPropertyAssignment(mapping) || !ts.isIdentifier(mapping.initializer))
    return undefined;
  return file.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === mapping.initializer.getText(file),
  );
}
function codexContextCalls(file: ts.SourceFile, event: string): Set<string> {
  const runner = codexContextRunner(file, event);
  return runner ? callSignatures(runner, file) : new Set<string>();
}

/** Exact current runner/queue provenance; not branch, forwarding or native proof. */
export function hasCodexEnvelopeProvenance(root: string, composition: HandlerComposition): boolean {
  const envelope = composition.envelope;
  if (envelope?.owner !== CODEX_ADAPTER) return false;
  const file = source(root, CODEX_ADAPTER),
    runner = codexContextRunner(file, composition.event);
  const parent = file.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'codexHook',
  );
  if (!runner?.name || !parent) return false;
  return (
    namedScopesPresent(file, envelope.localPolicyScopes, ['codexHook', runner.name.text]) &&
    hasCodexQueueCall(file, runner, composition.event) &&
    hasCodexNativeAuthority(root, file, parent) &&
    (composition.event !== 'Stop' || hasCodexExtractionProvenance(root))
  );
}
function hasCodexNativeAuthority(root: string, file: ts.SourceFile, parent: ts.Node): boolean {
  const calls = callSignatures(parent, file);
  const required = [
    ['requireNativeProject', 'input', 'normalized'],
    ['legacyCodexEventIsViable', 'projectDirectory', 'normalized'],
    ['CODEX_HOOK_RUNNERS[normalized]', 'projectDirectory'],
  ];
  return (
    required.every(call => calls.has(JSON.stringify(call))) &&
    hasOwnerCall(
      root,
      CODEX_ADAPTER,
      'packages/cli/src/codex-plugin/legacy-authority.ts',
      'legacyCodexEventIsViable',
    )
  );
}
function namedScopesPresent(
  file: ts.SourceFile,
  scopes: readonly string[],
  required: readonly string[],
): boolean {
  return (
    required.every(name => scopes.includes(name)) &&
    new Set(scopes).size === scopes.length &&
    scopes.every(name =>
      file.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === name),
    )
  );
}
function hasCodexQueueCall(
  file: ts.SourceFile,
  runner: ts.FunctionDeclaration,
  event: string,
): boolean {
  const queue = (
    {
      PostToolUse: 'POST_TOOL_GUIDANCE_PATH',
      UserPromptSubmit: 'PROMPT_CONTEXT_PATH',
      Stop: 'STOP_CONTINUATION_PATH',
    } as Readonly<Record<string, string>>
  )[event];
  return (
    queue === undefined ||
    callSignatures(runner, file).has(
      JSON.stringify(['readProjectTextFile', 'projectDirectory', queue]),
    )
  );
}
function hasCodexExtractionProvenance(root: string): boolean {
  const owner = 'packages/cli/templates/hooks/codex/stop.ts';
  const file = source(root, owner);
  const requirements = {
    main: [['runRetroExtraction', 'projectDirectory', 'input']],
    runRetroExtraction: [['resolveExtractCommand', 'projectDirectory', 'decision']],
  };
  return (
    Object.entries(requirements).every(([name, required]) => {
      const scope = file.statements.find(
        node => ts.isFunctionDeclaration(node) && node.name?.text === name,
      );
      const calls = scope ? callSignatures(scope, file) : new Set<string>();
      return required.every(call => calls.has(JSON.stringify(call)));
    }) &&
    hasOwnerCall(
      root,
      owner,
      'packages/cli/templates/hooks/lib/retro-trigger.ts',
      'decideRetroRun',
    ) &&
    hasOwnerCall(root, owner, 'packages/cli/templates/hooks/lib/retro-extract.ts', 'retroChildArgs')
  );
}

/** Current module protocol and native transport shape, not branch or IDE delivery proof. */
export function hasCursorEnvelopeProvenance(
  root: string,
  composition: HandlerComposition,
): boolean {
  const owner = 'packages/cli/templates/hooks/cursor/stop.ts';
  if (
    composition.envelope?.owner !== owner ||
    composition.delegate !== 'hooks/cursor/stop.ts' ||
    composition.event !== 'stop'
  )
    return false;
  const file = source(root, owner);
  const scopes = [
    '<module>',
    ...file.statements.flatMap(node =>
      ts.isFunctionDeclaration(node) && node.name ? [node.name.text] : [],
    ),
  ];
  if (
    JSON.stringify(scopes.toSorted((left, right) => left.localeCompare(right))) !==
    JSON.stringify(
      composition.envelope.localPolicyScopes.toSorted((left, right) => left.localeCompare(right)),
    )
  )
    return false;
  const moduleCalls = new Set(
    file.statements
      .filter(node => !ts.isFunctionDeclaration(node))
      .flatMap(node => [...callSignatures(node, file)]),
  );
  const required = [
    ['process.chdir', 'workspace'],
    ['resolveRunIdentity', 'input', "{ runtime: 'cursor' }"],
    ['evaluateSessionDoneEvidence', 'process.cwd()', 'runIdentity'],
    ['cursorEditedMarkerPath', 'input'],
    ['readLastAssistantMessage', 'input.transcript_path'],
    ['isAutomatedEvidenceRun', 'process.cwd()', 'runIdentity'],
    ['emitRetroOrEmpty', 'input'],
  ];
  return (
    required.every(call => moduleCalls.has(JSON.stringify(call))) &&
    cursorProtocolConditions(file) &&
    cursorEnvelopeTransport(root, composition.sourceFamily)
  );
}
function cursorProtocolConditions(file: ts.SourceFile): boolean {
  const expressions = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) || ts.isPrefixUnaryExpression(node))
      expressions.add(node.getText(file));
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [
    "!existsSync('.safeword')",
    "input.status !== 'completed'",
    '(input.loop_count ?? 0) === 0',
  ].every(value => expressions.has(value));
}
function cursorEnvelopeTransport(root: string, family: string | undefined): boolean {
  if (family === undefined) return true;
  if (family !== 'cursor-native') return false;
  const owner = 'packages/cli/src/cursor-plugin/dispatch.ts';
  const file = source(root, owner);
  return (
    hasOwnerCall(
      root,
      owner,
      'packages/cli/src/cursor-plugin/bindings.ts',
      'cursorPluginBindings',
    ) &&
    [...callSignatures(file, file)].some(value => {
      const [callee, binary, args] = JSON.parse(value) as string[];
      return (
        callee === 'spawnSync' &&
        binary === 'process.execPath' &&
        args ===
          "[nodePath.join(root, CURSOR_PLUGIN_LAYOUT.templates, 'hooks', binding.path), ...binding.args]"
      );
    })
  );
}
function hasPostToolRelayCall(file: ts.SourceFile, target: string): boolean {
  const listed = declaredStringArrays(file).some(
    entry => entry.name === 'POST_TOOL_CONTEXT_HOOKS' && entry.values.includes(target),
  );
  let loop = false;
  function visit(node: ts.Node): void {
    if (ts.isForOfStatement(node))
      loop ||=
        node.expression.getText(file) === 'POST_TOOL_CONTEXT_HOOKS' &&
        node.initializer.getText(file) === 'const hook' &&
        callSignatures(node.statement, file).has(
          JSON.stringify(['runPackagedHook', 'hook', 'rawInput', 'projectDirectory']),
        );
    ts.forEachChild(node, visit);
  }
  visit(file);
  return listed && loop;
}

/** Named import projection only; no transitive/body semantics. */
function codexImportedOwners(statement: ts.Statement): [string, string][] {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
    return [];
  const clause = statement.importClause;
  if (clause?.phaseModifier === ts.SyntaxKind.TypeKeyword) return [];
  const bindings = clause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  const module = statement.moduleSpecifier.text;
  const owner = module.startsWith('.')
    ? nodePath.posix
        .normalize(nodePath.posix.join(nodePath.posix.dirname(CODEX_ADAPTER), module))
        .replace(/\.js$/u, '.ts')
    : module;
  return bindings.elements
    .filter(binding => !binding.isTypeOnly)
    .map(binding => [binding.name.text, owner]);
}
function codexNamedOwners(file: ts.SourceFile): Map<string, string> {
  return new Map(
    file.statements.flatMap(statement =>
      ts.isFunctionDeclaration(statement) && statement.name
        ? [[statement.name.text, CODEX_ADAPTER]]
        : codexImportedOwners(statement),
    ),
  );
}
function outerDispositionError(
  matching: readonly OuterCallDisposition[],
  event: string,
): string | undefined {
  if (matching.length !== 1)
    return matching.length === 0
      ? 'HOST_CONTRACT_OUTER_DISPOSITION_MISSING'
      : 'HOST_CONTRACT_OUTER_DISPOSITION_DUPLICATE';
  const declaration = matching[0];
  if (!declaration) return 'HOST_CONTRACT_OUTER_DISPOSITION_MISSING';
  if (declaration.events && !declaration.events.includes(event))
    return 'HOST_CONTRACT_OUTER_DISPOSITION_EXTRA';
  if (
    !['transport', 'host_policy', 'shared_delegate', 'evidence'].includes(declaration.kind) ||
    !declaration.reason?.trim()
  )
    return 'HOST_CONTRACT_OUTER_DISPOSITION_INVALID';
  return undefined;
}
function outerCallRows(
  signatures: ReadonlySet<string>,
  owners: ReadonlyMap<string, string>,
  declarations: readonly OuterCallDisposition[],
  event: string,
  fail: (code: string, callee: string, event?: string) => void,
) {
  const calls = [...signatures].flatMap(signature => {
    const [callee = '', ...arguments_] = JSON.parse(signature) as string[];
    const owner = owners.get(callee);
    if (owner === undefined) return [];
    const matching = declarations.filter(row => row.callee === callee);
    const error = outerDispositionError(matching, event);
    if (error) fail(error, callee, event);
    return [
      {
        callee,
        owner,
        arguments: arguments_,
        kind: error ? 'unresolved' : matching[0]?.kind,
        reason: matching[0]?.reason,
      },
    ];
  });
  for (const declaration of declarations) {
    if (declaration.events && !declaration.events.includes(event)) continue;
    if (calls.every(row => row.callee !== declaration.callee))
      fail('HOST_CONTRACT_OUTER_DISPOSITION_MISSING', declaration.callee, event);
  }
  return calls;
}
type SelectedFacet = { composition_id: string; registration_index: number; behavior_id: string };
/** Bounded named-call accounting joined to exact selected compositions; never whole semantic proof. */
export function codexOuterCallCoverage(
  root: string,
  declarations: readonly OuterCallDisposition[],
  compositions: readonly HandlerComposition[],
  facets: readonly SelectedFacet[],
) {
  const file = source(root, CODEX_ADAPTER),
    owners = codexNamedOwners(file);
  const parent = file.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === 'codexHook',
  );
  const parentCalls = parent ? callSignatures(parent, file) : new Set<string>();
  const findings: Finding[] = [];
  const fail = (code: string, callee: string, event?: string): void => {
    findings.push({
      code,
      severity: 'error',
      message: callee,
      metadata: { host: 'codex', callee, event },
    });
  };
  const coverage = compositions.flatMap(composition => {
    const selected = facets.filter(row => row.composition_id === composition.id);
    if (selected.length === 0) return [];
    const signatures = new Set([...parentCalls, ...codexContextCalls(file, composition.event)]);
    const calls = outerCallRows(signatures, owners, declarations, composition.event, fail);
    return [
      {
        composition_id: composition.id,
        registration_index: selected[0]?.registration_index,
        source: CODEX_ADAPTER,
        scope: 'registered-runner-and-codexHook-named-calls',
        shared_facets: selected.map(row => row.behavior_id),
        calls,
        complete: false,
        unresolved_scopes: [
          'transitive-policy-and-imported-bodies',
          'property-constructor-and-unbound-calls',
          'const-bound-functions-and-default-imports',
          'semantic-facet-completeness',
          'native-delivery-and-admission',
        ],
      },
    ];
  });
  for (const declaration of declarations)
    if (coverage.every(row => row.calls.every(call => call.callee !== declaration.callee)))
      fail('HOST_CONTRACT_OUTER_DISPOSITION_EXTRA', declaration.callee);
  if (!parent) fail('HOST_CONTRACT_OUTER_ENTRYPOINT_MISSING', 'codexHook');
  return { coverage, findings };
}
/** Registered runner and exact direct packaged call; not control-flow/native delivery proof. */
export function hasCodexContextDelegation(root: string, event: string, adapter: string): boolean {
  if (!adapter.startsWith('hooks/')) return false;
  const file = source(root, CODEX_ADAPTER);
  const calls = codexContextCalls(file, event),
    target = adapter.slice('hooks/'.length);
  if (event !== 'PostToolUse')
    return calls.has(
      JSON.stringify(['runPackagedHook', `'${target}'`, 'rawInput', 'projectDirectory']),
    );
  if (
    calls.has(JSON.stringify(['runPackagedHook', 'hook', 'rawInput', 'projectDirectory'])) &&
    hasPostToolRelayCall(file, target)
  )
    return true;
  const collector = file.statements.find(
    statement =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'collectPostToolLintContexts',
  );
  return (
    target === 'post-tool-lint.ts' &&
    calls.has(JSON.stringify(['collectPostToolLintContexts', 'lintInputs', 'projectDirectory'])) &&
    collector !== undefined &&
    callSignatures(collector, file).has(
      JSON.stringify(['runPackagedHook', "'post-tool-lint.ts'", 'lintInput', 'projectDirectory']),
    )
  );
}

function hasCodexScriptFacet(root: string, event: string, owner: string): boolean {
  if (hasCodexContextDelegation(root, event, owner)) return true;
  if (event !== 'PostToolUse') return false;
  const relay = `hooks/codex/${nodePath.posix.basename(owner)}`;
  return (
    hasCodexContextDelegation(root, event, relay) && hasCodexRelayDelegation(root, relay, owner)
  );
}

export function hasCompositionDelegation(
  root: string,
  composition: HandlerComposition & { host: string },
  binding: SharedBehaviorBinding,
): boolean {
  if (binding.entrypoint === undefined)
    return (
      composition.host === 'codex' &&
      composition.event !== 'Stop' &&
      hasCodexScriptFacet(root, composition.event, binding.owner)
    );
  const adapter = composition.delegate ?? '';
  if (composition.host === 'codex') {
    const valid =
      composition.event === 'Stop'
        ? hasCodexStopDelegation(root, adapter)
        : hasCodexContextDelegation(root, composition.event, adapter);
    if (!valid) return false;
  }
  return hasLibraryDelegation(root, adapter, binding.owner, binding.entrypoint, false);
}
