import assert from 'node:assert/strict';

import ts from 'typescript';

const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported parallel exec encoding';

/** Match the two observed literal requests to their own fields in the single host print. */
export function pairedExecOutput(input: string, command: string, raw: unknown): string | undefined {
  const [first, second, print, ...rest] = input.trim().split('\n');
  if (print !== 'text(JSON.stringify({a:a.output,b:b.output}));' || rest.length > 0) return;
  const requests = [first, second].map((line, index) => {
    const prefix = `const ${index === 0 ? 'a' : 'b'} = await tools.exec_command(`;
    assert.ok(line && line.startsWith(prefix) && line.endsWith(');'), unavailable);
    const literal = line.slice(prefix.length, -2);
    const request = JSON.parse(literal);
    assert.ok(typeof request?.cmd === 'string' && JSON.stringify(request) === literal, unavailable);
    return request.cmd as string;
  });
  assert.notEqual(requests[0], requests[1], unavailable);
  const fields = pairedFields(raw);
  if (requests[0] === command) return fields.a;
  return requests[1] === command ? fields.b : '';
}

function pairedFields(raw: unknown): { a: string; b: string } {
  assert.ok(Array.isArray(raw) && raw.length === 2, unavailable);
  const [header, payload] = raw;
  assert.ok(
    header?.type === 'input_text' &&
      /^Script completed\nWall time [\d.]+ seconds\nOutput:\n$/u.test(header.text),
    unavailable,
  );
  assert.ok(payload?.type === 'input_text' && typeof payload.text === 'string', unavailable);
  const fields = JSON.parse(payload.text);
  assert.ok(
    typeof fields?.a === 'string' &&
      typeof fields.b === 'string' &&
      JSON.stringify({ a: fields.a, b: fields.b }) === payload.text,
    unavailable,
  );
  return fields;
}

/** Workdir provenance for one literal direct request, never inherited shell context.
 * Reuse the bounded producer/emitter AST owner; parallel metadata remains unsupported.
 */
export function directExecWorkdir(input: string, command: string): string | undefined {
  const mixed = mixedRequest(input);
  if (mixed)
    return mixed.cmd === command && typeof mixed.workdir === 'string' ? mixed.workdir : undefined;
  const result = directResult(input, command);
  return typeof result.request?.workdir === 'string' ? result.request.workdir : undefined;
}

/** One observed host separator between two bound prints, not a general renderer.
 * Preserve stdout exactly; no raw output or missing stdout is reconstructed.
 */
export function directExecRender(
  input: string,
  command: string,
  stdout: string,
  exit: number,
): string | undefined {
  if (exit !== 0) return undefined;
  if (mixedRequest(input)) return undefined;
  const result = directResult(input, command);
  return result.request && result.wrapped ? `${stdout}\nEXIT_CODE=${exit}` : undefined;
}

function directResult(input: string, command: string) {
  const source = ts.createSourceFile(
    'native-input.js',
    input,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  assert.ok([2, 3].includes(source.statements.length), unavailable);
  const [first, last, metadata] = source.statements;
  assert.ok(first && ts.isVariableStatement(first), unavailable);
  assert.equal(first.modifiers?.length ?? 0, 0, unavailable);
  assert.equal(
    first.declarationList.flags & ts.NodeFlags.BlockScoped,
    ts.NodeFlags.Const,
    unavailable,
  );
  assert.equal(first.declarationList.declarations.length, 1, unavailable);
  const binding = first.declarationList.declarations[0];
  assert.ok(binding && ts.isIdentifier(binding.name), unavailable);
  assert.equal(binding.type, undefined, unavailable);
  assert.ok(!['tools', 'text'].includes(binding.name.text), unavailable);
  const awaited = binding.initializer;
  assert.ok(awaited && ts.isAwaitExpression(awaited), unavailable);
  assert.ok(last && ts.isExpressionStatement(last), unavailable);
  const emitter = singleCall(last.expression);
  assert.ok(ts.isIdentifier(emitter.expression) && emitter.expression.text === 'text', unavailable);
  const emitted = emitter.arguments[0];
  assert.ok(emitted && property(emitted, binding.name.text, 'output'), unavailable);
  const call = singleCall(awaited.expression);
  assert.ok(property(call.expression, 'tools', 'exec_command'), unavailable);
  if (metadata) exitEmission(metadata, binding.name.text);
  return {
    request: directRequest(call.arguments[0], source, command),
    wrapped: metadata !== undefined,
  };
}

function exitEmission(metadata: ts.Statement, binding: string): void {
  assert.ok(ts.isExpressionStatement(metadata), unavailable);
  const print = singleCall(metadata.expression);
  assert.ok(ts.isIdentifier(print.expression) && print.expression.text === 'text', unavailable);
  const value = print.arguments[0];
  assert.ok(value && ts.isBinaryExpression(value), unavailable);
  assert.equal(value.operatorToken.kind, ts.SyntaxKind.PlusToken, unavailable);
  assert.ok(ts.isStringLiteral(value.left) && value.left.text === 'EXIT_CODE=', unavailable);
  assert.ok(property(value.right, binding, 'exit_code'), unavailable);
}

function directRequest(
  node: ts.Expression | undefined,
  source: ts.SourceFile,
  command: string,
): { workdir?: unknown } | undefined {
  assert.ok(node && ts.isObjectLiteralExpression(node), unavailable);
  const keys = node.properties.map(p => {
    assert.ok(ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name), unavailable);
    return p.name.text;
  });
  assert.equal(new Set(keys).size, keys.length, unavailable);
  let request: { cmd?: unknown; workdir?: unknown };
  try {
    request = JSON.parse(node.getText(source)) as typeof request;
  } catch (error) {
    throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: nonliteral exec metadata', { cause: error });
  }
  return request.cmd === command ? request : undefined;
}

