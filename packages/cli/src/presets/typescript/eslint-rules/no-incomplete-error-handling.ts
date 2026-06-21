/**
 * Rule: no-incomplete-error-handling
 *
 * Detects catch blocks that log an error but don't rethrow or return,
 * which swallows the error silently. This is a common LLM mistake.
 *
 * Bad:
 *   catch (error) { console.error(error); }  // swallowed!
 *
 * Good:
 *   catch (error) { console.error(error); throw error; }
 *   catch (error) { console.error(error); return null; }
 *   catch (error) { throw new AppError('context', { cause: error }); }
 */

import type { Rule } from 'eslint';
import type { CallExpression, CatchClause, Statement } from 'estree';

const LOG_METHODS = new Set(['log', 'error', 'warn', 'info', 'debug', 'trace']);

const LOG_OBJECTS = new Set(['console', 'logger', 'log']);

/**
 * Checks if a call expression is a logging call (console.log, logger.error, etc.)
 * @param node
 */
function isLoggingCall(node: CallExpression): boolean {
  const { callee } = node;

  // console.error(...), logger.error(...), etc.
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    const object = callee.object.name.toLowerCase();
    const method = callee.property.name.toLowerCase();
    return LOG_OBJECTS.has(object) && LOG_METHODS.has(method);
  }

  return false;
}

/**
 * Check if a single statement terminates control flow.
 */
function isTerminatingBranch(statement: Statement): boolean {
  if (statement.type === 'ThrowStatement' || statement.type === 'ReturnStatement') {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return hasTerminatingStatement(statement.body);
  }
  return false;
}

/**
 * Check if an if statement terminates (both branches must terminate).
 */
function ifStatementTerminates(statement: Statement & { type: 'IfStatement' }): boolean {
  const isConsequentTerminates = isTerminatingBranch(statement.consequent);
  const isAlternateTerminates = statement.alternate ? isTerminatingBranch(statement.alternate) : false;
  return isConsequentTerminates && isAlternateTerminates;
}

/**
 * Checks if statements include a throw or return (error is properly handled)
 * @param statements
 */
function hasTerminatingStatement(statements: Statement[]): boolean {
  for (const statement of statements) {
    if (statement.type === 'ThrowStatement' || statement.type === 'ReturnStatement') {
      return true;
    }
    if (statement.type === 'IfStatement' && ifStatementTerminates(statement)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a single statement is a logging call.
 */
function isLoggingStatement(statement: Statement): boolean {
  return (
    statement.type === 'ExpressionStatement' &&
    statement.expression.type === 'CallExpression' &&
    isLoggingCall(statement.expression)
  );
}

/**
 * Get nested statements from a statement (for recursive search).
 */
function getNestedStatements(statement: Statement): Statement[] {
  if (statement.type === 'BlockStatement') {
    return statement.body;
  }
  if (statement.type === 'IfStatement') {
    const nested = [statement.consequent];
    if (statement.alternate) nested.push(statement.alternate);
    return nested;
  }
  return [];
}

/**
 * Recursively checks if statements include a logging call (searches nested blocks)
 * @param statements
 */
function containsLoggingCall(statements: Statement[]): boolean {
  for (const statement of statements) {
    if (isLoggingStatement(statement)) return true;

    const nested = getNestedStatements(statement);
    if (nested.length > 0 && containsLoggingCall(nested)) return true;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow catch blocks that log but do not rethrow or return',
      recommended: true,
    },
    messages: {
      incompleteErrorHandling:
        'Catch block logs error but does not rethrow or return. This swallows the error silently.',
    },
    schema: [],
  },

  create(context) {
    return {
      CatchClause(node: CatchClause) {
        const { body } = node;
        if (body.type !== 'BlockStatement') return;

        const statements = body.body;

        // Only flag if there's a logging call but no terminating statement
        if (containsLoggingCall(statements) && !hasTerminatingStatement(statements)) {
          context.report({
            node,
            messageId: 'incompleteErrorHandling',
          });
        }
      },
    };
  },
};

export default rule;
