/**
 * Rule: no-accumulating-spread
 *
 * Detects spread operator on accumulators in reduce callbacks, which causes
 * O(n²) time complexity. This is a common LLM performance mistake.
 *
 * Bad (O(n²)):
 *   items.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})
 *   items.reduce((acc, item) => [...acc, item.name], [])
 *
 * Good (O(n)):
 *   items.reduce((acc, item) => { acc[item.id] = item; return acc; }, {})
 *   items.reduce((acc, item) => { acc.push(item.name); return acc; }, [])
 *
 * Or better - avoid reduce entirely:
 *   Object.fromEntries(items.map(item => [item.id, item]))
 *   items.map(item => item.name)
 */

import type { Rule } from 'eslint';
import type {
  ArrowFunctionExpression,
  CallExpression,
  FunctionExpression,
  Node,
  SpreadElement,
} from 'estree';

/**
 * Check if a node is a call to .reduce()
 */
function isReduceCall(node: CallExpression): boolean {
  const { callee } = node;
  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'reduce'
  );
}

/**
 * Get the accumulator parameter name from a reduce callback
 */
function getAccumulatorName(
  callback: ArrowFunctionExpression | FunctionExpression,
): string | undefined {
  const firstParameter = callback.params[0];
  if (firstParameter?.type === 'Identifier') {
    return firstParameter.name;
  }
  return undefined;
}

/**
 * Check if a spread element spreads the accumulator
 */
function spreadsAccumulator(spread: SpreadElement, accName: string): boolean {
  return spread.argument.type === 'Identifier' && spread.argument.name === accName;
}

/**
 * Check object expression properties for accumulator spread.
 */
function findSpreadInObject(
  node: Node & { type: 'ObjectExpression' },
  accName: string,
): SpreadElement | undefined {
  for (const property of node.properties) {
    if (property.type === 'SpreadElement' && spreadsAccumulator(property, accName)) {
      return property;
    }
  }
  return undefined;
}

/**
 * Check array expression elements for accumulator spread.
 */
function findSpreadInArray(
  node: Node & { type: 'ArrayExpression' },
  accName: string,
): SpreadElement | undefined {
  for (const element of node.elements) {
    if (element?.type === 'SpreadElement' && spreadsAccumulator(element, accName)) {
      return element;
    }
  }
  return undefined;
}

/**
 * Recursively check if an expression contains a spread of the accumulator
 */
function containsAccumulatorSpread(node: Node, accName: string): SpreadElement | undefined {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- Only specific node types can contain spreads; all others return undefined via default
  switch (node.type) {
    case 'SpreadElement': {
      return spreadsAccumulator(node, accName) ? node : undefined;
    }

    case 'ObjectExpression': {
      return findSpreadInObject(node, accName);
    }

    case 'ArrayExpression': {
      return findSpreadInArray(node, accName);
    }

    case 'ConditionalExpression': {
      return (
        containsAccumulatorSpread(node.consequent, accName) ??
        containsAccumulatorSpread(node.alternate, accName)
      );
    }

    case 'LogicalExpression': {
      return (
        containsAccumulatorSpread(node.left, accName) ??
        containsAccumulatorSpread(node.right, accName)
      );
    }

    default: {
      return undefined;
    }
  }
}

/**
 * Check arrow function body for accumulator spread
 */
function checkArrowBody(
  body: ArrowFunctionExpression['body'],
  accName: string,
): SpreadElement | undefined {
  // Direct return: (acc, item) => ({ ...acc, ... })
  if (body.type === 'ObjectExpression' || body.type === 'ArrayExpression') {
    return containsAccumulatorSpread(body, accName);
  }

  // Parenthesized or conditional
  if (body.type === 'ConditionalExpression' || body.type === 'LogicalExpression') {
    return containsAccumulatorSpread(body, accName);
  }

  // Block body - check return statements
  if (body.type === 'BlockStatement') {
    for (const statement of body.body) {
      if (!(statement.type === 'ReturnStatement' && statement.argument)) {
      	continue;
      }

      const found = containsAccumulatorSpread(statement.argument, accName);
      if (found) return found;
    }
  }

  return undefined;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow spreading accumulator in reduce (causes O(n²) complexity)',
      recommended: true,
    },
    messages: {
      accumulatingSpread:
        'Spreading accumulator in reduce() causes O(n²) complexity. ' +
        'Mutate the accumulator instead, or use map/filter/Object.fromEntries.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node: CallExpression) {
        if (!isReduceCall(node)) return;

        const callback = node.arguments[0];
        if (
          !callback ||
          (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')
        ) {
          return;
        }

        const accName = getAccumulatorName(callback);
        if (!accName) return;

        const spreadNode = checkArrowBody(callback.body, accName);
        if (spreadNode) {
          context.report({
            node: spreadNode,
            messageId: 'accumulatingSpread',
          });
        }
      },
    };
  },
};

export default rule;