/** Recognize one captured producer/emitter, never execute or interpret arbitrary JS. */
export function parallelCommands(
  input: string,
  decode: (literal: string) => string[],
): string[] | undefined {
  const mixed = mixedRequest(input);
  if (mixed) return [mixed.cmd];
  return ordinaryParallelCommands(input, decode);
}

function ordinaryParallelCommands(
  input: string,
  decode: (literal: string) => string[],
): string[] | undefined {
  const source = parallelSource(input);
  if (!source) return undefined;
  const options = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext };
  const checked = ts.transpileModule(input, {
    compilerOptions: options,
    reportDiagnostics: true,
    fileName: 'native-input.js',
  });
  assert.equal(checked.diagnostics?.length ?? 0, 0, unavailable);
  assert.equal(source.statements.length, 2, unavailable);
  const [first, last] = source.statements;
  assert.ok(first && ts.isVariableStatement(first), unavailable);
  assert.equal(first.modifiers?.length ?? 0, 0, unavailable);
  assert.equal(
    first.declarationList.flags & ts.NodeFlags.BlockScoped,
    ts.NodeFlags.Const,
    unavailable,
  );
  assert.equal(first.declarationList.declarations.length, 1, unavailable);
  const binding = first.declarationList.declarations[0];
  assert.ok(binding, unavailable);
  assert.ok(ts.isIdentifier(binding.name), unavailable);
  assert.ok(!['Promise', 'tools', 'text'].includes(binding.name.text), unavailable);
  const awaited = binding.initializer;
  assert.ok(awaited && ts.isAwaitExpression(awaited), unavailable);
  const all = awaited.expression;
  assert.ok(ts.isCallExpression(all), unavailable);
  assert.ok(property(all.expression, 'Promise', 'all'), unavailable);
  assert.equal(all.questionDotToken, undefined, unavailable);
  assert.equal(all.arguments.length, 1, unavailable);
  const array = all.arguments[0];
  assert.ok(array && ts.isArrayLiteralExpression(array), unavailable);
  assert.ok(array.elements.length > 0, unavailable);
  assert.ok(last && ts.isExpressionStatement(last), unavailable);
  emission(last.expression, binding.name.text);
  return array.elements.flatMap(element => literalExec(element, source, decode));
}

/** The observed two-producer cell; validate its entire AST without executing it. */
function mixedRequest(input: string): { cmd: string; workdir?: unknown } | undefined {
  const source = mixedSource(input);
  if (!source) return undefined;
  return decodeMixed(source);
}

function mixedSource(input: string): ts.SourceFile | undefined {
  if (!input.includes('tools.web__run')) return undefined;
  const source = ts.createSourceFile(
    'native-input.js',
    input,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  if (!containsWebCall(source)) return undefined;
  const checked = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
    fileName: 'native-input.js',
  });
  assert.equal(checked.diagnostics?.length ?? 0, 0, unavailable);
  return source;
}

function decodeMixed(source: ts.SourceFile): { cmd: string; workdir?: unknown } {
  assert.equal(source.statements.length, 3, unavailable);
  const [first, webOutput, execOutput] = source.statements;
  assert.ok(first && ts.isVariableStatement(first), unavailable);
  assert.equal(first.modifiers?.length ?? 0, 0, unavailable);
  assert.equal(
    first.declarationList.flags & ts.NodeFlags.BlockScoped,
    ts.NodeFlags.Const,
    unavailable,
  );
  assert.equal(first.declarationList.declarations.length, 1, unavailable);
  const binding = first.declarationList.declarations[0];
  assert.ok(binding && ts.isIdentifier(binding.name), unavailable);
  assert.equal(binding.type, undefined, unavailable);
  assert.ok(!['Promise', 'tools', 'text'].includes(binding.name.text), unavailable);
  assert.ok(binding.initializer && ts.isAwaitExpression(binding.initializer), unavailable);
  const all = singleCall(binding.initializer.expression);
  assert.ok(property(all.expression, 'Promise', 'all'), unavailable);
  const array = all.arguments[0];
  assert.ok(array && ts.isArrayLiteralExpression(array), unavailable);
  assert.equal(array.elements.length, 2, unavailable);
  const web = singleCall(array.elements[0]);
  const exec = singleCall(array.elements[1]);
  assert.ok(property(web.expression, 'tools', 'web__run'), unavailable);
  assert.ok(property(exec.expression, 'tools', 'exec_command'), unavailable);
  const webArgument = web.arguments[0];
  assert.ok(webArgument && ts.isObjectLiteralExpression(webArgument), unavailable);
  literalJson(webArgument.getText(source));
  mixedEmission(webOutput, binding.name.text, '0', false);
  mixedEmission(execOutput, binding.name.text, '1', true);
  const argument = exec.arguments[0];
  assert.ok(argument && ts.isObjectLiteralExpression(argument), unavailable);
  // Use the same literal metadata checks as the direct producer.
  const raw = literalJson(argument.getText(source)) as {
    cmd?: unknown;
    command?: unknown;
    workdir?: unknown;
  };
  assert.equal(raw.command, undefined, unavailable);
  assert.ok(typeof raw.cmd === 'string', unavailable);
  assert.ok(directRequest(argument, source, raw.cmd), unavailable);
  return { ...raw, cmd: raw.cmd };
}

function containsWebCall(source: ts.SourceFile): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && property(node.expression, 'tools', 'web__run')) found = true;
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

function literalJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(unavailable, { cause: error });
  }
}

function mixedEmission(
  statement: ts.Statement | undefined,
  binding: string,
  index: string,
  output: boolean,
): void {
  assert.ok(statement && ts.isExpressionStatement(statement), unavailable);
  const emit = singleCall(statement.expression);
  assert.ok(ts.isIdentifier(emit.expression) && emit.expression.text === 'text', unavailable);
  let value = emit.arguments[0];
  if (output) {
    assert.ok(value && ts.isPropertyAccessExpression(value), unavailable);
    assert.equal(value.questionDotToken, undefined, unavailable);
    assert.equal(value.name.text, 'output', unavailable);
    value = value.expression;
  }
  assert.ok(value && ts.isElementAccessExpression(value), unavailable);
  assert.equal(value.questionDotToken, undefined, unavailable);
  assert.ok(ts.isIdentifier(value.expression), unavailable);
  assert.equal(value.expression.text, binding, unavailable);
  assert.ok(ts.isNumericLiteral(value.argumentExpression), unavailable);
  assert.equal(value.argumentExpression.text, index, unavailable);
}

function parallelSource(input: string): ts.SourceFile | undefined {
  if (!input.includes('Promise')) return undefined;
  const source = ts.createSourceFile(
    'native-input.js',
    input,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  let found = false;
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && property(node.expression, 'Promise', 'all')) found = true;
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found ? source : undefined; // Literal/comment mentions retain existing direct handling.
}

function literalExec(
  node: ts.Expression,
  source: ts.SourceFile,
  decode: (literal: string) => string[],
): string[] {
  assert.ok(ts.isCallExpression(node), unavailable);
  assert.ok(property(node.expression, 'tools', 'exec_command'), unavailable);
  assert.equal(node.questionDotToken, undefined, unavailable);
  assert.equal(node.arguments.length, 1, unavailable);
  const argument = node.arguments[0];
  assert.ok(argument && ts.isObjectLiteralExpression(argument), unavailable);
  const commands = decode(argument.getText(source));
  assert.equal(commands.length, 1, unavailable);
  return commands;
}

function property(node: ts.Node, receiver: string, name: string): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    !node.questionDotToken &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === receiver &&
    node.name.text === name
  );
}

function singleCall(node: ts.Node | undefined): ts.CallExpression {
  assert.ok(
    node && ts.isCallExpression(node) && !node.questionDotToken && node.arguments.length === 1,
    unavailable,
  );
  return node;
}

function emission(node: ts.Expression, binding: string): void {
  const text = singleCall(node);
  assert.ok(ts.isIdentifier(text.expression) && text.expression.text === 'text', unavailable);
  const join = singleCall(text.arguments[0]);
  assert.ok(
    ts.isPropertyAccessExpression(join.expression) &&
      !join.expression.questionDotToken &&
      join.expression.name.text === 'join',
    unavailable,
  );
  const separator = join.arguments[0];
  assert.ok(separator && ts.isStringLiteralLike(separator), unavailable);
  const map = singleCall(join.expression.expression);
  assert.ok(property(map.expression, binding, 'map'), unavailable);
  outputMapper(map.arguments[0]);
}

function outputMapper(mapper: ts.Expression | undefined): void {
  assert.ok(
    mapper &&
      ts.isArrowFunction(mapper) &&
      !mapper.modifiers?.length &&
      mapper.parameters.length === 1,
    unavailable,
  );
  const parameter = mapper.parameters[0];
  assert.ok(
    parameter &&
      ts.isIdentifier(parameter.name) &&
      !parameter.initializer &&
      !parameter.dotDotDotToken &&
      !parameter.questionToken &&
      !parameter.type,
    unavailable,
  );
  assert.ok(property(mapper.body, parameter.name.text, 'output'), unavailable);
}
