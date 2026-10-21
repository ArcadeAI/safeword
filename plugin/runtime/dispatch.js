var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ (x =>
  typeof require !== 'undefined'
    ? require
    : typeof Proxy !== 'undefined'
      ? new Proxy(x, {
          get: (a, b) => (typeof require !== 'undefined' ? require : a)[b],
        })
      : x)(function (x) {
  if (typeof require !== 'undefined') return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) =>
  function __require2() {
    try {
      return (
        mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
        mod.exports
      );
    } catch (e) {
      throw ((mod = 0), e);
    }
  };
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod,
  )
);

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js'(exports) {
    'use strict';
    var ALIAS = /* @__PURE__ */ Symbol.for('yaml.alias');
    var DOC = /* @__PURE__ */ Symbol.for('yaml.document');
    var MAP = /* @__PURE__ */ Symbol.for('yaml.map');
    var PAIR = /* @__PURE__ */ Symbol.for('yaml.pair');
    var SCALAR = /* @__PURE__ */ Symbol.for('yaml.scalar');
    var SEQ = /* @__PURE__ */ Symbol.for('yaml.seq');
    var NODE_TYPE = /* @__PURE__ */ Symbol.for('yaml.node.type');
    var isAlias = node => !!node && typeof node === 'object' && node[NODE_TYPE] === ALIAS;
    var isDocument = node => !!node && typeof node === 'object' && node[NODE_TYPE] === DOC;
    var isMap2 = node => !!node && typeof node === 'object' && node[NODE_TYPE] === MAP;
    var isPair = node => !!node && typeof node === 'object' && node[NODE_TYPE] === PAIR;
    var isScalar = node => !!node && typeof node === 'object' && node[NODE_TYPE] === SCALAR;
    var isSeq = node => !!node && typeof node === 'object' && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = node => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/visit.js'(exports) {
    'use strict';
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol('break visit');
    var SKIP = /* @__PURE__ */ Symbol('skip children');
    var REMOVE = /* @__PURE__ */ Symbol('remove node');
    function visit3(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE) node.contents = null;
      } else visit_(null, node, visitor_, Object.freeze([]));
    }
    visit3.BREAK = BREAK;
    visit3.SKIP = SKIP;
    visit3.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === 'number') i = ci - 1;
            else if (ci === BREAK) return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_('key', node.key, visitor, path);
          if (ck === BREAK) return BREAK;
          else if (ck === REMOVE) node.key = null;
          const cv = visit_('value', node.value, visitor, path);
          if (cv === BREAK) return BREAK;
          else if (cv === REMOVE) node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE) node.contents = null;
      } else await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === 'number') i = ci - 1;
            else if (ci === BREAK) return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_('key', node.key, visitor, path);
          if (ck === BREAK) return BREAK;
          else if (ck === REMOVE) node.key = null;
          const cv = await visitAsync_('value', node.value, visitor, path);
          if (cv === BREAK) return BREAK;
          else if (cv === REMOVE) node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === 'object' && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign(
          {
            Alias: visitor.Node,
            Map: visitor.Node,
            Scalar: visitor.Node,
            Seq: visitor.Node,
          },
          visitor.Value && {
            Map: visitor.Value,
            Scalar: visitor.Value,
            Seq: visitor.Value,
          },
          visitor.Collection && {
            Map: visitor.Collection,
            Seq: visitor.Collection,
          },
          visitor,
        );
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === 'function') return visitor(key, node, path);
      if (identity.isMap(node)) return visitor.Map?.(key, node, path);
      if (identity.isSeq(node)) return visitor.Seq?.(key, node, path);
      if (identity.isPair(node)) return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node)) return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node)) return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === 'key') parent.key = node;
        else parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? 'alias' : 'scalar';
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit3;
    exports.visitAsync = visitAsync;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js'(exports) {
    'use strict';
    var identity = require_identity();
    var visit3 = require_visit();
    var escapeChars = {
      '!': '%21',
      ',': '%2C',
      '[': '%5B',
      ']': '%5D',
      '{': '%7B',
      '}': '%7D',
    };
    var escapeTagName = tn => tn.replace(/[!,[\]{}]/g, ch => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case '1.1':
            this.atNextDocument = true;
            break;
          case '1.2':
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: '1.2',
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: '1.1' };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case '%TAG': {
            if (parts.length !== 2) {
              onError(0, '%TAG directive should contain exactly two parts');
              if (parts.length < 2) return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case '%YAML': {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, '%YAML directive should contain exactly one part');
              return false;
            }
            const [version] = parts;
            if (version === '1.1' || version === '1.2') {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === '!') return '!';
        if (source[0] !== '!') {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === '<') {
          const verbatim = source.slice(2, -1);
          if (verbatim === '!' || verbatim === '!!') {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== '>') onError('Verbatim tags must end with a >');
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix) onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === '!') return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === '!' ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || '1.2'}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit3.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag) tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === '!!' && prefix === 'tag:yaml.org,2002:') continue;
          if (!doc || tagNames.some(tn => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join('\n');
      }
    };
    Directives.defaultYaml = { explicit: false, version: '1.2' };
    Directives.defaultTags = { '!!': 'tag:yaml.org,2002:' };
    exports.Directives = Directives;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js'(exports) {
    'use strict';
    var identity = require_identity();
    var visit3 = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit3.visit(root, {
        Value(_key, node) {
          if (node.anchor) anchors.add(node.anchor);
        },
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name)) return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: source => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (
              typeof ref === 'object' &&
              ref.anchor &&
              (identity.isScalar(ref.node) || identity.isCollection(ref.node))
            ) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error('Failed to resolve repeated object (this should not happen)');
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects,
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js'(exports) {
    'use strict';
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0) delete val[i];
            else if (v1 !== v0) val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0) val.delete(k);
            else if (v1 !== v0) val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0) val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0) delete val[k];
            else if (v1 !== v0) val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js'(exports) {
    'use strict';
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === 'function') {
        if (!ctx || !identity.hasAnchor(value)) return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = res2 => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate) ctx.onCreate(res);
        return res;
      }
      if (typeof value === 'bigint' && !ctx?.keep) return Number(value);
      return value;
    }
    exports.toJS = toJS;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js'(exports) {
    'use strict';
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(
          Object.getPrototypeOf(this),
          Object.getOwnPropertyDescriptors(this),
        );
        if (this.range) copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc)) throw new TypeError('A document argument is required');
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100,
        };
        const res = toJS.toJS(this, '', ctx);
        if (typeof onAnchor === 'function')
          for (const { count, res: res2 } of ctx.anchors.values()) onAnchor(res2, count);
        return typeof reviver === 'function'
          ? applyReviver.applyReviver(reviver, { '': res }, '', res)
          : res;
      }
    };
    exports.NodeBase = NodeBase;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js'(exports) {
    'use strict';
    var anchors = require_anchors();
    var visit3 = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, 'tag', {
          set() {
            throw new Error('Alias nodes cannot have tags');
          },
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0) throw new ReferenceError('Alias resolution is disabled');
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit3.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node)) nodes.push(node);
            },
          });
          if (ctx) ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this) break;
          if (node.anchor === this.source) found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx) return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = 'This should not happen: Alias anchor was not resolved?';
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = 'Excessive alias count indicates a resource exhaustion attack';
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey) return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count) count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js'(exports) {
    'use strict';
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = value =>
      !value || (typeof value !== 'function' && typeof value !== 'object');
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = 'BLOCK_FOLDED';
    Scalar.BLOCK_LITERAL = 'BLOCK_LITERAL';
    Scalar.PLAIN = 'PLAIN';
    Scalar.QUOTE_DOUBLE = 'QUOTE_DOUBLE';
    Scalar.QUOTE_SINGLE = 'QUOTE_SINGLE';
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js'(exports) {
    'use strict';
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = 'tag:yaml.org,2002:';
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter(t => t.tag === tagName);
        const tagObj = match.find(t => !t.format) ?? match[0];
        if (!tagObj) throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find(t => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value)) value = value.contents;
      if (identity.isNode(value)) return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (
        value instanceof String ||
        value instanceof Number ||
        value instanceof Boolean ||
        (typeof BigInt !== 'undefined' && value instanceof BigInt)
      ) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === 'object') {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith('!!')) tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === 'function') {
          value = value.toJSON();
        }
        if (!value || typeof value !== 'object') {
          const node2 = new Scalar.Scalar(value);
          if (ref) ref.node = node2;
          return node2;
        }
        tagObj =
          value instanceof Map
            ? schema[identity.MAP]
            : Symbol.iterator in Object(value)
              ? schema[identity.SEQ]
              : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode
        ? tagObj.createNode(ctx.schema, value, ctx)
        : typeof tagObj?.nodeClass?.from === 'function'
          ? tagObj.nodeClass.from(ctx.schema, value, ctx)
          : new Scalar.Scalar(value);
      if (tagName) node.tag = tagName;
      else if (!tagObj.default) node.tag = tagObj.tag;
      if (ref) ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js'(exports) {
    'use strict';
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === 'number' && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error('This should not happen, please report a bug.');
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map(),
      });
    }
    var isEmptyPath = path =>
      path == null || (typeof path === 'object' && !!path[Symbol.iterator]().next().done);
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, 'schema', {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true,
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(
          Object.getPrototypeOf(this),
          Object.getOwnPropertyDescriptors(this),
        );
        if (schema) copy.schema = schema;
        copy.items = copy.items.map(it =>
          identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it,
        );
        if (this.range) copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path)) this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node)) node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0) return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node)) return node.deleteIn(rest);
        else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0) return !keepScalar && identity.isScalar(node) ? node.value : node;
        else return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every(node => {
          if (!identity.isPair(node)) return false;
          const n = node.value;
          return (
            n == null ||
            (allowScalar &&
              identity.isScalar(n) &&
              n.value == null &&
              !n.commentBefore &&
              !n.comment &&
              !n.tag)
          );
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0) return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node)) node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js'(
    exports,
  ) {
    'use strict';
    var stringifyComment = str => str.replace(/^(?!$)(?: $)?/gm, '#');
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment)) return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) =>
      str.endsWith('\n')
        ? indentComment(comment, indent)
        : comment.includes('\n')
          ? '\n' + indentComment(comment, indent)
          : (str.endsWith(' ') ? '' : ' ') + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js'(
    exports,
  ) {
    'use strict';
    var FOLD_FLOW = 'flow';
    var FOLD_BLOCK = 'block';
    var FOLD_QUOTED = 'quoted';
    function foldFlowLines(
      text,
      indent,
      mode = 'flow',
      { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {},
    ) {
      if (!lineWidth || lineWidth < 0) return text;
      if (lineWidth < minContentWidth) minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep) return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === 'number') {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
        else end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1) end = i + endStep;
      }
      for (let ch; (ch = text[(i += 1)]);) {
        if (mode === FOLD_QUOTED && ch === '\\') {
          escStart = i;
          switch (text[i + 1]) {
            case 'x':
              i += 3;
              break;
            case 'u':
              i += 5;
              break;
            case 'U':
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === '\n') {
          if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === ' ' && prev && prev !== ' ' && prev !== '\n' && prev !== '	') {
            const next = text[i + 1];
            if (next && next !== ' ' && next !== '\n' && next !== '	') split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === ' ' || prev === '	') {
                prev = ch;
                ch = text[(i += 1)];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j]) return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow) onOverflow();
      if (folds.length === 0) return text;
      if (onFold) onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === ' ' || ch === '	') {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== '\n');
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js'(
    exports,
  ) {
    'use strict';
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth,
    });
    var containsDocumentMarker = str => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0) return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit) return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === '\n') {
          if (i - start > limit) return true;
          start = i + 1;
          if (strLen - start <= limit) return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON) return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
      let str = '';
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
          str += json.slice(start, i) + '\\ ';
          i += 1;
          start = i;
          ch = '\\';
        }
        if (ch === '\\')
          switch (json[i + 1]) {
            case 'u':
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case '0000':
                    str += '\\0';
                    break;
                  case '0007':
                    str += '\\a';
                    break;
                  case '000b':
                    str += '\\v';
                    break;
                  case '001b':
                    str += '\\e';
                    break;
                  case '0085':
                    str += '\\N';
                    break;
                  case '00a0':
                    str += '\\_';
                    break;
                  case '2028':
                    str += '\\L';
                    break;
                  case '2029':
                    str += '\\P';
                    break;
                  default:
                    if (code.substr(0, 2) === '00') str += '\\x' + code.substr(2);
                    else str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case 'n':
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + '\n\n';
                while (json[i + 2] === '\\' && json[i + 3] === 'n' && json[i + 4] !== '"') {
                  str += '\n';
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === ' ') str += '\\';
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(
            str,
            indent,
            foldFlowLines.FOLD_QUOTED,
            getFoldOptions(ctx, false),
          );
    }
    function singleQuotedString(value, ctx) {
      if (
        ctx.options.singleQuote === false ||
        (ctx.implicitKey && value.includes('\n')) ||
        /[ \t]\n|\n[ \t]/.test(value)
      )
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
      const res =
        "'" +
        value.replace(/'/g, "''").replace(
          /\n+/g,
          `$&
${indent}`,
        ) +
        "'";
      return ctx.implicitKey
        ? res
        : foldFlowLines.foldFlowLines(
            res,
            indent,
            foldFlowLines.FOLD_FLOW,
            getFoldOptions(ctx, false),
          );
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false) qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle) qs = singleQuotedString;
        else if (hasSingle && !hasDouble) qs = doubleQuotedString;
        else qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp('(^|(?<!\n))\n+(?!\n|$)', 'g');
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent =
        ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? '  ' : '');
      const literal =
        blockQuote === 'literal'
          ? true
          : blockQuote === 'folded' || type === Scalar.Scalar.BLOCK_FOLDED
            ? false
            : type === Scalar.Scalar.BLOCK_LITERAL
              ? true
              : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value) return literal ? '|\n' : '>\n';
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== '\n' && ch !== '	' && ch !== ' ') break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf('\n');
      if (endNlPos === -1) {
        chomp = '-';
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = '+';
        if (onChompKeep) onChompKeep();
      } else {
        chomp = '';
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === '\n') end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === ' ') startWithSpace = true;
        else if (ch === '\n') startNlPos = startEnd;
        else break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? '2' : '1';
      let header = (startWithSpace ? indentSize : '') + chomp;
      if (comment) {
        header += ' ' + commentString(comment.replace(/ ?[\r\n]+/g, ' '));
        if (onComment) onComment();
      }
      if (!literal) {
        const foldedValue = value
          .replace(/\n+/g, '\n$&')
          .replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2')
          .replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== 'folded' && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(
          `${start}${foldedValue}${end}`,
          indent,
          foldFlowLines.FOLD_BLOCK,
          foldOptions,
        );
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if ((implicitKey && value.includes('\n')) || (inFlow && /[[\]{},]/.test(value))) {
        return quotedString(value, ctx);
      }
      if (
        /^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(
          value,
        )
      ) {
        return implicitKey || inFlow || !value.includes('\n')
          ? quotedString(value, ctx)
          : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes('\n')) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === '') {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(
        /\n+/g,
        `$&
${indent}`,
      );
      if (actualString) {
        const test = tag =>
          tag.default && tag.tag !== 'tag:yaml.org,2002:str' && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
      }
      return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(
            str,
            indent,
            foldFlowLines.FOLD_FLOW,
            getFoldOptions(ctx, false),
          );
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss =
        typeof item.value === 'string'
          ? item
          : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = _type => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow
              ? quotedString(ss.value, ctx)
              : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = (implicitKey && defaultKeyType) || defaultStringType;
        res = _stringify(t);
        if (res === null) throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js'(exports) {
    'use strict';
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign(
        {
          blockQuote: true,
          commentString: stringifyComment.stringifyComment,
          defaultKeyType: null,
          defaultStringType: 'PLAIN',
          directives: null,
          doubleQuotedAsJSON: false,
          doubleQuotedMinMultiLineLength: 40,
          falseStr: 'false',
          flowCollectionPadding: true,
          indentSeq: true,
          lineWidth: 80,
          minContentWidth: 20,
          nullStr: 'null',
          simpleKeys: false,
          singleQuote: null,
          trailingComma: false,
          trueStr: 'true',
          verifyAliasOrder: true,
        },
        doc.schema.toStringOptions,
        options,
      );
      let inFlow;
      switch (opt.collectionStyle) {
        case 'block':
          inFlow = false;
          break;
        case 'flow':
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? ' ' : '',
        indent: '',
        indentStep: typeof opt.indent === 'number' ? ' '.repeat(opt.indent) : '  ',
        inFlow,
        options: opt,
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter(t => t.tag === item.tag);
        if (match.length > 0) return match.find(t => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter(t => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter(t => t.test);
          if (testMatch.length > 0) match = testMatch;
        }
        tagObj = match.find(t => t.format === item.format) ?? match.find(t => !t.format);
      } else {
        obj = item;
        tagObj = tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? 'null' : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives) return '';
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag) props.push(doc.directives.tagString(tag));
      return props.join(' ');
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item)) return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives) return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
          else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item)
        ? item
        : ctx.doc.createNode(item, { onTagObj: o => (tagObj = o) });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str =
        typeof tagObj.stringify === 'function'
          ? tagObj.stringify(node, ctx, onComment, onChompKeep)
          : identity.isScalar(node)
            ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep)
            : node.toString(ctx, onComment, onChompKeep);
      if (!props) return str;
      return identity.isScalar(node) || str[0] === '{' || str[0] === '['
        ? `${props} ${str}`
        : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const {
        allNullValues,
        doc,
        indent,
        indentStep,
        options: { commentString, indentSeq, simpleKeys },
      } = ctx;
      let keyComment = (identity.isNode(key) && key.comment) || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error('With simple keys, key nodes cannot have comments');
        }
        if (identity.isCollection(key) || (!identity.isNode(key) && typeof key === 'object')) {
          const msg = 'With simple keys, collection cannot be used as a key value';
          throw new Error(msg);
        }
      }
      let explicitKey =
        !simpleKeys &&
        (!key ||
          (keyComment && value == null && !ctx.inFlow) ||
          identity.isCollection(key) ||
          (identity.isScalar(key)
            ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL
            : typeof key === 'object'));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep,
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(
        key,
        ctx,
        () => (keyCommentDone = true),
        () => (chompKeep = true),
      );
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error(
            'With simple keys, single line scalar must not span more than 1024 characters',
          );
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment) onComment();
          return str === '' ? '?' : explicitKey ? `? ${str}` : str;
        }
      } else if ((allNullValues && !simpleKeys) || (value == null && explicitKey)) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep) onChompKeep();
        return str;
      }
      if (keyCommentDone) keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === 'object') value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (
        !indentSeq &&
        indentStep.length >= 2 &&
        !ctx.inFlow &&
        !explicitKey &&
        identity.isSeq(value) &&
        !value.flow &&
        !value.tag &&
        !value.anchor
      ) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(
        value,
        ctx,
        () => (valueCommentDone = true),
        () => (chompKeep = true),
      );
      let ws = ' ';
      if (keyComment || vsb || vcb) {
        ws = vsb ? '\n' : '';
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === '' && !ctx.inFlow) {
          if (ws === '\n' && valueComment) ws = '\n\n';
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf('\n');
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === '&' || vs0 === '!')) {
            let sp0 = valueStr.indexOf(' ');
            if (vs0 === '&' && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === '!') {
              sp0 = valueStr.indexOf(' ', sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === '' || valueStr[0] === '\n') {
        ws = '';
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment) onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/log.js'(exports) {
    'use strict';
    var node_process = __require('process');
    function debug(logLevel, ...messages) {
      if (logLevel === 'debug') console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === 'debug' || logLevel === 'warn') {
        if (typeof node_process.emitWarning === 'function') node_process.emitWarning(warning);
        else console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js'(exports) {
    'use strict';
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = '<<';
    var merge = {
      identify: value =>
        value === MERGE_KEY || (typeof value === 'symbol' && value.description === MERGE_KEY),
      default: 'key',
      tag: 'tag:yaml.org,2002:merge',
      test: /^<<$/,
      resolve: () =>
        Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
          addToJSMap: addMergeToJSMap,
        }),
      stringify: () => MERGE_KEY,
    };
    var isMergeKey = (ctx, key) =>
      (merge.identify(key) ||
        (identity.isScalar(key) &&
          (!key.type || key.type === Scalar.Scalar.PLAIN) &&
          merge.identify(key.value))) &&
      ctx?.doc.schema.tags.some(tag => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
      else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
      else mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source)) throw new Error('Merge sources must be maps or map aliases');
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key)) map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js'(exports) {
    'use strict';
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key)) merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, '', ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          else map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null) return '';
      if (typeof jsKey !== 'object') return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(
            ctx.doc.options.logLevel,
            `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`,
          );
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js'(exports) {
    'use strict';
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key)) key = key.clone(schema);
        if (identity.isNode(value)) value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc
          ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep)
          : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection(
      { comment, items },
      ctx,
      { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment },
    ) {
      const {
        indent,
        options: { commentString },
      } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore) lines.push('');
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment) comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore) lines.push('');
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(
          item,
          itemCtx,
          () => (comment2 = null),
          () => (chompKeep = true),
        );
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2) chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line
            ? `
${indent}${line}`
            : '\n';
        }
      }
      if (comment) {
        str += '\n' + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment) onComment();
      } else if (chompKeep && onChompKeep) onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const {
        indent,
        indentStep,
        flowCollectionPadding: fcPadding,
        options: { commentString },
      } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null,
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore) lines.push('');
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment) comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore) lines.push('');
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment) reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment) comment = iv.comment;
            if (iv.commentBefore) reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment) reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => (comment = null));
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes('\n'));
        if (i < items.length - 1) {
          str += ',';
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline ||
              (reqNewline =
                lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) >
                ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ',';
          }
        }
        if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line
              ? `
${indentStep}${indent}${line}`
              : '\n';
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(' ')}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep) comment = comment.replace(/^\n+/, '');
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js'(exports) {
    'use strict';
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k) return it;
          if (identity.isScalar(it.key) && it.key.value === k) return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return 'tag:yaml.org,2002:map';
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === 'function') value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key)) return;
          if (value !== void 0 || keepUndefined) map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj) add(key, value);
        } else if (obj && typeof obj === 'object') {
          for (const key of Object.keys(obj)) add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === 'function') {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair)) _pair = pair;
        else if (!pair || typeof pair !== 'object' || !('key' in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex(item => sortEntries(_pair, item) < 0);
          if (i === -1) this.items.push(_pair);
          else this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it) return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate) ctx.onCreate(map);
        for (const item of this.items) addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx) return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: '',
          flowChars: { start: '{', end: '}' },
          itemIndent: ctx.indent || '',
          onChompKeep,
          onComment,
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js'(exports) {
    'use strict';
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: 'map',
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: 'tag:yaml.org,2002:map',
      resolve(map2, onError) {
        if (!identity.isMap(map2)) onError('Expected a mapping for this tag');
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx),
    };
    exports.map = map;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js'(exports) {
    'use strict';
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return 'tag:yaml.org,2002:seq';
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number') return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number') return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === 'number' && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number') throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value)) prev.value = value;
        else this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate) ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items) seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx) return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: '- ',
          flowChars: { start: '[', end: ']' },
          itemIndent: (ctx.indent || '') + '  ',
          onChompKeep,
          onComment,
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === 'function') {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === 'string') idx = Number(idx);
      return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js'(exports) {
    'use strict';
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: 'seq',
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: 'tag:yaml.org,2002:seq',
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2)) onError('Expected a sequence for this tag');
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx),
    };
    exports.seq = seq;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js'(exports) {
    'use strict';
    var stringifyString = require_stringifyString();
    var string = {
      identify: value => typeof value === 'string',
      default: true,
      tag: 'tag:yaml.org,2002:str',
      resolve: str => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      },
    };
    exports.string = string;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    var nullTag = {
      identify: value => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: 'tag:yaml.org,2002:null',
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) =>
        typeof source === 'string' && nullTag.test.test(source) ? source : ctx.options.nullStr,
    };
    exports.nullTag = nullTag;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    var boolTag = {
      identify: value => typeof value === 'boolean',
      default: true,
      tag: 'tag:yaml.org,2002:bool',
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: str => new Scalar.Scalar(str[0] === 't' || str[0] === 'T'),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === 't' || source[0] === 'T';
          if (value === sv) return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      },
    };
    exports.boolTag = boolTag;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js'(
    exports,
  ) {
    'use strict';
    function stringifyNumber({ format: format2, minFractionDigits, tag, value }) {
      if (typeof value === 'bigint') return String(value);
      const num = typeof value === 'number' ? value : Number(value);
      if (!isFinite(num)) return isNaN(num) ? '.nan' : num < 0 ? '-.inf' : '.inf';
      let n = Object.is(value, -0) ? '-0' : JSON.stringify(value);
      if (
        !format2 &&
        minFractionDigits &&
        (!tag || tag === 'tag:yaml.org,2002:float') &&
        /^-?\d/.test(n) &&
        !n.includes('e')
      ) {
        let i = n.indexOf('.');
        if (i < 0) {
          i = n.length;
          n += '.';
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0) n += '0';
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: str =>
        str.slice(-3).toLowerCase() === 'nan'
          ? NaN
          : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber,
    };
    var floatExp = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      format: 'EXP',
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: str => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      },
    };
    var float = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf('.');
        if (dot !== -1 && str[str.length - 1] === '0')
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber,
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js'(exports) {
    'use strict';
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = value => typeof value === 'bigint' || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) =>
      intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0) return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: value => intIdentify(value) && value >= 0,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'OCT',
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: node => intStringify(node, 8, '0o'),
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber,
    };
    var intHex = {
      identify: value => intIdentify(value) && value >= 0,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'HEX',
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: node => intStringify(node, 16, '0x'),
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js'(exports) {
    'use strict';
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
    ];
    exports.schema = schema;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === 'bigint' || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: value => typeof value === 'string',
        default: true,
        tag: 'tag:yaml.org,2002:str',
        resolve: str => str,
        stringify: stringifyJSON,
      },
      {
        identify: value => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: 'tag:yaml.org,2002:null',
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON,
      },
      {
        identify: value => typeof value === 'boolean',
        default: true,
        tag: 'tag:yaml.org,2002:bool',
        test: /^true$|^false$/,
        resolve: str => str === 'true',
        stringify: stringifyJSON,
      },
      {
        identify: intIdentify,
        default: true,
        tag: 'tag:yaml.org,2002:int',
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) =>
          intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => (intIdentify(value) ? value.toString() : JSON.stringify(value)),
      },
      {
        identify: value => typeof value === 'number',
        default: true,
        tag: 'tag:yaml.org,2002:float',
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: str => parseFloat(str),
        stringify: stringifyJSON,
      },
    ];
    var jsonError = {
      default: true,
      tag: '',
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      },
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js'(
    exports,
  ) {
    'use strict';
    var node_buffer = __require('buffer');
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: value => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: 'tag:yaml.org,2002:binary',
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === 'function') {
          return node_buffer.Buffer.from(src, 'base64');
        } else if (typeof atob === 'function') {
          const str = atob(src.replace(/[\n\r]/g, ''));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError(
            'This environment does not support reading binary tags; either Buffer or atob is required',
          );
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value) return '';
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === 'function') {
          str =
            buf instanceof node_buffer.Buffer
              ? buf.toString('base64')
              : node_buffer.Buffer.from(buf.buffer).toString('base64');
        } else if (typeof btoa === 'function') {
          let s = '';
          for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error(
            'This environment does not support writing binary tags; either Buffer or btoa is required',
          );
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(
            ctx.options.lineWidth - ctx.indent.length,
            ctx.options.minContentWidth,
          );
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? '\n' : ' ');
        }
        return stringifyString.stringifyString(
          { comment, type, value: str },
          ctx,
          onComment,
          onChompKeep,
        );
      },
    };
    exports.binary = binary;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js'(exports) {
    'use strict';
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item)) continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1) onError('Each pair must have its own sequence indicator');
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore
                ? `${item.commentBefore}
${pair.key.commentBefore}`
                : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment
                ? `${item.comment}
${cn.comment}`
                : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else onError('Expected a sequence for this tag');
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = 'tag:yaml.org,2002:pairs';
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === 'function') it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: 'seq',
      default: false,
      tag: 'tag:yaml.org,2002:pairs',
      resolve: resolvePairs,
      createNode: createPairs,
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js'(exports) {
    'use strict';
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx) return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate) ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, '', ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, '', ctx);
          }
          if (map.has(key)) throw new Error('Ordered maps must not include duplicate keys');
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = 'tag:yaml.org,2002:omap';
    var omap = {
      collection: 'seq',
      identify: value => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: 'tag:yaml.org,2002:omap',
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx),
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source)) return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: value => value === true,
      default: true,
      tag: 'tag:yaml.org,2002:bool',
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify,
    };
    var falseTag = {
      identify: value => value === false,
      default: true,
      tag: 'tag:yaml.org,2002:bool',
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify,
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js'(exports) {
    'use strict';
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: str =>
        str.slice(-3).toLowerCase() === 'nan'
          ? NaN
          : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber,
    };
    var floatExp = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      format: 'EXP',
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: str => parseFloat(str.replace(/_/g, '')),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      },
    };
    var float = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, '')));
        const dot = str.indexOf('.');
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, '');
          if (f[f.length - 1] === '0') node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber,
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js'(exports) {
    'use strict';
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = value => typeof value === 'bigint' || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === '-' || sign === '+') offset += 1;
      str = str.substring(offset).replace(/_/g, '');
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === '-' ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === '-' ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? '-' + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'BIN',
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: node => intStringify(node, 2, '0b'),
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'OCT',
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: node => intStringify(node, 8, '0'),
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber,
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'HEX',
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: node => intStringify(node, 16, '0x'),
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js'(exports) {
    'use strict';
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key)) pair = key;
        else if (
          key &&
          typeof key === 'object' &&
          'key' in key &&
          'value' in key &&
          key.value === null
        )
          pair = new Pair.Pair(key.key, null);
        else pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev) this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair)
          ? identity.isScalar(pair.key)
            ? pair.key.value
            : pair.key
          : pair;
      }
      set(key, value) {
        if (typeof value !== 'boolean')
          throw new Error(
            `Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`,
          );
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx) return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(
            Object.assign({}, ctx, { allNullValues: true }),
            onComment,
            onChompKeep,
          );
        else throw new Error('Set items must all have null values');
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === 'function') value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = 'tag:yaml.org,2002:set';
    var set = {
      collection: 'map',
      identify: value => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: 'tag:yaml.org,2002:set',
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
          else onError('Set items must all have null values');
        } else onError('Expected a mapping for this tag');
        return map;
      },
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js'(
    exports,
  ) {
    'use strict';
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === '-' || sign === '+' ? str.substring(1) : str;
      const num = n => (asBigInt ? BigInt(n) : Number(n));
      const res = parts
        .replace(/_/g, '')
        .split(':')
        .reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === '-' ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = n => n;
      if (typeof value === 'bigint') num = n => BigInt(n);
      else if (isNaN(value) || !isFinite(value)) return stringifyNumber.stringifyNumber(node);
      let sign = '';
      if (value < 0) {
        sign = '-';
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return (
        sign +
        parts
          .map(n => String(n).padStart(2, '0'))
          .join(':')
          .replace(/000000\d*$/, '')
      );
    }
    var intTime = {
      identify: value => typeof value === 'bigint' || Number.isInteger(value),
      default: true,
      tag: 'tag:yaml.org,2002:int',
      format: 'TIME',
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal,
    };
    var floatTime = {
      identify: value => typeof value === 'number',
      default: true,
      tag: 'tag:yaml.org,2002:float',
      format: 'TIME',
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: str => parseSexagesimal(str, false),
      stringify: stringifySexagesimal,
    };
    var timestamp = {
      identify: value => value instanceof Date,
      default: true,
      tag: 'tag:yaml.org,2002:timestamp',
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp(
        '^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$',
      ),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match) throw new Error('!!timestamp expects a date, starting with yyyy-mm-dd');
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + '00').substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== 'Z') {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30) d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, '') ?? '',
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js'(
    exports,
  ) {
    'use strict';
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp,
    ];
    exports.schema = schema;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js'(exports) {
    'use strict';
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ['core', schema.schema],
      ['failsafe', [map.map, seq.seq, string.string]],
      ['json', schema$1.schema],
      ['yaml11', schema$2.schema],
      ['yaml-1.1', schema$2.schema],
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp,
    };
    var coreKnownTags = {
      'tag:yaml.org,2002:binary': binary.binary,
      'tag:yaml.org,2002:merge': merge.merge,
      'tag:yaml.org,2002:omap': omap.omap,
      'tag:yaml.org,2002:pairs': pairs.pairs,
      'tag:yaml.org,2002:set': set.set,
      'tag:yaml.org,2002:timestamp': timestamp.timestamp,
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge)
          ? schemaTags.concat(merge.merge)
          : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags)) tags = [];
        else {
          const keys = Array.from(schemas.keys())
            .filter(key => key !== 'yaml11')
            .map(key => JSON.stringify(key))
            .join(', ');
          throw new Error(
            `Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`,
          );
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags) tags = tags.concat(tag);
      } else if (typeof customTags === 'function') {
        tags = customTags(tags.slice());
      }
      if (addMergeTag) tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === 'string' ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName)
            .map(key => JSON.stringify(key))
            .join(', ');
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj)) tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js'(exports) {
    'use strict';
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    var Schema = class _Schema {
      constructor({
        compat,
        customTags,
        merge,
        resolveKnownTags,
        schema,
        sortMapEntries,
        toStringDefaults,
      }) {
        this.compat = Array.isArray(compat)
          ? tags.getTags(compat, 'compat')
          : compat
            ? tags.getTags(null, compat)
            : null;
        this.name = (typeof schema === 'string' && schema) || 'core';
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries =
          typeof sortMapEntries === 'function'
            ? sortMapEntries
            : sortMapEntries === true
              ? sortMapEntriesByKey
              : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart) hasDirectives = true;
      }
      if (hasDirectives) lines.push('---');
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1) lines.unshift('');
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ''));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives) lines.push('');
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ''));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => (chompKeep = true);
        let body = stringify.stringify(
          doc.contents,
          ctx,
          () => (contentComment = null),
          onChompKeep,
        );
        if (contentComment)
          body += stringifyComment.lineComment(body, '', commentString(contentComment));
        if ((body[0] === '|' || body[0] === '>') && lines[lines.length - 1] === '---') {
          lines[lines.length - 1] = `--- ${body}`;
        } else lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes('\n')) {
            lines.push('...');
            lines.push(stringifyComment.indentComment(cs, ''));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push('...');
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep) dc = dc.replace(/^\n+/, '');
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '') lines.push('');
          lines.push(stringifyComment.indentComment(commentString(dc), ''));
        }
      }
      return lines.join('\n') + '\n';
    }
    exports.stringifyDocument = stringifyDocument;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js'(exports) {
    'use strict';
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === 'function' || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign(
          {
            intAsBigInt: false,
            keepSourceTokens: false,
            logLevel: 'warn',
            prettyErrors: true,
            strict: true,
            stringKeys: false,
            uniqueKeys: true,
            version: '1.2',
          },
          options,
        );
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit) version = this.directives.yaml.version;
        } else this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC },
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives) copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents)
          ? this.contents.clone(copy.schema)
          : this.contents;
        if (this.range) copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents)) this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents)) this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || 'a', prev) : name; // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === 'function') {
          value = replacer.call({ '': value }, '', value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = v => typeof v === 'number' || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0) replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } =
          options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || 'a',
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects,
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node)) node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null) return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents)
            ? this.contents.value
            : this.contents;
        return identity.isCollection(this.contents)
          ? this.contents.getIn(path, keepScalar)
          : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path)) return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === 'number') version = String(version);
        let opt;
        switch (version) {
          case '1.1':
            if (this.directives) this.directives.yaml.version = '1.1';
            else this.directives = new directives.Directives({ version: '1.1' });
            opt = { resolveKnownTags: false, schema: 'yaml-1.1' };
            break;
          case '1.2':
          case 'next':
            if (this.directives) this.directives.yaml.version = version;
            else this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: 'core' };
            break;
          case null:
            if (this.directives) delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object) this.schema = options.schema;
        else if (opt) this.schema = new Schema.Schema(Object.assign(opt, options));
        else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100,
        };
        const res = toJS.toJS(this.contents, jsonArg ?? '', ctx);
        if (typeof onAnchor === 'function')
          for (const { count, res: res2 } of ctx.anchors.values()) onAnchor(res2, count);
        return typeof reviver === 'function'
          ? applyReviver.applyReviver(reviver, { '': res }, '', res)
          : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0) throw new Error('Document with errors cannot be stringified');
        if (
          'indent' in options &&
          (!Number.isInteger(options.indent) || Number(options.indent) <= 0)
        ) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents)) return true;
      throw new Error('Expected a YAML collection as document contents');
    }
    exports.Document = Document;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/errors.js'(exports) {
    'use strict';
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super('YAMLParseError', pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super('YAMLWarning', pos, code, message);
      }
    };
    var prettifyError = (src, lc) => error => {
      if (error.pos[0] === -1) return;
      error.linePos = error.pos.map(pos => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src
        .substring(lc.lineStarts[line - 1], lc.lineStarts[line])
        .replace(/[\n\r]+$/, '');
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = '\u2026' + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + '\u2026';
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80) prev = prev.substring(0, 79) + '\u2026\n';
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = ' '.repeat(ci) + '^'.repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js'(exports) {
    'use strict';
    function resolveProps(
      tokens,
      { flow, indicator, next, offset, onError, parentIndent, startOnNewline },
    ) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = '';
      let commentSep = '';
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== 'space' && token.type !== 'newline' && token.type !== 'comma')
            onError(
              token.offset,
              'MISSING_CHAR',
              'Tags and anchors must be separated from the next token by white space',
            );
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== 'comment' && token.type !== 'newline') {
            onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
          }
          tab = null;
        }
        switch (token.type) {
          case 'space':
            if (
              !flow &&
              (indicator !== 'doc-start' || next?.type !== 'flow-collection') &&
              token.source.includes('	')
            ) {
              tab = token;
            }
            hasSpace = true;
            break;
          case 'comment': {
            if (!hasSpace)
              onError(
                token,
                'MISSING_CHAR',
                'Comments must be separated from other tokens by white space characters',
              );
            const cb = token.source.substring(1) || ' ';
            if (!comment) comment = cb;
            else comment += commentSep + cb;
            commentSep = '';
            atNewline = false;
            break;
          }
          case 'newline':
            if (atNewline) {
              if (comment) comment += token.source;
              else if (!found || indicator !== 'seq-item-ind') spaceBefore = true;
            } else commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag) newlineAfterProp = token;
            hasSpace = true;
            break;
          case 'anchor':
            if (anchor) onError(token, 'MULTIPLE_ANCHORS', 'A node can have at most one anchor');
            if (token.source.endsWith(':'))
              onError(
                token.offset + token.source.length - 1,
                'BAD_ALIAS',
                'Anchor ending in : is ambiguous',
                true,
              );
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case 'tag': {
            if (tag) onError(token, 'MULTIPLE_TAGS', 'A node can have at most one tag');
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(
                token,
                'BAD_PROP_ORDER',
                `Anchors and tags must be after the ${token.source} indicator`,
              );
            if (found)
              onError(
                token,
                'UNEXPECTED_TOKEN',
                `Unexpected ${token.source} in ${flow ?? 'collection'}`,
              );
            found = token;
            atNewline = indicator === 'seq-item-ind' || indicator === 'explicit-key-ind';
            hasSpace = false;
            break;
          case 'comma':
            if (flow) {
              if (comma) onError(token, 'UNEXPECTED_TOKEN', `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (
        reqSpace &&
        next &&
        next.type !== 'space' &&
        next.type !== 'newline' &&
        next.type !== 'comma' &&
        (next.type !== 'scalar' || next.source !== '')
      ) {
        onError(
          next.offset,
          'MISSING_CHAR',
          'Tags and anchors must be separated from the next token by white space',
        );
      }
      if (
        tab &&
        ((atNewline && tab.indent <= parentIndent) ||
          next?.type === 'block-map' ||
          next?.type === 'block-seq')
      )
        onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end,
      };
    }
    exports.resolveProps = resolveProps;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js'(
    exports,
  ) {
    'use strict';
    function containsNewline(key) {
      if (!key) return null;
      switch (key.type) {
        case 'alias':
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
          if (key.source.includes('\n')) return true;
          if (key.end) {
            for (const st of key.end) if (st.type === 'newline') return true;
          }
          return false;
        case 'flow-collection':
          for (const it of key.items) {
            for (const st of it.start) if (st.type === 'newline') return true;
            if (it.sep) {
              for (const st of it.sep) if (st.type === 'newline') return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value)) return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js'(
    exports,
  ) {
    'use strict';
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === 'flow-collection') {
        const end = fc.end[0];
        if (
          end.indent === indent &&
          (end.source === ']' || end.source === '}') &&
          utilContainsNewline.containsNewline(fc)
        ) {
          const msg = 'Flow end indicator should be more indented than parent';
          onError(end, 'BAD_INDENT', msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false) return false;
      const isEqual =
        typeof uniqueKeys === 'function'
          ? uniqueKeys
          : (a, b) =>
              a === b || (identity.isScalar(a) && identity.isScalar(b) && a.value === b.value);
      return items.some(pair => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js'(
    exports,
  ) {
    'use strict';
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = 'All mapping items must start at the same column';
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot) ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: 'explicit-key-ind',
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true,
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === 'block-seq')
              onError(
                offset,
                'BLOCK_AS_IMPLICIT_KEY',
                'A block sequence may not be used as an implicit map key',
              );
            else if ('indent' in key && key.indent !== bm.indent)
              onError(offset, 'BAD_INDENT', startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment) map.comment += '\n' + keyProps.comment;
              else map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(
              key ?? start[start.length - 1],
              'MULTILINE_IMPLICIT_KEY',
              'Implicit keys need to be on a single line',
            );
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, 'BAD_INDENT', startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key
          ? composeNode(ctx, key, keyProps, onError)
          : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: 'map-value-ind',
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === 'block-scalar',
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === 'block-map' && !valueProps.hasNewline)
              onError(
                offset,
                'BLOCK_AS_IMPLICIT_KEY',
                'Nested mappings are not allowed in compact mappings',
              );
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(
                keyNode.range,
                'KEY_OVER_1024_CHARS',
                'The : indicator must be at most 1024 chars after the start of an implicit block mapping key',
              );
          }
          const valueNode = value
            ? composeNode(ctx, value, valueProps, onError)
            : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(
              keyNode.range,
              'MISSING_CHAR',
              'Implicit map keys need to be followed by map values',
            );
          if (valueProps.comment) {
            if (keyNode.comment) keyNode.comment += '\n' + valueProps.comment;
            else keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, 'IMPOSSIBLE', 'Map comment with trailing content');
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js'(
    exports,
  ) {
    'use strict';
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot) ctx.atRoot = false;
      if (ctx.atKey) ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: 'seq-item-ind',
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true,
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === 'block-seq')
              onError(props.end, 'BAD_INDENT', 'All sequence items must start at the same column');
            else onError(offset, 'MISSING_CHAR', 'Sequence item without - indicator');
          } else {
            commentEnd = props.end;
            if (props.comment) seq.comment = props.comment;
            continue;
          }
        }
        const node = value
          ? composeNode(ctx, value, props, onError)
          : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js'(exports) {
    'use strict';
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = '';
      if (end) {
        let hasSpace = false;
        let sep = '';
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case 'space':
              hasSpace = true;
              break;
            case 'comment': {
              if (reqSpace && !hasSpace)
                onError(
                  token,
                  'MISSING_CHAR',
                  'Comments must be separated from other tokens by white space characters',
                );
              const cb = source.substring(1) || ' ';
              if (!comment) comment = cb;
              else comment += sep + cb;
              sep = '';
              break;
            }
            case 'newline':
              if (comment) sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = 'Block collections are not allowed within flow collections';
    var isBlock = token => token && (token.type === 'block-map' || token.type === 'block-seq');
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === '{';
      const fcName = isMap2 ? 'flow map' : 'flow sequence';
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot) ctx.atRoot = false;
      if (ctx.atKey) ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: 'explicit-key-ind',
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false,
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, 'UNEXPECTED_TOKEN', `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment) coll.comment += '\n' + props.comment;
              else coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              'MULTILINE_IMPLICIT_KEY',
              'Implicit keys of flow sequence pairs need to be on a single line',
            );
        }
        if (i === 0) {
          if (props.comma) onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, 'MISSING_CHAR', `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = '';
            loop: for (const st of start) {
              switch (st.type) {
                case 'comma':
                case 'space':
                  break;
                case 'comment':
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev)) prev = prev.value ?? prev.key;
              if (prev.comment) prev.comment += '\n' + prevItemComment;
              else prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep && !props.found) {
          const valueNode = value
            ? composeNode(ctx, value, props, onError)
            : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value)) onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key
            ? composeNode(ctx, key, props, onError)
            : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key)) onError(keyNode.range, 'BLOCK_IN_FLOW', blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: 'map-value-ind',
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false,
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found) break;
                  if (st.type === 'newline') {
                    onError(
                      st,
                      'MULTILINE_IMPLICIT_KEY',
                      'Implicit keys of flow sequence pairs need to be on a single line',
                    );
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(
                  valueProps.found,
                  'KEY_OVER_1024_CHARS',
                  'The : indicator must be at most 1024 chars after the start of an implicit flow sequence key',
                );
            }
          } else if (value) {
            if ('source' in value && value.source?.[0] === ':')
              onError(value, 'MISSING_CHAR', `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, 'MISSING_CHAR', `Missing , or : between ${fcName} items`);
          }
          const valueNode = value
            ? composeNode(ctx, value, valueProps, onError)
            : valueProps.found
              ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError)
              : null;
          if (valueNode) {
            if (isBlock(value)) onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment) keyNode.comment += '\n' + valueProps.comment;
            else keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? '}' : ']';
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot
          ? `${name} must end with a ${expectedEnd}`
          : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? 'MISSING_CHAR' : 'BAD_INDENT', msg);
        if (ce && ce.source.length !== 1) ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment) coll.comment += '\n' + end.comment;
          else coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll =
        token.type === 'block-map'
          ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag)
          : token.type === 'block-seq'
            ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag)
            : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === '!' || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName) coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken
        ? null
        : ctx.directives.tagName(tagToken.source, msg =>
            onError(tagToken, 'TAG_RESOLVE_FAILED', msg),
          );
      if (token.type === 'block-seq') {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp =
          anchor && tagToken
            ? anchor.offset > tagToken.offset
              ? anchor
              : tagToken
            : (anchor ?? tagToken);
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = 'Missing newline after block sequence props';
          onError(lastProp, 'MISSING_CHAR', message);
        }
      }
      const expType =
        token.type === 'block-map'
          ? 'map'
          : token.type === 'block-seq'
            ? 'seq'
            : token.start.source === '{'
              ? 'map'
              : 'seq';
      if (
        !tagToken ||
        !tagName ||
        tagName === '!' ||
        (tagName === YAMLMap.YAMLMap.tagName && expType === 'map') ||
        (tagName === YAMLSeq.YAMLSeq.tagName && expType === 'seq')
      ) {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find(t => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(
              tagToken,
              'BAD_COLLECTION_TYPE',
              `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? 'scalar'}`,
              true,
            );
          } else {
            onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res =
        tag.resolve?.(coll, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg), ctx.options) ??
        coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format) node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js'(
    exports,
  ) {
    'use strict';
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header) return { value: '', type: null, comment: '', range: [start, start, start] };
      const type = header.mode === '>' ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === '' || content === '\r') chompStart = i;
        else break;
      }
      if (chompStart === 0) {
        const value2 =
          header.chomp === '+' && lines.length > 0
            ? '\n'.repeat(Math.max(1, lines.length - 1))
            : '';
        let end2 = start + header.length;
        if (scalar.source) end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === '' || content === '\r') {
          if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message =
              'Block scalars with more-indented leading empty lines must use an explicit indentation indicator';
            onError(offset + indent.length, 'MISSING_CHAR', message);
          }
          if (header.indent === 0) trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = 'Block scalar values in collections must be indented';
            onError(offset, 'BAD_INDENT', message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent) chompStart = i + 1;
      }
      let value = '';
      let sep = '';
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + '\n';
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === '\r';
        if (crlf) content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? 'explicit indentation indicator' : 'first line';
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), 'BAD_INDENT', message);
          indent = '';
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = '\n';
        } else if (indent.length > trimIndent || content[0] === '	') {
          if (sep === ' ') sep = '\n';
          else if (!prevMoreIndented && sep === '\n') sep = '\n\n';
          value += sep + indent.slice(trimIndent) + content;
          sep = '\n';
          prevMoreIndented = true;
        } else if (content === '') {
          if (sep === '\n') value += '\n';
          else sep = '\n';
        } else {
          value += sep + content;
          sep = ' ';
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case '-':
          break;
        case '+':
          for (let i = chompStart; i < lines.length; ++i)
            value += '\n' + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== '\n') value += '\n';
          break;
        default:
          value += '\n';
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== 'block-scalar-header') {
        onError(props[0], 'IMPOSSIBLE', 'Block scalar header not found');
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = '';
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === '-' || ch === '+')) chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n) indent = n;
          else if (error === -1) error = offset + i;
        }
      }
      if (error !== -1)
        onError(
          error,
          'UNEXPECTED_TOKEN',
          `Block scalar header includes extra characters: ${source}`,
        );
      let hasSpace = false;
      let comment = '';
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case 'space':
            hasSpace = true;
          // fallthrough
          case 'newline':
            length += token.source.length;
            break;
          case 'comment':
            if (strict && !hasSpace) {
              const message =
                'Comments must be separated from other tokens by white space characters';
              onError(token, 'MISSING_CHAR', message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case 'error':
            onError(token, 'UNEXPECTED_TOKEN', token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, 'UNEXPECTED_TOKEN', message);
            const ts = token.source;
            if (ts && typeof ts === 'string') length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ['', first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js'(
    exports,
  ) {
    'use strict';
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case 'scalar':
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case 'single-quoted-scalar':
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case 'double-quoted-scalar':
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, 'UNEXPECTED_TOKEN', `Expected a flow scalar value, but found: ${type}`);
          return {
            value: '',
            type: null,
            comment: '',
            range: [offset, offset + source.length, offset + source.length],
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset],
      };
    }
    function plainValue(source, onError) {
      let badChar = '';
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case '	':
          badChar = 'a tab character';
          break;
        case ',':
          badChar = 'flow indicator character ,';
          break;
        case '%':
          badChar = 'directive indicator character %';
          break;
        case '|':
        case '>': {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case '@':
        case '`': {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar) onError(0, 'BAD_SCALAR_START', `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, 'MISSING_CHAR', "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp('(.*?)(?<![ 	])[ 	]*\r?\n', 'sy');
        line = new RegExp('[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n', 'sy');
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match) return source;
      let res = match[1];
      let sep = ' ';
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while ((match = line.exec(source))) {
        if (match[1] === '') {
          if (sep === '\n') res += sep;
          else sep = '\n';
        } else {
          res += sep + match[1];
          sep = ' ';
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? '');
    }
    function doubleQuotedValue(source, onError) {
      let res = '';
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === '\r' && source[i + 1] === '\n') continue;
        if (ch === '\n') {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === '\\') {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc) res += cc;
          else if (next === '\n') {
            next = source[i + 1];
            while (next === ' ' || next === '	') next = source[++i + 1];
          } else if (next === '\r' && source[i + 1] === '\n') {
            next = source[++i + 1];
            while (next === ' ' || next === '	') next = source[++i + 1];
          } else if (next === 'x' || next === 'u' || next === 'U') {
            const length = next === 'x' ? 2 : next === 'u' ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === ' ' || ch === '	') {
          const wsStart = i;
          let next = source[i + 1];
          while (next === ' ' || next === '	') next = source[++i + 1];
          if (next !== '\n' && !(next === '\r' && source[i + 2] === '\n'))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, 'MISSING_CHAR', 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = '';
      let ch = source[offset + 1];
      while (ch === ' ' || ch === '	' || ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[offset + 2] !== '\n') break;
        if (ch === '\n') fold += '\n';
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold) fold = ' ';
      return { fold, offset };
    }
    var escapeCodes = {
      0: '\0',
      // null character
      a: '\x07',
      // bell character
      b: '\b',
      // backspace
      e: '\x1B',
      // escape character
      f: '\f',
      // form feed
      n: '\n',
      // line feed
      r: '\r',
      // carriage return
      t: '	',
      // horizontal tab
      v: '\v',
      // vertical tab
      N: '\x85',
      // Unicode next line
      _: '\xA0',
      // Unicode non-breaking space
      L: '\u2028',
      // Unicode line separator
      P: '\u2029',
      // Unicode paragraph separator
      ' ': ' ',
      '"': '"',
      '/': '/',
      '\\': '\\',
      '	': '	',
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js'(
    exports,
  ) {
    'use strict';
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } =
        token.type === 'block-scalar'
          ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError)
          : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken
        ? ctx.directives.tagName(tagToken.source, msg =>
            onError(tagToken, 'TAG_RESOLVE_FAILED', msg),
          )
        : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === 'scalar') tag = findScalarTagByTest(ctx, value, token, onError);
      else tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(
          value,
          msg => onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg),
          ctx.options,
        );
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type) scalar.type = type;
      if (tagName) scalar.tag = tagName;
      if (tag.format) scalar.format = tag.format;
      if (comment) scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === '!') return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test) matchWithTest.push(tag);
          else return tag;
        }
      }
      for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(
        tagToken,
        'TAG_RESOLVE_FAILED',
        `Unresolved tag: ${tagName}`,
        tagName !== 'tag:yaml.org,2002:str',
      );
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag =
        schema.tags.find(
          tag2 =>
            (tag2.default === true || (atKey && tag2.default === 'key')) && tag2.test?.test(value),
        ) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat =
          schema.compat.find(tag2 => tag2.default && tag2.test?.test(value)) ??
          schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, 'TAG_RESOLVE_FAILED', msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js'(
    exports,
  ) {
    'use strict';
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case 'space':
            case 'comment':
            case 'newline':
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === 'space') {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js'(exports) {
    'use strict';
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case 'alias':
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, 'ALIAS_PROPS', 'An alias node must not specify any properties');
          break;
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'block-scalar':
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor) node.anchor = anchor.source.substring(1);
          break;
        case 'block-map':
        case 'block-seq':
        case 'flow-collection':
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor) node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, 'RESOURCE_EXHAUSTION', message);
          }
          break;
        default: {
          const message =
            token.type === 'error' ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, 'UNEXPECTED_TOKEN', message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === '')
        onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
      if (
        atKey &&
        ctx.options.stringKeys &&
        (!identity.isScalar(node) ||
          typeof node.value !== 'string' ||
          (node.tag && node.tag !== 'tag:yaml.org,2002:str'))
      ) {
        const msg = 'With stringKeys, all keys must be strings';
        onError(tag ?? token, 'NON_STRING_KEY', msg);
      }
      if (spaceBefore) node.spaceBefore = true;
      if (comment) {
        if (token.type === 'scalar' && token.source === '') node.comment = comment;
        else node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
      return node;
    }
    function composeEmptyNode(
      ctx,
      offset,
      before,
      pos,
      { spaceBefore, comment, anchor, tag, end },
      onError,
    ) {
      const token = {
        type: 'scalar',
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: '',
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === '') onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
      }
      if (spaceBefore) node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === '') onError(offset, 'BAD_ALIAS', 'Alias cannot be an empty string');
      if (alias.source.endsWith(':'))
        onError(offset + source.length - 1, 'BAD_ALIAS', 'Alias ending in : is ambiguous', true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment) alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js'(exports) {
    'use strict';
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema,
      };
      const props = resolveProps.resolveProps(start, {
        indicator: 'doc-start',
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true,
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (
          value &&
          (value.type === 'block-map' || value.type === 'block-seq') &&
          !props.hasNewline
        )
          onError(
            props.end,
            'MISSING_CHAR',
            'Block collection cannot start on same line with directives-end marker',
          );
      }
      doc.contents = value
        ? composeNode.composeNode(ctx, value, props, onError)
        : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment) doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js'(exports) {
    'use strict';
    var node_process = __require('process');
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === 'number') return [src, src + 1];
      if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === 'string' ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = '';
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case '#':
            comment +=
              (comment === '' ? '' : afterEmptyLine ? '\n\n' : '\n') + (source.substring(1) || ' ');
            atComment = true;
            afterEmptyLine = false;
            break;
          case '%':
            if (prelude[i + 1]?.[0] !== '#') i += 1;
            atComment = false;
            break;
          default:
            if (!atComment) afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning) this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || '1.2' });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment
              ? `${doc.comment}
${comment}`
              : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it)) it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb
              ? `${comment}
${cb}`
              : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb
              ? `${comment}
${cb}`
              : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings,
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens) yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM) console.dir(token, { depth: null });
        switch (token.type) {
          case 'directive':
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, 'BAD_DIRECTIVE', message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case 'document': {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(
                token,
                'MISSING_CHAR',
                'Missing directives-end/doc-start indicator line',
              );
            this.decorate(doc, false);
            if (this.doc) yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case 'byte-order-mark':
          case 'space':
            break;
          case 'comment':
          case 'newline':
            this.prelude.push(token.source);
            break;
          case 'error': {
            const msg = token.source
              ? `${token.message}: ${JSON.stringify(token.source)}`
              : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg);
            if (this.atDirectives || !this.doc) this.errors.push(error);
            else this.doc.errors.push(error);
            break;
          }
          case 'doc-end': {
            if (!this.doc) {
              const msg = 'Unexpected doc-end without preceding document';
              this.errors.push(
                new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg),
              );
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(
              token.end,
              token.offset + token.source.length,
              this.doc.options.strict,
              this.onError,
            );
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc
                ? `${dc}
${end.comment}`
                : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(
              new errors.YAMLParseError(
                getErrorPos(token),
                'UNEXPECTED_TOKEN',
                `Unsupported token ${token.type}`,
              ),
            );
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, 'MISSING_CHAR', 'Missing directives-end indicator line');
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js'(exports) {
    'use strict';
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === 'number' ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError) onError(offset, code, message);
          else throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case 'scalar':
          case 'single-quoted-scalar':
          case 'double-quoted-scalar':
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case 'block-scalar':
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = 'PLAIN' } = context;
      const source = stringifyString.stringifyString(
        { type, value },
        {
          implicitKey,
          indent: indent > 0 ? ' '.repeat(indent) : '',
          inFlow,
          options: { blockQuote: true, lineWidth: -1 },
        },
      );
      const end = context.end ?? [{ type: 'newline', offset: -1, indent, source: '\n' }];
      switch (source[0]) {
        case '|':
        case '>': {
          const he = source.indexOf('\n');
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + '\n';
          const props = [{ type: 'block-scalar-header', offset, indent, source: head }];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: 'newline', offset: -1, indent, source: '\n' });
          return { type: 'block-scalar', offset, indent, props, source: body };
        }
        case '"':
          return { type: 'double-quoted-scalar', offset, indent, source, end };
        case "'":
          return { type: 'single-quoted-scalar', offset, indent, source, end };
        default:
          return { type: 'scalar', offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = 'indent' in token ? token.indent : null;
      if (afterKey && typeof indent === 'number') indent += 2;
      if (!type)
        switch (token.type) {
          case 'single-quoted-scalar':
            type = 'QUOTE_SINGLE';
            break;
          case 'double-quoted-scalar':
            type = 'QUOTE_DOUBLE';
            break;
          case 'block-scalar': {
            const header = token.props[0];
            if (header.type !== 'block-scalar-header')
              throw new Error('Invalid block scalar header');
            type = header.source[0] === '>' ? 'BLOCK_FOLDED' : 'BLOCK_LITERAL';
            break;
          }
          default:
            type = 'PLAIN';
        }
      const source = stringifyString.stringifyString(
        { type, value },
        {
          implicitKey: implicitKey || indent === null,
          indent: indent !== null && indent > 0 ? ' '.repeat(indent) : '',
          inFlow,
          options: { blockQuote: true, lineWidth: -1 },
        },
      );
      switch (source[0]) {
        case '|':
        case '>':
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, 'double-quoted-scalar');
          break;
        case "'":
          setFlowScalarValue(token, source, 'single-quoted-scalar');
          break;
        default:
          setFlowScalarValue(token, source, 'scalar');
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf('\n');
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + '\n';
      if (token.type === 'block-scalar') {
        const header = token.props[0];
        if (header.type !== 'block-scalar-header') throw new Error('Invalid block scalar header');
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = 'indent' in token ? token.indent : -1;
        const props = [{ type: 'block-scalar-header', offset, indent, source: head }];
        if (!addEndtoBlockProps(props, 'end' in token ? token.end : void 0))
          props.push({ type: 'newline', offset: -1, indent, source: '\n' });
        for (const key of Object.keys(token))
          if (key !== 'type' && key !== 'offset') delete token[key];
        Object.assign(token, { type: 'block-scalar', indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case 'space':
            case 'comment':
              props.push(st);
              break;
            case 'newline':
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
          token.type = type;
          token.source = source;
          break;
        case 'block-scalar': {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === 'block-scalar-header') oa -= token.props[0].source.length;
          for (const tok of end) tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case 'block-map':
        case 'block-seq': {
          const offset = token.offset + source.length;
          const nl = { type: 'newline', offset, indent: token.indent, source: '\n' };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = 'indent' in token ? token.indent : -1;
          const end =
            'end' in token && Array.isArray(token.end)
              ? token.end.filter(
                  st => st.type === 'space' || st.type === 'comment' || st.type === 'newline',
                )
              : [];
          for (const key of Object.keys(token))
            if (key !== 'type' && key !== 'offset') delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js'(exports) {
    'use strict';
    var stringify = cst => ('type' in cst ? stringifyToken(cst) : stringifyItem(cst));
    function stringifyToken(token) {
      switch (token.type) {
        case 'block-scalar': {
          let res = '';
          for (const tok of token.props) res += stringifyToken(tok);
          return res + token.source;
        }
        case 'block-map':
        case 'block-seq': {
          let res = '';
          for (const item of token.items) res += stringifyItem(item);
          return res;
        }
        case 'flow-collection': {
          let res = token.start.source;
          for (const item of token.items) res += stringifyItem(item);
          for (const st of token.end) res += st.source;
          return res;
        }
        case 'document': {
          let res = stringifyItem(token);
          if (token.end) for (const st of token.end) res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ('end' in token && token.end) for (const st of token.end) res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = '';
      for (const st of start) res += st.source;
      if (key) res += stringifyToken(key);
      if (sep) for (const st of sep) res += st.source;
      if (value) res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js'(exports) {
    'use strict';
    var BREAK = /* @__PURE__ */ Symbol('break visit');
    var SKIP = /* @__PURE__ */ Symbol('skip children');
    var REMOVE = /* @__PURE__ */ Symbol('remove item');
    function visit3(cst, visitor) {
      if ('type' in cst && cst.type === 'document') cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit3.BREAK = BREAK;
    visit3.SKIP = SKIP;
    visit3.REMOVE = REMOVE;
    visit3.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && 'items' in tok) {
          item = tok.items[index];
        } else return void 0;
      }
      return item;
    };
    visit3.parentCollection = (cst, path) => {
      const parent = visit3.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && 'items' in coll) return coll;
      throw new Error('Parent collection not found');
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === 'symbol') return ctrl;
      for (const field of ['key', 'value']) {
        const token = item[field];
        if (token && 'items' in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === 'number') i = ci - 1;
            else if (ci === BREAK) return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === 'function' && field === 'key') ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === 'function' ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit3;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js'(exports) {
    'use strict';
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = '\uFEFF';
    var DOCUMENT = '';
    var FLOW_END = '';
    var SCALAR = '';
    var isCollection = token => !!token && 'items' in token;
    var isScalar = token =>
      !!token &&
      (token.type === 'scalar' ||
        token.type === 'single-quoted-scalar' ||
        token.type === 'double-quoted-scalar' ||
        token.type === 'block-scalar');
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return '<BOM>';
        case DOCUMENT:
          return '<DOC>';
        case FLOW_END:
          return '<FLOW_END>';
        case SCALAR:
          return '<SCALAR>';
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return 'byte-order-mark';
        case DOCUMENT:
          return 'doc-mode';
        case FLOW_END:
          return 'flow-error-end';
        case SCALAR:
          return 'scalar';
        case '---':
          return 'doc-start';
        case '...':
          return 'doc-end';
        case '':
        case '\n':
        case '\r\n':
          return 'newline';
        case '-':
          return 'seq-item-ind';
        case '?':
          return 'explicit-key-ind';
        case ':':
          return 'map-value-ind';
        case '{':
          return 'flow-map-start';
        case '}':
          return 'flow-map-end';
        case '[':
          return 'flow-seq-start';
        case ']':
          return 'flow-seq-end';
        case ',':
          return 'comma';
      }
      switch (source[0]) {
        case ' ':
        case '	':
          return 'space';
        case '#':
          return 'comment';
        case '%':
          return 'directive-line';
        case '*':
          return 'alias';
        case '&':
          return 'anchor';
        case '!':
          return 'tag';
        case "'":
          return 'single-quoted-scalar';
        case '"':
          return 'double-quoted-scalar';
        case '|':
        case '>':
          return 'block-scalar-header';
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js'(exports) {
    'use strict';
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case ' ':
        case '\n':
        case '\r':
        case '	':
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set('0123456789ABCDEFabcdef');
    var tagChars = new Set(
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()",
    );
    var flowIndicatorChars = new Set(',[]{}');
    var invalidAnchorChars = new Set(' ,[]{}\n\r	');
    var isNotAnchorChar = ch => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = '';
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== 'string') throw TypeError('source is not a string');
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? 'stream';
        while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === ' ' || ch === '	') ch = this.buffer[++i];
        if (!ch || ch === '#' || ch === '\n') return true;
        if (ch === '\r') return this.buffer[i + 1] === '\n';
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === ' ') ch = this.buffer[++indent + offset];
          if (ch === '\r') {
            const next = this.buffer[indent + offset + 1];
            if (next === '\n' || (!next && !this.atEnd)) return offset + indent + 1;
          }
          return ch === '\n' || indent >= this.indentNext || (!ch && !this.atEnd)
            ? offset + indent
            : -1;
        }
        if (ch === '-' || ch === '.') {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === '---' || dt === '...') && isEmpty(this.buffer[offset + 3])) return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== 'number' || (end !== -1 && end < this.pos)) {
          end = this.buffer.indexOf('\n', this.pos);
          this.lineEndPos = end;
        }
        if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === '\r') end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case 'stream':
            return yield* this.parseStream();
          case 'line-start':
            return yield* this.parseLineStart();
          case 'block-start':
            return yield* this.parseBlockStart();
          case 'doc':
            return yield* this.parseDocument();
          case 'flow':
            return yield* this.parseFlowCollection();
          case 'quoted-scalar':
            return yield* this.parseQuotedScalar();
          case 'block-scalar':
            return yield* this.parseBlockScalar();
          case 'plain-scalar':
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null) return this.setNext('stream');
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === '%') {
          let dirEnd = line.length;
          let cs = line.indexOf('#');
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === ' ' || ch === '	') {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf('#', cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === ' ' || ch === '	') dirEnd -= 1;
            else break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return 'stream';
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return 'stream';
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd) return this.setNext('line-start');
        if (ch === '-' || ch === '.') {
          if (!this.atEnd && !this.hasChars(4)) return this.setNext('line-start');
          const s = this.peek(3);
          if ((s === '---' || s === '...') && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === '---' ? 'doc' : 'stream';
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd) return this.setNext('block-start');
        if ((ch0 === '-' || ch0 === '?' || ch0 === ':') && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return 'block-start';
        }
        return 'doc';
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null) return this.setNext('doc');
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case '#':
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case '{':
          case '[':
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return 'flow';
          case '}':
          case ']':
            yield* this.pushCount(1);
            return 'doc';
          case '*':
            yield* this.pushUntil(isNotAnchorChar);
            return 'doc';
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case '|':
          case '>':
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null) return this.setNext('flow');
        if (
          (indent !== -1 && indent < this.indentNext && line[0] !== '#') ||
          (indent === 0 && (line.startsWith('---') || line.startsWith('...')) && isEmpty(line[3]))
        ) {
          const atFlowEndMarker =
            indent === this.indentNext - 1 &&
            this.flowLevel === 1 &&
            (line[0] === ']' || line[0] === '}');
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ',') {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return 'flow';
          case '#':
            yield* this.pushCount(line.length - n);
            return 'flow';
          case '{':
          case '[':
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return 'flow';
          case '}':
          case ']':
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? 'flow' : 'doc';
          case '*':
            yield* this.pushUntil(isNotAnchorChar);
            return 'flow';
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ':': {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ',') {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return 'flow';
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === '\\') n += 1;
            if (n % 2 === 0) break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf('\n', this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1) break;
            nl = qb.indexOf('\n', cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === '\r' ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd) return this.setNext('quoted-scalar');
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? 'flow' : 'doc';
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === '+') this.blockScalarKeep = true;
          else if (ch > '0' && ch <= '9') this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== '-') break;
        }
        return yield* this.pushUntil(ch => isEmpty(ch) || ch === '#');
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; (ch = this.buffer[i2]); ++i2) {
          switch (ch) {
            case ' ':
              indent += 1;
              break;
            case '\n':
              nl = i2;
              indent = 0;
              break;
            case '\r': {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd) return this.setNext('block-scalar');
              if (next === '\n') break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd) return this.setNext('block-scalar');
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1) this.indentNext = indent;
          else {
            this.indentNext =
              this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1) break;
            nl = this.buffer.indexOf('\n', cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd) return this.setNext('block-scalar');
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === ' ') ch = this.buffer[++i];
        if (ch === '	') {
          while (ch === '	' || ch === ' ' || ch === '\r' || ch === '\n') ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === '\r') ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === ' ') ch2 = this.buffer[--i2];
            if (ch2 === '\n' && i2 >= this.pos && i2 + 1 + indent > lastChar) nl = i2;
            else break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while ((ch = this.buffer[++i])) {
          if (ch === ':') {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || (inFlow && flowIndicatorChars.has(next))) break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === '\r') {
              if (next === '\n') {
                i += 1;
                ch = '\n';
                next = this.buffer[i + 1];
              } else end = i;
            }
            if (next === '#' || (inFlow && flowIndicatorChars.has(next))) break;
            if (ch === '\n') {
              const cs = this.continueScalar(i + 1);
              if (cs === -1) break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch)) break;
            end = i;
          }
        }
        if (!ch && !this.atEnd) return this.setNext('plain-scalar');
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? 'flow' : 'doc';
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty) yield '';
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case '!':
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case '&':
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case '-':
            // this is an error
            case '?':
            // this is an error outside flow collections
            case ':': {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || (inFlow && flowIndicatorChars.has(ch1))) {
                if (!inFlow) this.indentNext = this.indentValue + 1;
                else if (this.flowKey) this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === '<') {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== '>') ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === '>' ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch)) ch = this.buffer[++i];
            else if (
              ch === '%' &&
              hexDigits.has(this.buffer[i + 1]) &&
              hexDigits.has(this.buffer[i + 2])
            ) {
              ch = this.buffer[(i += 3)];
            } else break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === '\n') return yield* this.pushCount(1);
        else if (ch === '\r' && this.charAt(1) === '\n') return yield* this.pushCount(2);
        else return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === ' ' || (allowTabs && ch === '	'));
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch)) ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js'(exports) {
    'use strict';
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = offset => this.lineStarts.push(offset);
        this.linePos = offset => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = (low + high) >> 1;
            if (this.lineStarts[mid] < offset) low = mid + 1;
            else high = mid;
          }
          if (this.lineStarts[low] === offset) return { line: low + 1, col: 1 };
          if (low === 0) return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js'(exports) {
    'use strict';
    var node_process = __require('process');
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case 'space':
          case 'comment':
          case 'newline':
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case 'alias':
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'flow-collection':
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case 'document':
          return parent.start;
        case 'block-map': {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case 'block-seq':
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0) return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case 'doc-start':
          case 'explicit-key-ind':
          case 'map-value-ind':
          case 'seq-item-ind':
          case 'newline':
            break loop;
        }
      }
      while (prev[++i]?.type === 'space') {}
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5) Array.prototype.push.apply(target, source);
      else for (let i = 0; i < source.length; ++i) target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === 'flow-seq-start') {
        for (const it of fc.items) {
          if (
            it.sep &&
            !it.value &&
            !includesToken(it.start, 'explicit-key-ind') &&
            !includesToken(it.sep, 'map-value-ind')
          ) {
            if (it.key) it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end) arrayPushArray(it.value.end, it.sep);
              else it.value.end = it.sep;
            } else arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = '';
        this.type = '';
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0) this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
        if (!incomplete) yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS) console.log('|', cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: 'error', offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === 'scalar') {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = 'scalar';
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case 'newline':
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine) this.onNewLine(this.offset + source.length);
              break;
            case 'space':
              if (this.atNewLine && source[0] === ' ') this.indent += source.length;
              break;
            case 'explicit-key-ind':
            case 'map-value-ind':
            case 'seq-item-ind':
              if (this.atNewLine) this.indent += source.length;
              break;
            case 'doc-mode':
            case 'flow-error-end':
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0) yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source,
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === 'doc-end' && top?.type !== 'doc-end') {
          while (this.stack.length > 0) yield* this.pop();
          this.stack.push({
            type: 'doc-end',
            offset: this.offset,
            source: this.source,
          });
          return;
        }
        if (!top) return yield* this.stream();
        switch (top.type) {
          case 'document':
            return yield* this.document(top);
          case 'alias':
          case 'scalar':
          case 'single-quoted-scalar':
          case 'double-quoted-scalar':
            return yield* this.scalar(top);
          case 'block-scalar':
            return yield* this.blockScalar(top);
          case 'block-map':
            return yield* this.blockMap(top);
          case 'block-seq':
            return yield* this.blockSequence(top);
          case 'flow-collection':
            return yield* this.flowCollection(top);
          case 'doc-end':
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = 'Tried to pop an empty stack';
          yield { type: 'error', offset: this.offset, source: '', message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === 'block-scalar') {
            token.indent = 'indent' in top ? top.indent : 0;
          } else if (token.type === 'flow-collection' && top.type === 'document') {
            token.indent = 0;
          }
          if (token.type === 'flow-collection') fixFlowSeqItems(token);
          switch (top.type) {
            case 'document':
              top.value = token;
              break;
            case 'block-scalar':
              top.props.push(token);
              break;
            case 'block-map': {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case 'block-seq': {
              const it = top.items[top.items.length - 1];
              if (it.value) top.items.push({ start: [], value: token });
              else it.value = token;
              break;
            }
            case 'flow-collection': {
              const it = top.items[top.items.length - 1];
              if (!it || it.value) top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep) it.value = token;
              else Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if (
            (top.type === 'document' || top.type === 'block-map' || top.type === 'block-seq') &&
            (token.type === 'block-map' || token.type === 'block-seq')
          ) {
            const last = token.items[token.items.length - 1];
            if (
              last &&
              !last.sep &&
              !last.value &&
              last.start.length > 0 &&
              findNonEmptyIndex(last.start) === -1 &&
              (token.indent === 0 ||
                last.start.every(st => st.type !== 'comment' || st.indent < token.indent))
            ) {
              if (top.type === 'document') top.end = last.start;
              else top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case 'directive-line':
            yield { type: 'directive', offset: this.offset, source: this.source };
            return;
          case 'byte-order-mark':
          case 'space':
          case 'comment':
          case 'newline':
            yield this.sourceToken;
            return;
          case 'doc-mode':
          case 'doc-start': {
            const doc = {
              type: 'document',
              offset: this.offset,
              start: [],
            };
            if (this.type === 'doc-start') doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: 'error',
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source,
        };
      }
      *document(doc) {
        if (doc.value) return yield* this.lineEnd(doc);
        switch (this.type) {
          case 'doc-start': {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else doc.start.push(this.sourceToken);
            return;
          }
          case 'anchor':
          case 'tag':
          case 'space':
          case 'comment':
          case 'newline':
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv) this.stack.push(bv);
        else {
          yield {
            type: 'error',
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source,
          };
        }
      }
      *scalar(scalar) {
        if (this.type === 'map-value-ind') {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else sep = [this.sourceToken];
          const map = {
            type: 'block-map',
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }],
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case 'space':
          case 'comment':
          case 'newline':
            scalar.props.push(this.sourceToken);
            return;
          case 'scalar':
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf('\n') + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf('\n', nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case 'newline':
            this.onKeyLine = false;
            if (it.value) {
              const end = 'end' in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === 'comment') end?.push(this.sourceToken);
              else map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case 'space':
          case 'comment':
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem =
            atMapIndent && (it.sep || it.explicitKey) && this.type !== 'seq-item-ind';
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case 'newline':
                  nl.push(i);
                  break;
                case 'space':
                  break;
                case 'comment':
                  if (st.indent > map.indent) nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2) start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case 'anchor':
            case 'tag':
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case 'explicit-key-ind':
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: 'block-map',
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }],
                });
              }
              this.onKeyLine = true;
              return;
            case 'map-value-ind':
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, 'newline')) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: 'block-map',
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }],
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, 'map-value-ind')) {
                  this.stack.push({
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }],
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, 'newline')) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }],
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, 'map-value-ind')) {
                  this.stack.push({
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }],
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar': {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === 'block-seq') {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, 'newline')) {
                    yield* this.pop({
                      type: 'error',
                      offset: this.offset,
                      message: 'Unexpected block-seq-ind on same line with key',
                      source: this.source,
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case 'newline':
            if (it.value) {
              const end = 'end' in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === 'comment') end?.push(this.sourceToken);
              else seq.items.push({ start: [this.sourceToken] });
            } else it.start.push(this.sourceToken);
            return;
          case 'space':
          case 'comment':
            if (it.value) seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case 'anchor':
          case 'tag':
            if (it.value || this.indent <= seq.indent) break;
            it.start.push(this.sourceToken);
            return;
          case 'seq-item-ind':
            if (this.indent !== seq.indent) break;
            if (it.value || includesToken(it.start, 'seq-item-ind'))
              seq.items.push({ start: [this.sourceToken] });
            else it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === 'flow-error-end') {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === 'flow-collection');
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case 'comma':
            case 'explicit-key-ind':
              if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
              else it.start.push(this.sourceToken);
              return;
            case 'map-value-ind':
              if (!it || it.value) fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep) it.sep.push(this.sourceToken);
              else Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case 'space':
            case 'comment':
            case 'newline':
            case 'anchor':
            case 'tag':
              if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
              else if (it.sep) it.sep.push(this.sourceToken);
              else it.start.push(this.sourceToken);
              return;
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar': {
              const fs = this.flowScalar(this.type);
              if (!it || it.value) fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep) this.stack.push(fs);
              else Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case 'flow-map-end':
            case 'flow-seq-end':
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv) this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (
            parent.type === 'block-map' &&
            ((this.type === 'map-value-ind' && parent.indent === fc.indent) ||
              (this.type === 'newline' && !parent.items[parent.items.length - 1].sep))
          ) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === 'map-value-ind' && parent.type !== 'flow-collection') {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: 'block-map',
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }],
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf('\n') + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf('\n', nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source,
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case 'alias':
          case 'scalar':
          case 'single-quoted-scalar':
          case 'double-quoted-scalar':
            return this.flowScalar(this.type);
          case 'block-scalar-header':
            return {
              type: 'block-scalar',
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: '',
            };
          case 'flow-map-start':
          case 'flow-seq-start':
            return {
              type: 'flow-collection',
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: [],
            };
          case 'seq-item-ind':
            return {
              type: 'block-seq',
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }],
            };
          case 'explicit-key-ind': {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: 'block-map',
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }],
            };
          }
          case 'map-value-ind': {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: 'block-map',
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }],
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== 'comment') return false;
        if (this.indent <= indent) return false;
        return start.every(st => st.type === 'newline' || st.type === 'space');
      }
      *documentEnd(docEnd) {
        if (this.type !== 'doc-mode') {
          if (docEnd.end) docEnd.end.push(this.sourceToken);
          else docEnd.end = [this.sourceToken];
          if (this.type === 'newline') yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case 'comma':
          case 'doc-start':
          case 'doc-end':
          case 'flow-seq-end':
          case 'flow-map-end':
          case 'map-value-ind':
            yield* this.pop();
            yield* this.step();
            break;
          case 'newline':
            this.onKeyLine = false;
          // fallthrough
          case 'space':
          case 'comment':
          default:
            if (token.end) token.end.push(this.sourceToken);
            else token.end = [this.sourceToken];
            if (this.type === 'newline') yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/public-api.js'(exports) {
    'use strict';
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 =
        options.lineCounter || (prettyErrors && new lineCounter.LineCounter()) || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0) return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument2(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc) doc = _doc;
        else if (doc.options.logLevel !== 'silent') {
          doc.errors.push(
            new errors.YAMLParseError(
              _doc.range.slice(0, 2),
              'MULTIPLE_DOCS',
              'Source contains multiple documents; please use YAML.parseAllDocuments()',
            ),
          );
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === 'function') {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === 'object') {
        options = reviver;
      }
      const doc = parseDocument2(src, options);
      if (!doc) return null;
      doc.warnings.forEach(warning => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== 'silent') throw doc.errors[0];
        else doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === 'function' || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === 'string') options = options.length;
      if (typeof options === 'number') {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined) return void 0;
      }
      if (identity.isDocument(value) && !_replacer) return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse3;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument2;
    exports.stringify = stringify;
  },
});

// ../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  '../../../node_modules/.bun/yaml@2.9.0/node_modules/yaml/dist/index.js'(exports) {
    'use strict';
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit3 = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit3.visit;
    exports.visitAsync = visit3.visitAsync;
  },
});

// claude-plugin/runtime/dispatch.ts
import { spawnSync as spawnSync2 } from 'node:child_process';
import { createHash as createHash6 } from 'node:crypto';
import {
  existsSync as existsSync7,
  lstatSync as lstatSync5,
  readFileSync as readFileSync6,
  realpathSync as realpathSync3,
} from 'node:fs';
import nodePath10 from 'node:path';

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0,
    value = '',
    tokenOffset = 0,
    token = 16,
    lineNumber = 0,
    lineStartOffset = 0,
    tokenLineStartOffset = 0,
    prevTokenLineStartOffset = 0,
    scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = '';
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if ((pos < text.length && text.charCodeAt(pos) === 43) || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = '',
      start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += '\\';
            break;
          case 47:
            result += '/';
            break;
          case 98:
            result += '\b';
            break;
          case 102:
            result += '\f';
            break;
          case 110:
            result += '\n';
            break;
          case 114:
            result += '\r';
            break;
          case 116:
            result += '	';
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = '';
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return (token = 17);
    }
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return (token = 15);
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
        pos++;
        value += '\n';
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return (token = 14);
    }
    switch (code) {
      // tokens: []{}:,
      case 123:
        pos++;
        return (token = 1);
      case 125:
        pos++;
        return (token = 2);
      case 91:
        pos++;
        return (token = 3);
      case 93:
        pos++;
        return (token = 4);
      case 58:
        pos++;
        return (token = 6);
      case 44:
        pos++;
        return (token = 5);
      // strings
      case 34:
        pos++;
        value = scanString();
        return (token = 10);
      // comments
      case 47:
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return (token = 12);
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text.substring(start, pos);
          return (token = 13);
        }
        value += String.fromCharCode(code);
        pos++;
        return (token = 16);
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return (token = 16);
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return (token = 11);
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case 'true':
              return (token = 8);
            case 'false':
              return (token = 9);
            case 'null':
              return (token = 7);
          }
          return (token = 16);
        }
        value += String.fromCharCode(code);
        pos++;
        return (token = 16);
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError,
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function (CharacterCodes2) {
  CharacterCodes2[(CharacterCodes2['lineFeed'] = 10)] = 'lineFeed';
  CharacterCodes2[(CharacterCodes2['carriageReturn'] = 13)] = 'carriageReturn';
  CharacterCodes2[(CharacterCodes2['space'] = 32)] = 'space';
  CharacterCodes2[(CharacterCodes2['_0'] = 48)] = '_0';
  CharacterCodes2[(CharacterCodes2['_1'] = 49)] = '_1';
  CharacterCodes2[(CharacterCodes2['_2'] = 50)] = '_2';
  CharacterCodes2[(CharacterCodes2['_3'] = 51)] = '_3';
  CharacterCodes2[(CharacterCodes2['_4'] = 52)] = '_4';
  CharacterCodes2[(CharacterCodes2['_5'] = 53)] = '_5';
  CharacterCodes2[(CharacterCodes2['_6'] = 54)] = '_6';
  CharacterCodes2[(CharacterCodes2['_7'] = 55)] = '_7';
  CharacterCodes2[(CharacterCodes2['_8'] = 56)] = '_8';
  CharacterCodes2[(CharacterCodes2['_9'] = 57)] = '_9';
  CharacterCodes2[(CharacterCodes2['a'] = 97)] = 'a';
  CharacterCodes2[(CharacterCodes2['b'] = 98)] = 'b';
  CharacterCodes2[(CharacterCodes2['c'] = 99)] = 'c';
  CharacterCodes2[(CharacterCodes2['d'] = 100)] = 'd';
  CharacterCodes2[(CharacterCodes2['e'] = 101)] = 'e';
  CharacterCodes2[(CharacterCodes2['f'] = 102)] = 'f';
  CharacterCodes2[(CharacterCodes2['g'] = 103)] = 'g';
  CharacterCodes2[(CharacterCodes2['h'] = 104)] = 'h';
  CharacterCodes2[(CharacterCodes2['i'] = 105)] = 'i';
  CharacterCodes2[(CharacterCodes2['j'] = 106)] = 'j';
  CharacterCodes2[(CharacterCodes2['k'] = 107)] = 'k';
  CharacterCodes2[(CharacterCodes2['l'] = 108)] = 'l';
  CharacterCodes2[(CharacterCodes2['m'] = 109)] = 'm';
  CharacterCodes2[(CharacterCodes2['n'] = 110)] = 'n';
  CharacterCodes2[(CharacterCodes2['o'] = 111)] = 'o';
  CharacterCodes2[(CharacterCodes2['p'] = 112)] = 'p';
  CharacterCodes2[(CharacterCodes2['q'] = 113)] = 'q';
  CharacterCodes2[(CharacterCodes2['r'] = 114)] = 'r';
  CharacterCodes2[(CharacterCodes2['s'] = 115)] = 's';
  CharacterCodes2[(CharacterCodes2['t'] = 116)] = 't';
  CharacterCodes2[(CharacterCodes2['u'] = 117)] = 'u';
  CharacterCodes2[(CharacterCodes2['v'] = 118)] = 'v';
  CharacterCodes2[(CharacterCodes2['w'] = 119)] = 'w';
  CharacterCodes2[(CharacterCodes2['x'] = 120)] = 'x';
  CharacterCodes2[(CharacterCodes2['y'] = 121)] = 'y';
  CharacterCodes2[(CharacterCodes2['z'] = 122)] = 'z';
  CharacterCodes2[(CharacterCodes2['A'] = 65)] = 'A';
  CharacterCodes2[(CharacterCodes2['B'] = 66)] = 'B';
  CharacterCodes2[(CharacterCodes2['C'] = 67)] = 'C';
  CharacterCodes2[(CharacterCodes2['D'] = 68)] = 'D';
  CharacterCodes2[(CharacterCodes2['E'] = 69)] = 'E';
  CharacterCodes2[(CharacterCodes2['F'] = 70)] = 'F';
  CharacterCodes2[(CharacterCodes2['G'] = 71)] = 'G';
  CharacterCodes2[(CharacterCodes2['H'] = 72)] = 'H';
  CharacterCodes2[(CharacterCodes2['I'] = 73)] = 'I';
  CharacterCodes2[(CharacterCodes2['J'] = 74)] = 'J';
  CharacterCodes2[(CharacterCodes2['K'] = 75)] = 'K';
  CharacterCodes2[(CharacterCodes2['L'] = 76)] = 'L';
  CharacterCodes2[(CharacterCodes2['M'] = 77)] = 'M';
  CharacterCodes2[(CharacterCodes2['N'] = 78)] = 'N';
  CharacterCodes2[(CharacterCodes2['O'] = 79)] = 'O';
  CharacterCodes2[(CharacterCodes2['P'] = 80)] = 'P';
  CharacterCodes2[(CharacterCodes2['Q'] = 81)] = 'Q';
  CharacterCodes2[(CharacterCodes2['R'] = 82)] = 'R';
  CharacterCodes2[(CharacterCodes2['S'] = 83)] = 'S';
  CharacterCodes2[(CharacterCodes2['T'] = 84)] = 'T';
  CharacterCodes2[(CharacterCodes2['U'] = 85)] = 'U';
  CharacterCodes2[(CharacterCodes2['V'] = 86)] = 'V';
  CharacterCodes2[(CharacterCodes2['W'] = 87)] = 'W';
  CharacterCodes2[(CharacterCodes2['X'] = 88)] = 'X';
  CharacterCodes2[(CharacterCodes2['Y'] = 89)] = 'Y';
  CharacterCodes2[(CharacterCodes2['Z'] = 90)] = 'Z';
  CharacterCodes2[(CharacterCodes2['asterisk'] = 42)] = 'asterisk';
  CharacterCodes2[(CharacterCodes2['backslash'] = 92)] = 'backslash';
  CharacterCodes2[(CharacterCodes2['closeBrace'] = 125)] = 'closeBrace';
  CharacterCodes2[(CharacterCodes2['closeBracket'] = 93)] = 'closeBracket';
  CharacterCodes2[(CharacterCodes2['colon'] = 58)] = 'colon';
  CharacterCodes2[(CharacterCodes2['comma'] = 44)] = 'comma';
  CharacterCodes2[(CharacterCodes2['dot'] = 46)] = 'dot';
  CharacterCodes2[(CharacterCodes2['doubleQuote'] = 34)] = 'doubleQuote';
  CharacterCodes2[(CharacterCodes2['minus'] = 45)] = 'minus';
  CharacterCodes2[(CharacterCodes2['openBrace'] = 123)] = 'openBrace';
  CharacterCodes2[(CharacterCodes2['openBracket'] = 91)] = 'openBracket';
  CharacterCodes2[(CharacterCodes2['plus'] = 43)] = 'plus';
  CharacterCodes2[(CharacterCodes2['slash'] = 47)] = 'slash';
  CharacterCodes2[(CharacterCodes2['formFeed'] = 12)] = 'formFeed';
  CharacterCodes2[(CharacterCodes2['tab'] = 9)] = 'tab';
})(CharacterCodes || (CharacterCodes = {}));

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return ' '.repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  ' ': {
    '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\n' + ' '.repeat(index);
    }),
    '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\r' + ' '.repeat(index);
    }),
    '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\r\n' + ' '.repeat(index);
    }),
  },
  '	': {
    '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\n' + '	'.repeat(index);
    }),
    '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\r' + '	'.repeat(index);
    }),
    '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
      return '\r\n' + '	'.repeat(index);
    }),
  },
};
var supportedEols = ['\n', '\r', '\r\n'];

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/format.js
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  const eolFastPathSupported = supportedEols.includes(eol);
  let numberLineBreaks = 0;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue =
      cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
  } else {
    indentValue = '	';
  }
  const indentType = indentValue === '	' ? '	' : ' ';
  let scanner = createScanner(formatText, false);
  let hasError = false;
  function newLinesAndIndent() {
    if (numberLineBreaks > 1) {
      return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
    if (
      !eolFastPathSupported ||
      amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length
    ) {
      return eol + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    if (amountOfSpaces <= 0) {
      return eol;
    }
    return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
  }
  function scanNext() {
    let token = scanner.scan();
    numberLineBreaks = 0;
    while (token === 15 || token === 14) {
      if (token === 14 && options.keepLines) {
        numberLineBreaks += 1;
      } else if (token === 14) {
        numberLineBreaks = 1;
      }
      token = scanner.scan();
    }
    hasError = token === 16 || scanner.getTokenError() !== 0;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (
      !hasError &&
      (!range || (startOffset < rangeEnd && endOffset > rangeStart)) &&
      documentText.substring(startOffset, endOffset) !== text
    ) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (options.keepLines && numberLineBreaks > 0) {
    addEdit(repeat(eol, numberLineBreaks), 0, 0);
  }
  if (firstToken !== 17) {
    let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    let initialIndent =
      indentValue.length * initialIndentLevel < 20 && options.insertSpaces
        ? cachedSpaces[indentValue.length * initialIndentLevel]
        : repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== 17) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = '';
    let needsLineBreak = false;
    while (numberLineBreaks === 0 && (secondToken === 12 || secondToken === 13)) {
      let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      needsLineBreak = secondToken === 12;
      replaceContent = needsLineBreak ? newLinesAndIndent() : '';
      secondToken = scanNext();
    }
    if (secondToken === 2) {
      if (firstToken !== 1) {
        indentLevel--;
      }
      if ((options.keepLines && numberLineBreaks > 0) || (!options.keepLines && firstToken !== 1)) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else if (secondToken === 4) {
      if (firstToken !== 3) {
        indentLevel--;
      }
      if ((options.keepLines && numberLineBreaks > 0) || (!options.keepLines && firstToken !== 3)) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else {
      switch (firstToken) {
        case 3:
        case 1:
          indentLevel++;
          if ((options.keepLines && numberLineBreaks > 0) || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 5:
          if ((options.keepLines && numberLineBreaks > 0) || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 12:
          replaceContent = newLinesAndIndent();
          break;
        case 13:
          if (numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 6:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 10:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (secondToken === 6 && !needsLineBreak) {
            replaceContent = '';
          }
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else {
            if ((secondToken === 12 || secondToken === 13) && !needsLineBreak) {
              replaceContent = cachedSpaces[1];
            } else if (secondToken !== 5 && secondToken !== 17) {
              hasError = true;
            }
          }
          break;
        case 16:
          hasError = true;
          break;
      }
      if (numberLineBreaks > 0 && (secondToken === 12 || secondToken === 13)) {
        replaceContent = newLinesAndIndent();
      }
    }
    if (secondToken === 17) {
      if (options.keepLines && numberLineBreaks > 0) {
        replaceContent = newLinesAndIndent();
      } else {
        replaceContent = options.insertFinalNewline ? eol : '';
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function repeat(s, count) {
  let result = '';
  for (let i = 0; i < count; i++) {
    result += s;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    let ch = content.charAt(i);
    if (ch === cachedSpaces[1]) {
      nChars++;
    } else if (ch === '	') {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '\r') {
      if (i + 1 < text.length && text.charAt(i + 1) === '\n') {
        return '\r\n';
      }
      return '\r';
    } else if (ch === '\n') {
      return '\n';
    }
  }
  return (options && options.eol) || '\n';
}
function isEOL(text, offset) {
  return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function (ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false,
  };
})(ParseOptions || (ParseOptions = {}));
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: name => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    },
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: 'array', offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === 'property') {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: offset => {
      currentParent = onValue({
        type: 'object',
        offset,
        length: -1,
        parent: currentParent,
        children: [],
      });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({
        type: 'property',
        offset,
        length: -1,
        parent: currentParent,
        children: [],
      });
      currentParent.children.push({
        type: 'string',
        value: name,
        offset,
        length,
        parent: currentParent,
      });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({
        type: 'array',
        offset,
        length: -1,
        parent: currentParent,
        children: [],
      });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === 'property') {
        if (sep === ':') {
          currentParent.colonOffset = offset;
        } else if (sep === ',') {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    },
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path) {
    if (typeof segment === 'string') {
      if (node.type !== 'object' || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (
          Array.isArray(propertyNode.children) &&
          propertyNode.children[0].value === segment &&
          propertyNode.children.length === 2
        ) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (
        node.type !== 'array' ||
        index < 0 ||
        !Array.isArray(node.children) ||
        index >= node.children.length
      ) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction
      ? () =>
          suppressedCallbacks === 0 &&
          visitFunction(
            _scanner.getTokenOffset(),
            _scanner.getTokenLength(),
            _scanner.getTokenStartLine(),
            _scanner.getTokenStartCharacter(),
          )
      : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction
      ? arg =>
          suppressedCallbacks === 0 &&
          visitFunction(
            arg,
            _scanner.getTokenOffset(),
            _scanner.getTokenLength(),
            _scanner.getTokenStartLine(),
            _scanner.getTokenStartCharacter(),
          )
      : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction
      ? arg =>
          suppressedCallbacks === 0 &&
          visitFunction(
            arg,
            _scanner.getTokenOffset(),
            _scanner.getTokenLength(),
            _scanner.getTokenStartLine(),
            _scanner.getTokenStartCharacter(),
            () => _jsonPath.slice(),
          )
      : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction
      ? () => {
          if (suppressedCallbacks > 0) {
            suppressedCallbacks++;
          } else {
            let cbReturn = visitFunction(
              _scanner.getTokenOffset(),
              _scanner.getTokenLength(),
              _scanner.getTokenStartLine(),
              _scanner.getTokenStartCharacter(),
              () => _jsonPath.slice(),
            );
            if (cbReturn === false) {
              suppressedCallbacks = 1;
            }
          }
        }
      : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction
      ? () => {
          if (suppressedCallbacks > 0) {
            suppressedCallbacks--;
          }
          if (suppressedCallbacks === 0) {
            visitFunction(
              _scanner.getTokenOffset(),
              _scanner.getTokenLength(),
              _scanner.getTokenStartLine(),
              _scanner.getTokenStartCharacter(),
            );
          }
        }
      : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin),
    onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty),
    onObjectEnd = toEndVisit(visitor.onObjectEnd),
    onArrayBegin = toBeginVisit(visitor.onArrayBegin),
    onArrayEnd = toEndVisit(visitor.onArrayEnd),
    onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue),
    onSeparator = toOneArgVisit(visitor.onSeparator),
    onComment = toNoArgVisit(visitor.onComment),
    onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(
            14,
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15,
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13,
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11,
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12,
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16,
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10,
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
            1,
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(
            2,
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(
        3,
        [],
        [
          2, 5,
          /* SyntaxKind.CommaToken */
        ],
      );
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(':');
      scanNext();
      if (!parseValue()) {
        handleError(
          4,
          [],
          [
            2, 5,
            /* SyntaxKind.CommaToken */
          ],
        );
      }
    } else {
      handleError(
        5,
        [],
        [
          2, 5,
          /* SyntaxKind.CommaToken */
        ],
      );
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(',');
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(
          4,
          [],
          [
            2, 5,
            /* SyntaxKind.CommaToken */
          ],
        );
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(
        7,
        [
          2,
          /* SyntaxKind.CloseBraceToken */
        ],
        [],
      );
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(',');
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(
          4,
          [],
          [
            4, 5,
            /* SyntaxKind.CommaToken */
          ],
        );
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(
        8,
        [
          4,
          /* SyntaxKind.CloseBracketToken */
        ],
        [],
      );
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'object': {
      if (!value) {
        return 'null';
      } else if (Array.isArray(value)) {
        return 'array';
      }
      return 'object';
    }
    default:
      return 'null';
  }
}

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/edit.js
function setProperty(text, originalPath, value, options) {
  const path = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = void 0;
  let lastSegment = void 0;
  while (path.length > 0) {
    lastSegment = path.pop();
    parent = findNodeAtLocation(root, path);
    if (parent === void 0 && value !== void 0) {
      if (typeof lastSegment === 'string') {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === void 0) {
      throw new Error('Can not delete in empty document');
    }
    return withFormatting(
      text,
      {
        offset: root ? root.offset : 0,
        length: root ? root.length : 0,
        content: JSON.stringify(value),
      },
      options,
    );
  } else if (
    parent.type === 'object' &&
    typeof lastSegment === 'string' &&
    Array.isArray(parent.children)
  ) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== void 0) {
      if (value === void 0) {
        if (!existing.parent) {
          throw new Error('Malformed AST');
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          let previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            let next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(
          text,
          { offset: removeBegin, length: removeEnd - removeBegin, content: '' },
          options,
        );
      } else {
        return withFormatting(
          text,
          { offset: existing.offset, length: existing.length, content: JSON.stringify(value) },
          options,
        );
      }
    } else {
      if (value === void 0) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = options.getInsertionIndex
        ? options.getInsertionIndex(parent.children.map(p => p.children[0].value))
        : parent.children.length;
      let edit;
      if (index > 0) {
        let previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + ',' };
      }
      return withFormatting(text, edit, options);
    }
  } else if (
    parent.type === 'array' &&
    typeof lastSegment === 'number' &&
    Array.isArray(parent.children)
  ) {
    const insertIndex = lastSegment;
    if (insertIndex === -1) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        const previous = parent.children[parent.children.length - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
      }
      return withFormatting(text, edit, options);
    } else if (value === void 0 && parent.children.length >= 0) {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: '' };
      } else if (parent.children.length - 1 === removalIndex) {
        let previous = parent.children[removalIndex - 1];
        let offset = previous.offset + previous.length;
        let parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: '' };
      } else {
        edit = {
          offset: toRemove.offset,
          length: parent.children[removalIndex + 1].offset - toRemove.offset,
          content: '',
        };
      }
      return withFormatting(text, edit, options);
    } else if (value !== void 0) {
      let edit;
      const newProperty = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && parent.children.length > lastSegment) {
        const toModify = parent.children[lastSegment];
        edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
      } else if (parent.children.length === 0 || lastSegment === 0) {
        edit = {
          offset: parent.offset + 1,
          length: 0,
          content: parent.children.length === 0 ? newProperty : newProperty + ',',
        };
      } else {
        const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: ',' + newProperty };
      }
      return withFormatting(text, edit, options);
    } else {
      throw new Error(
        `Can not ${value === void 0 ? 'remove' : options.isArrayInsertion ? 'insert' : 'modify'} Array index ${insertIndex} as length is not sufficient`,
      );
    }
  } else {
    throw new Error(
      `Can not add ${typeof lastSegment !== 'number' ? 'index' : 'property'} to parent of type ${parent.type}`,
    );
  }
}
function withFormatting(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(
    newText,
    { offset: begin, length: end - begin },
    { ...options.formattingOptions, keepLines: false },
  );
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit2 = edits[i];
    newText = applyEdit(newText, edit2);
    begin = Math.min(begin, edit2.offset);
    end = Math.max(end, edit2.offset + edit2.length);
    end += edit2.content.length - edit2.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

// ../../../node_modules/.bun/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function (ScanError2) {
  ScanError2[(ScanError2['None'] = 0)] = 'None';
  ScanError2[(ScanError2['UnexpectedEndOfComment'] = 1)] = 'UnexpectedEndOfComment';
  ScanError2[(ScanError2['UnexpectedEndOfString'] = 2)] = 'UnexpectedEndOfString';
  ScanError2[(ScanError2['UnexpectedEndOfNumber'] = 3)] = 'UnexpectedEndOfNumber';
  ScanError2[(ScanError2['InvalidUnicode'] = 4)] = 'InvalidUnicode';
  ScanError2[(ScanError2['InvalidEscapeCharacter'] = 5)] = 'InvalidEscapeCharacter';
  ScanError2[(ScanError2['InvalidCharacter'] = 6)] = 'InvalidCharacter';
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function (SyntaxKind2) {
  SyntaxKind2[(SyntaxKind2['OpenBraceToken'] = 1)] = 'OpenBraceToken';
  SyntaxKind2[(SyntaxKind2['CloseBraceToken'] = 2)] = 'CloseBraceToken';
  SyntaxKind2[(SyntaxKind2['OpenBracketToken'] = 3)] = 'OpenBracketToken';
  SyntaxKind2[(SyntaxKind2['CloseBracketToken'] = 4)] = 'CloseBracketToken';
  SyntaxKind2[(SyntaxKind2['CommaToken'] = 5)] = 'CommaToken';
  SyntaxKind2[(SyntaxKind2['ColonToken'] = 6)] = 'ColonToken';
  SyntaxKind2[(SyntaxKind2['NullKeyword'] = 7)] = 'NullKeyword';
  SyntaxKind2[(SyntaxKind2['TrueKeyword'] = 8)] = 'TrueKeyword';
  SyntaxKind2[(SyntaxKind2['FalseKeyword'] = 9)] = 'FalseKeyword';
  SyntaxKind2[(SyntaxKind2['StringLiteral'] = 10)] = 'StringLiteral';
  SyntaxKind2[(SyntaxKind2['NumericLiteral'] = 11)] = 'NumericLiteral';
  SyntaxKind2[(SyntaxKind2['LineCommentTrivia'] = 12)] = 'LineCommentTrivia';
  SyntaxKind2[(SyntaxKind2['BlockCommentTrivia'] = 13)] = 'BlockCommentTrivia';
  SyntaxKind2[(SyntaxKind2['LineBreakTrivia'] = 14)] = 'LineBreakTrivia';
  SyntaxKind2[(SyntaxKind2['Trivia'] = 15)] = 'Trivia';
  SyntaxKind2[(SyntaxKind2['Unknown'] = 16)] = 'Unknown';
  SyntaxKind2[(SyntaxKind2['EOF'] = 17)] = 'EOF';
})(SyntaxKind || (SyntaxKind = {}));
var parse2 = parse;
var visit2 = visit;
var ParseErrorCode;
(function (ParseErrorCode2) {
  ParseErrorCode2[(ParseErrorCode2['InvalidSymbol'] = 1)] = 'InvalidSymbol';
  ParseErrorCode2[(ParseErrorCode2['InvalidNumberFormat'] = 2)] = 'InvalidNumberFormat';
  ParseErrorCode2[(ParseErrorCode2['PropertyNameExpected'] = 3)] = 'PropertyNameExpected';
  ParseErrorCode2[(ParseErrorCode2['ValueExpected'] = 4)] = 'ValueExpected';
  ParseErrorCode2[(ParseErrorCode2['ColonExpected'] = 5)] = 'ColonExpected';
  ParseErrorCode2[(ParseErrorCode2['CommaExpected'] = 6)] = 'CommaExpected';
  ParseErrorCode2[(ParseErrorCode2['CloseBraceExpected'] = 7)] = 'CloseBraceExpected';
  ParseErrorCode2[(ParseErrorCode2['CloseBracketExpected'] = 8)] = 'CloseBracketExpected';
  ParseErrorCode2[(ParseErrorCode2['EndOfFileExpected'] = 9)] = 'EndOfFileExpected';
  ParseErrorCode2[(ParseErrorCode2['InvalidCommentToken'] = 10)] = 'InvalidCommentToken';
  ParseErrorCode2[(ParseErrorCode2['UnexpectedEndOfComment'] = 11)] = 'UnexpectedEndOfComment';
  ParseErrorCode2[(ParseErrorCode2['UnexpectedEndOfString'] = 12)] = 'UnexpectedEndOfString';
  ParseErrorCode2[(ParseErrorCode2['UnexpectedEndOfNumber'] = 13)] = 'UnexpectedEndOfNumber';
  ParseErrorCode2[(ParseErrorCode2['InvalidUnicode'] = 14)] = 'InvalidUnicode';
  ParseErrorCode2[(ParseErrorCode2['InvalidEscapeCharacter'] = 15)] = 'InvalidEscapeCharacter';
  ParseErrorCode2[(ParseErrorCode2['InvalidCharacter'] = 16)] = 'InvalidCharacter';
})(ParseErrorCode || (ParseErrorCode = {}));
function modify(text, path, value, options) {
  return setProperty(text, path, value, options);
}
function applyEdits(text, edits) {
  let sortedEdits = edits.slice(0).sort((a, b) => {
    const diff = a.offset - b.offset;
    if (diff === 0) {
      return a.length - b.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    let e = sortedEdits[i];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error('Overlapping edit');
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}

// ../templates/hooks/lib/dogfood.ts
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
function isDogfoodRepo(projectDirectory) {
  if (existsSync(nodePath.join(projectDirectory, 'packages', 'cli', 'templates'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(nodePath.join(projectDirectory, 'package.json'), 'utf8'));
    return pkg.name === 'safeword';
  } catch {
    return false;
  }
}

// codex-plugin/durable-write.ts
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath2 from 'node:path';
function writeDurableFile(path, content, options) {
  const directory = nodePath2.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath2.join(
    directory,
    `.${nodePath2.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const descriptor = openSync(temporaryPath, 'wx', options.mode);
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    options.beforeRename?.();
    durableRename(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
function writeDurableFileExclusive(path, content, options) {
  const directory = nodePath2.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath2.join(
    directory,
    `.${nodePath2.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const descriptor = openSync(temporaryPath, 'wx', options.mode);
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    linkSync(temporaryPath, path);
    let directoryDescriptor;
    try {
      directoryDescriptor = openSync(directory, 'r');
      fsyncSync(directoryDescriptor);
    } finally {
      if (directoryDescriptor !== void 0) closeSync(directoryDescriptor);
    }
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
function durableRename(source, destination) {
  let descriptor;
  try {
    descriptor = openSync(nodePath2.dirname(destination), 'r');
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM', 'EBADF'].includes(code)) throw error;
  }
  try {
    renameSync(source, destination);
    if (descriptor !== void 0) fsyncSync(descriptor);
  } finally {
    if (descriptor !== void 0) closeSync(descriptor);
  }
}

// claude-plugin/asset-integrity.ts
var import_yaml = __toESM(require_dist(), 1);
import { createHash } from 'node:crypto';
function canonicalValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => canonicalValue(item));
  if (value instanceof Map) {
    const entries = [...value];
    if (entries.some(([key]) => typeof key !== 'string')) {
      throw new TypeError('Skill metadata keys must be strings.');
    }
    return Object.fromEntries(
      entries
        .toSorted(([left], [right]) => {
          if (left === right) return 0;
          return left < right ? -1 : 1;
        })
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  throw new TypeError('Skill metadata must contain JSON-compatible values.');
}
function claudeSkillSha256(path, content) {
  if (!/^skills\/[^/]+\/SKILL\.md$/u.test(path)) return void 0;
  const text = content.toString();
  if (Buffer.isBuffer(content) && !Buffer.from(text).equals(content)) {
    throw new TypeError(`Skill is not valid UTF-8: ${path}`);
  }
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
  if (header === null) throw new TypeError(`Skill front matter is missing: ${path}`);
  const document = (0, import_yaml.parseDocument)(header[1] ?? '', {
    uniqueKeys: true,
    version: '1.2',
    schema: 'core',
  });
  if (
    document.errors.length > 0 ||
    document.warnings.length > 0 ||
    !(0, import_yaml.isMap)(document.contents)
  ) {
    throw new TypeError(`Skill front matter is invalid: ${path}`);
  }
  const metadata = canonicalValue(document.toJS({ mapAsMap: true, maxAliasCount: 0 }));
  return createHash('sha256')
    .update(JSON.stringify([metadata, text.slice(header[0].length)]))
    .digest('hex');
}
function claudeAssetMatches(asset, content) {
  if (createHash('sha256').update(content).digest('hex') === asset.sha256) return true;
  if (typeof asset.skill_sha256 !== 'string' || !/^[\da-f]{64}$/u.test(asset.skill_sha256)) {
    return false;
  }
  return claudeSkillSha256(asset.path, content) === asset.skill_sha256;
}

// claude-plugin/cleanup.ts
import { createHash as createHash5, randomUUID as randomUUID3 } from 'node:crypto';
import {
  closeSync as closeSync3,
  constants as fsConstants2,
  existsSync as existsSync6,
  fchmodSync,
  fstatSync as fstatSync2,
  fsyncSync as fsyncSync2,
  ftruncateSync,
  lstatSync as lstatSync4,
  mkdirSync as mkdirSync4,
  openSync as openSync3,
  readFileSync as readFileSync5,
  readSync as readSync2,
  renameSync as renameSync3,
  rmdirSync as rmdirSync2,
  writeSync,
} from 'node:fs';
import nodePath9 from 'node:path';

// cli-protocol/result.ts
var EMPTY_EFFECTS = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: [],
};
function createResult(input) {
  return {
    schemaVersion: 1,
    ok: input.state !== 'failed',
    state: input.state,
    changed: input.changed ?? input.state === 'changed',
    findings: input.findings ?? [],
    effects: { ...EMPTY_EFFECTS, ...input.effects },
    errors: input.errors ?? [],
    recovery: input.recovery ?? [],
    nextActions: input.nextActions ?? [],
    ...(input.exitCode !== void 0 && { exitCode: input.exitCode }),
    ...(input.presentation !== void 0 && { presentation: input.presentation }),
    ...(input.data !== void 0 && { data: input.data }),
  };
}

// claude-plugin/cleanup-target.ts
import { existsSync as existsSync2, lstatSync } from 'node:fs';
import nodePath3 from 'node:path';
function containedClaudeCleanupPath(cwd, relative) {
  if (
    relative === '' ||
    nodePath3.isAbsolute(relative) ||
    relative.split(/[\\/]/u).includes('..')
  ) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  const root = nodePath3.resolve(cwd);
  const target = nodePath3.resolve(root, relative);
  if (!target.startsWith(`${root}${nodePath3.sep}`)) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  return target;
}
function assertSafeClaudeCleanupTarget(cwd, relative) {
  const target = containedClaudeCleanupPath(cwd, relative);
  let cursor = nodePath3.resolve(cwd);
  for (const segment of relative.split(/[\\/]/u)) {
    cursor = nodePath3.join(cursor, segment);
    if (!existsSync2(cursor)) continue;
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Unsafe symlinked Claude cleanup target: ${relative}`);
    }
    if (cursor === target ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`Unsafe non-file Claude cleanup target: ${relative}`);
    }
  }
  return target;
}

// claude-plugin/historical-ownership.ts
import { createHash as createHash2 } from 'node:crypto';

// utils/hooks.ts
function normalizeSafewordHookCommands(value) {
  if (Array.isArray(value)) return value.map(child => normalizeSafewordHookCommands(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (key !== 'command' || typeof child !== 'string') {
        return [key, normalizeSafewordHookCommands(child)];
      }
      for (const executable of ['bun', 'bash']) {
        for (const relative of ['.safeword/hooks/', './.safeword/hooks/']) {
          const prefix = `${executable} ${relative}`;
          if (child.startsWith(prefix)) {
            return [
              key,
              `${executable} "$CLAUDE_PROJECT_DIR"/.safeword/hooks/${child.slice(prefix.length)}`,
            ];
          }
        }
      }
      return [key, child];
    }),
  );
}

// claude-plugin/historical-catalogue.generated.ts
var CLAUDE_HISTORICAL_CATALOGUE = {
  schema_version: 1,
  current: {
    files: {
      '.claude/agents/safeword-retro-filer.md':
        '008fa4b5777834118ba0efd008862df52dd32d3feec2218537d7c90cbfdfd904',
      '.claude/agents/safeword-reviewer.md':
        '13333228aa180c0ff040ccfe4e16058147fadc596b51df0d6d73caeb01755470',
      '.claude/skills/audit/SKILL.md':
        '02c6353beb320c6370788c7845ec193ec08532f05ed6f6174585aa8a68456470',
      '.claude/skills/bdd/DISCOVERY.md':
        '981a3fb25926b8c298b1d5da3dac26d63f6c567406b4017abaa0d07f4e67dc87',
      '.claude/skills/bdd/DONE.md':
        'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
      '.claude/skills/bdd/PLAN_EXECUTION.md':
        '9de74f10759b2bb104e7e27e626e7f7bae97509f9503bc2bfe3b26c755e9d527',
      '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
        '4a5093d7034459c06fe23b4f2960e7244561292becef19eb52ac2908d2c4bce0',
      '.claude/skills/bdd/SCENARIOS.md':
        '1e89aa6a46895858cff252d642dd9f7b5853d0fd7dd314aaa75e2ee6046bcddb',
      '.claude/skills/bdd/SKILL.md':
        '3770f019f5a83fd4ad6dcb2322528595a39545f61cf1106a2f606a8137036d9d',
      '.claude/skills/bdd/SPLITTING.md':
        'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
      '.claude/skills/bdd/TDD.md':
        'be9a433ef452e6a2cd55a963ea997a8cd219574d8cc043705905de9f1b58c476',
      '.claude/skills/bdd/VERIFY.md':
        '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
      '.claude/skills/brainstorm/SKILL.md':
        'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
      '.claude/skills/cleanup-zombies/SKILL.md':
        'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
      '.claude/skills/closeout/SKILL.md':
        '1fcbf06b7acf0e549cad4b964fbde3e4dc31feb601e75516041ec211c1bcb66a',
      '.claude/skills/debug/SKILL.md':
        'fd948df163f18518ba9574a27f585bf187b238dea0cdaa1e6b1d2ea763fbed09',
      '.claude/skills/demand-research/SKILL.md':
        '5912afe5c717c634455ec88b050df6af80ffb994ddd26c55811b2977522a72fc',
      '.claude/skills/elicit/SKILL.md':
        '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
      '.claude/skills/explain/SKILL.md':
        '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
      '.claude/skills/figure-it-out/SKILL.md':
        '18e2b44e9a91562079b3e1f52fcd9f952b5f57a0f0e7647b0273809848a75c0d',
      '.claude/skills/finish-review/REVIEWER.md':
        '7575d91eb96a1c4930c8e68da1f4bb982d052c5e89f75fb38ed6422a8df96562',
      '.claude/skills/finish-review/SKILL.md':
        'fdb8800d140467f1747f7b0ee067137386026003126ff17c00758940766dd07a',
      '.claude/skills/lint/SKILL.md':
        'f8bc868fb10a06ca46a22236309b9f0c3ffbd70eecc024d3c79de8ef0e42fd14',
      '.claude/skills/pr-readiness/SKILL.md':
        '42fc32b8bef9a50d85c5d9ac81dcb3edab91f9d92c3e6bfe842fbabba2eed749',
      '.claude/skills/quality-review/SKILL.md':
        '61f9053cdd8007f2ebfd17684fb18cf8dfd068fbcdfbc85ad7ff7ec565a81461',
      '.claude/skills/refactor/SKILL.md':
        'a51a858fb13b50cbc86789edbde8a39e364b5cdd7d5d3b025d555d90b221760e',
      '.claude/skills/retro-filer/SKILL.md':
        'c437336466eedacbac427d85841e6137757a4d81864fefc9317569412c0ebc78',
      '.claude/skills/retro/SKILL.md':
        'da1244dd4e210480e3754763b982b1f9614c493b9534ea03151a9aafbdd89adb',
      '.claude/skills/review-spec/SKILL.md':
        'bccfacb85f2ffb865572a3e56a6b0807a7de98f8de89ee143dd049ede1ae82fb',
      '.claude/skills/self-review/SKILL.md':
        '7ecb6e4475627e703d09e67c377d70b83acc4e32fa8ad41b6dd34174381b46cc',
      '.claude/skills/spike/SKILL.md':
        '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
      '.claude/skills/tdd-review/SKILL.md':
        'ae59212a4d368359c3144bde65bb18caaa02fb15590ca72398f15ad507679c70',
      '.claude/skills/testing/SKILL.md':
        'fe43d03ffe4e39393def44e60a2b88a5f3c70faa878e5e3323f2a22f18470686',
      '.claude/skills/ticket-system/SKILL.md':
        '5a8ce171c60dc7ab07d641dc66d43ae3730d1a2401df86a02250ce82cf53a800',
      '.claude/skills/verify/SKILL.md':
        'd6b1f8cfa6ad1ccc5fd84a8b7f96cf3a13e13561088eb1de9a5b0ee5045759c5',
    },
    hook_files: {
      '.safeword/hooks/post-tool-bypass-warn.ts':
        'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
      '.safeword/hooks/post-tool-dependency-readiness.ts':
        '0142957ea227b630a5ab17d0cee2d6ff2c6df24e7ca3f4bd7a57dbf6940060be',
      '.safeword/hooks/post-tool-lint.ts':
        'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
      '.safeword/hooks/post-tool-quality.ts':
        '21a850043772895828c0d75de6d7735bc5566da9711f2ed1eac6ecd8c8cbe5db',
      '.safeword/hooks/post-tool-skill-nudge.ts':
        'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
      '.safeword/hooks/post-tool-sync-learnings.ts':
        'de5f52c221b2f029841beded78d65af80217949072a99c2790d503f492528290',
      '.safeword/hooks/post-tool-work-log.ts':
        'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
      '.safeword/hooks/pre-tool-architecture-stage.ts':
        'e57bfeb13ccb403159fc8b115122937eaf3d9ca808f2ec6c8c39632fb3a4d679',
      '.safeword/hooks/pre-tool-config-guard.ts':
        '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
      '.safeword/hooks/pre-tool-dependency-readiness.ts':
        '32b7dc3cd73b8a0361625489238ce88bff32ce01ea27ffcec65d39ceafcb8fdb',
      '.safeword/hooks/pre-tool-git-bare-fix.sh':
        '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
      '.safeword/hooks/pre-tool-quality.ts':
        '3e2071275815d93ca154aa0af8d0b766087f3b4824b31fc511dd62112e7369dc',
      '.safeword/hooks/pre-tool-stale-main.ts':
        'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
      '.safeword/hooks/prompt-questions.ts':
        '9ab95529d1c7ca2ffc1a1303c4f08dc55e35e1e49bd951ca917dfbdf13a95a39',
      '.safeword/hooks/prompt-retro-nudge.ts':
        '78353d6f47adb0ed9969e83b40429d5792a98789dff67ec0bc4d5a024b1da457',
      '.safeword/hooks/prompt-timestamp.ts':
        'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
      '.safeword/hooks/session-architecture-heal.ts':
        '142c5a5358d57c9a587019f6e37fe84ed604638d1963e1c28eea12db2a8439f3',
      '.safeword/hooks/session-author-model.ts':
        '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
      '.safeword/hooks/session-auto-upgrade.ts':
        '51cb48954d5b6154d1b4f831f9689fc5044cc8abf6aa9eb664fcddbf6fa859c0',
      '.safeword/hooks/session-bun-check.sh':
        '47e97a2f787228347213521d8391ab6b001e19270aed8e2795f13d6ea0603c29',
      '.safeword/hooks/session-cleanup-quality.ts':
        'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
      '.safeword/hooks/session-compact-context.ts':
        '4810e508b3ef79e162c6e74e169e24f8eb7ae7980549ba3f53e640424ae10773',
      '.safeword/hooks/session-dependency-readiness.ts':
        '295d14c5a3d8112b01259cf89ce718144a568e62e0baf5aaa19eca3fcfdc50ff',
      '.safeword/hooks/session-lint-check.ts':
        '6d8e5819bd52208799089d19bfdbd569fc46b9d518df4c45ab2c3b605d9647dc',
      '.safeword/hooks/session-reply-format.ts':
        '41f7578e93188d5efacdd9ecbf29f72753a6fe98bca71fe321c61f547aeb8532',
      '.safeword/hooks/session-safeword-context.ts':
        '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
      '.safeword/hooks/session-start-reentry.ts':
        'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
      '.safeword/hooks/session-version.ts':
        'c6160a3ea0ef65345c89b3c1dcf5a4177a408d94ab7efda82d86f9d455815c64',
      '.safeword/hooks/stop-quality.ts':
        '8720cf42580341120d2087be5bb8854bd444c169241ad5e51bc118fd53848671',
      '.safeword/hooks/stop-reentry.ts':
        'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
      '.safeword/hooks/stop-retro-filing.ts':
        'ae5693347a530547701c7fd9efd9d76ee4f690cd235b7e28b409d59d6090417d',
      '.safeword/hooks/stop-retro.ts':
        'ecdb55e277a4188e5daf1c9a9de3f5e28bed724a14064e374eb4db10a9d0921e',
      '.safeword/hooks/stop-self-report.ts':
        'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
    },
    hooks: {
      SessionStart: [
        '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
        '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
        '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
        '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
        '1748d249b1ef227d313b5da2e098dd26c38b78a1de5bb8f6f236ba567420a17d',
        '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
        'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
        '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
        '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
        'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
        'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
      ],
      UserPromptSubmit: [
        'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
        '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
        'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
      ],
      Stop: [
        'b1a641275edfca16f26bdfd99f9f83f832373ca1da813d96518f7d713b061ae0',
        '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
        '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
        '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
        'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
      ],
      PreToolUse: [
        'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
        '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
        'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
        'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
        '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
        '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
        '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
        '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
      ],
      PostToolUse: [
        '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
        '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
        '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
        '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
        '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
        '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
        'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
      ],
      SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
    },
  },
  releases: {
    '0.68.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          'd0adabee189a52adac5bb79ef92e8fc8201cf69d89680ec1db96385722527aa1',
        '.claude/skills/audit/SKILL.md':
          '66de01380bd88cbc95b26888f23b70363a640262b6dab138531085be8194ca24',
        '.claude/skills/bdd/DISCOVERY.md':
          'b207684a7615f83df08e68d9e13660b2745e247e18f611bc9b606904bef4319b',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/SCENARIOS.md':
          '1be1365aa5dc1302bf10c5d74a6f50e28e28555b83e963e7257029d92a4910f4',
        '.claude/skills/bdd/SKILL.md':
          '75ed76b99df6fb818e3a63d9428d87b7228a2f136218d74bf1dc666b711be8cd',
        '.claude/skills/bdd/SPLITTING.md':
          '17367d157ebde2b2f9da04798615981527fe0cbb0da0fd5770818fd17adb88d8',
        '.claude/skills/bdd/TDD.md':
          '4f11431c53f377f309a2ee57d051c1f59557244ff92c3c0e07226e52f38e3ac1',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          '4fb21183502edd0806dc4a520b95b12c161294e69150f8c32f719095fc2e5f44',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '14f697e93d3f287caf5e2c0aa49b6ef20ee73da2faea7f6dc3f6eef7f79ee049',
        '.claude/skills/lint/SKILL.md':
          'd26d0f631e7fa8653e9fa110e139584049796979ee1638e3601059906cee6c78',
        '.claude/skills/quality-review/SKILL.md':
          '6c0e4891fb70e0371cc2268d671d8d802c46a08c986032ae55493d803d5b6dfb',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro/SKILL.md':
          'dfa8182df00d3d3935e475ec34de8b3f7fba2819065261bb8e595147434a1aeb',
        '.claude/skills/review-spec/SKILL.md':
          'cd61d4a6b22164cf1d14479553ada2502aacb8a36f137e59593ffdbd5540a91a',
        '.claude/skills/self-review/SKILL.md':
          'c6502e0e3a067e4ffbe641e09f9de224d538bede7695c7f9b829acb01497e3ac',
        '.claude/skills/tdd-review/SKILL.md':
          'b190130a5bdf3ce2a47fd955c20835db5d75911095b422ef0aecd4c97fa3df2f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '1531780c2e04a8a3bc9fd5b48735cc6b4a4b2faac59337a93975136b2c200eaa',
        '.claude/skills/verify/SKILL.md':
          '23900f59b8ba03fd4d5a0d49fbbe03f6fe54364d6eef009870e9a5694b97cd12',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          'cc40e780a91da05a5b75eff4fc9385cefed69a13e71550cecf89293228a9a4eb',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'b4a1565cb734efc5a4209dee04402fab88a0bd0b27b3f4877df9bd91e58ee272',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '5186a34d7ab8a79ceb069ec5342f360d02db6c0b62c626503e53d7ea0f49b0f5',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '1fbb02f389eb1716d95f9ac91a75589894dbfbc0e030a91427b3b86e932e9002',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '029f3be85a3adb23aed34075a67ec49e9e0cac48c0c0dff325544d9fe6651af0',
        '.safeword/hooks/prompt-retro-nudge.ts':
          'e434a748999ac32bc2ed09db019c7def95b67efb2cedb84a563a72ff2dbb4dfd',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '0fe2e7f68fdc30cea429e4d5b58d02a4430467f5508cde040fa620413f14e339',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '8522c9213d00378139751028ce37875e5b005bfa15d56da6698b25005a0ca792',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'ec44f19d57a0750d03816d146f64417bc1dd3f1edf4bb03d9386e9bb4a9f5583',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '7c96bf0f152c6864c50787d62859172a316d19e8ed730fec5106ea7d41b2326d',
        '.safeword/hooks/stop-reentry.ts':
          'cdf258da12fae6844ec9334cfa61521f5cc6a9b4cb0dbadb08c4ba798df7403e',
        '.safeword/hooks/stop-retro-filing.ts':
          '8938c5fa7da5ea232eb5a45526b207727e676cae2eb6f862104f8fad85d9db20',
        '.safeword/hooks/stop-retro.ts':
          '406496aa4c461aeeda7d659a4cc28a2c3f9e8d08596c3c74f1af8e8248275cbd',
        '.safeword/hooks/stop-self-report.ts':
          'cbe0fabdd2f42070a7f5277c77d18bcabad81f4c8ac1c18e9b459a7e111cb483',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.69.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          'd0adabee189a52adac5bb79ef92e8fc8201cf69d89680ec1db96385722527aa1',
        '.claude/skills/audit/SKILL.md':
          '5d532b2980976d758927ebf6e66a5e9022d83a421c936c378bca1391aa5d58a4',
        '.claude/skills/bdd/DISCOVERY.md':
          '9850364b48f66dc207cb9c8058f7564f70a5ac331a4bd188d71f3215c22d3dc4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'ae8fd9fe228b8005606414c339342a8ba15331511d1b6f90eaca7e608bf08c53',
        '.claude/skills/bdd/SCENARIOS.md':
          '59c07c9ad8914a60d879450e3ffe54cd79b199a652b70f7fa6156c7c87c27b60',
        '.claude/skills/bdd/SKILL.md':
          'ee1fbce1054cab1fd0263341925c546c0f7070afdd2dbc1b6d974ae02188cf8b',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '337c1c44e2b961da26de2a776fe599557b2ff2f606059b15fb5b948a1fa54c20',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          '4fb21183502edd0806dc4a520b95b12c161294e69150f8c32f719095fc2e5f44',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '14f697e93d3f287caf5e2c0aa49b6ef20ee73da2faea7f6dc3f6eef7f79ee049',
        '.claude/skills/lint/SKILL.md':
          'd26d0f631e7fa8653e9fa110e139584049796979ee1638e3601059906cee6c78',
        '.claude/skills/quality-review/SKILL.md':
          '100ebdf18b3bd4cdd8ef683c2cddf9f9bcd9e25dc82ef9f685f1e8dbbc630703',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro/SKILL.md':
          'dfa8182df00d3d3935e475ec34de8b3f7fba2819065261bb8e595147434a1aeb',
        '.claude/skills/review-spec/SKILL.md':
          'f643918f0da9c2b9d2c5b4675fd0096e441f1315c58f7b0d236b0ac6a1e71cbb',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/tdd-review/SKILL.md':
          '4243eec9ddf77780028b8aa19f362ced4fa51673575feeccd7fa658eb0bc6080',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          'f8312db9cf377906cef931e5e2a63917e76cffed5626c57dbf4a3239e7b0825a',
        '.claude/skills/verify/SKILL.md':
          '23900f59b8ba03fd4d5a0d49fbbe03f6fe54364d6eef009870e9a5694b97cd12',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          'cc40e780a91da05a5b75eff4fc9385cefed69a13e71550cecf89293228a9a4eb',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'b4a1565cb734efc5a4209dee04402fab88a0bd0b27b3f4877df9bd91e58ee272',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '5186a34d7ab8a79ceb069ec5342f360d02db6c0b62c626503e53d7ea0f49b0f5',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '8278457053db9a25f7c07b62d52836d3d60e9f092b3650013ee1b1ea6b044fb1',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '395cfc48c6c32bc3825e00ad30083ec647404b32386afd897a9af03be628ed65',
        '.safeword/hooks/prompt-retro-nudge.ts':
          'e434a748999ac32bc2ed09db019c7def95b67efb2cedb84a563a72ff2dbb4dfd',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '0fe2e7f68fdc30cea429e4d5b58d02a4430467f5508cde040fa620413f14e339',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '8522c9213d00378139751028ce37875e5b005bfa15d56da6698b25005a0ca792',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'ec44f19d57a0750d03816d146f64417bc1dd3f1edf4bb03d9386e9bb4a9f5583',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          'eb251bb97bf1fd70776d6217d70da08823479b0c3e58cadc1a41c56ad0b09f89',
        '.safeword/hooks/stop-reentry.ts':
          'cdf258da12fae6844ec9334cfa61521f5cc6a9b4cb0dbadb08c4ba798df7403e',
        '.safeword/hooks/stop-retro-filing.ts':
          '8938c5fa7da5ea232eb5a45526b207727e676cae2eb6f862104f8fad85d9db20',
        '.safeword/hooks/stop-retro.ts':
          '406496aa4c461aeeda7d659a4cc28a2c3f9e8d08596c3c74f1af8e8248275cbd',
        '.safeword/hooks/stop-self-report.ts':
          'cbe0fabdd2f42070a7f5277c77d18bcabad81f4c8ac1c18e9b459a7e111cb483',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.70.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'ae8fd9fe228b8005606414c339342a8ba15331511d1b6f90eaca7e608bf08c53',
        '.claude/skills/bdd/SCENARIOS.md':
          '379cb1f3ba62bfdb98c1f5383d7f460ac730371a34030b8879ab999b6e548585',
        '.claude/skills/bdd/SKILL.md':
          'ee1fbce1054cab1fd0263341925c546c0f7070afdd2dbc1b6d974ae02188cf8b',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          'e342a8fec91c403383f5ebce5c31c9eb4db555e77e56a6453b5b8ea0b97c118c',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.71.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'a86b45f577e530ce8ded59159960fbdba61243d36d61609bdbc52634e7613136',
        '.claude/skills/bdd/SCENARIOS.md':
          '1600df799059ea9d399f6a7bdd16c0f03be2cdd1f1f743595c350600a5d9ce5b',
        '.claude/skills/bdd/SKILL.md':
          '0d1f9498f74a39099cc61e578867226bcb149c96d09699ca7bafbc571873accb',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/spike/SKILL.md':
          '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          '1980ba580e89d5c0ec1d47a6ff60aefd9d12a19922efbae18da61333a97bf13e',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.71.0-rc.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'ae8fd9fe228b8005606414c339342a8ba15331511d1b6f90eaca7e608bf08c53',
        '.claude/skills/bdd/SCENARIOS.md':
          '379cb1f3ba62bfdb98c1f5383d7f460ac730371a34030b8879ab999b6e548585',
        '.claude/skills/bdd/SKILL.md':
          'ee1fbce1054cab1fd0263341925c546c0f7070afdd2dbc1b6d974ae02188cf8b',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          'e342a8fec91c403383f5ebce5c31c9eb4db555e77e56a6453b5b8ea0b97c118c',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.71.0-rc.1': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'ae8fd9fe228b8005606414c339342a8ba15331511d1b6f90eaca7e608bf08c53',
        '.claude/skills/bdd/SCENARIOS.md':
          '379cb1f3ba62bfdb98c1f5383d7f460ac730371a34030b8879ab999b6e548585',
        '.claude/skills/bdd/SKILL.md':
          'ee1fbce1054cab1fd0263341925c546c0f7070afdd2dbc1b6d974ae02188cf8b',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          '1980ba580e89d5c0ec1d47a6ff60aefd9d12a19922efbae18da61333a97bf13e',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.71.0-rc.2': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'a86b45f577e530ce8ded59159960fbdba61243d36d61609bdbc52634e7613136',
        '.claude/skills/bdd/SCENARIOS.md':
          '1600df799059ea9d399f6a7bdd16c0f03be2cdd1f1f743595c350600a5d9ce5b',
        '.claude/skills/bdd/SKILL.md':
          '0d1f9498f74a39099cc61e578867226bcb149c96d09699ca7bafbc571873accb',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/spike/SKILL.md':
          '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          '1980ba580e89d5c0ec1d47a6ff60aefd9d12a19922efbae18da61333a97bf13e',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.71.0-rc.3': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '562f68cdec41156ec1ea1a74a4041ddef225b34d66f29b87e34363c6952cffe9',
        '.claude/skills/audit/SKILL.md':
          '2653e4439921c4b53338159345001927df949d872c065c6c99aca5952c3444d4',
        '.claude/skills/bdd/DISCOVERY.md':
          'bab275004297553f0d16f65a7c6d2313c402886acd5f1ae2f4e6a1469dd1d1f4',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          'a86b45f577e530ce8ded59159960fbdba61243d36d61609bdbc52634e7613136',
        '.claude/skills/bdd/SCENARIOS.md':
          '1600df799059ea9d399f6a7bdd16c0f03be2cdd1f1f743595c350600a5d9ce5b',
        '.claude/skills/bdd/SKILL.md':
          '0d1f9498f74a39099cc61e578867226bcb149c96d09699ca7bafbc571873accb',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '3263c9b2b0f56d38080b6552e29ae26232d7f5a38085d883fff3593e84f55636',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '269b5236690afc80a3983cae7735d870500a6e51562ce39696030846159f764b',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '69784daf36495f00611e0057b6cc52a0ce0a0be4744c96d5ee37f784251cfb52',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          'c029ae859b5a2e7ae72bf47351695e1dc2d371d08874f323b6c8edaf79673b29',
        '.claude/skills/self-review/SKILL.md':
          '8536a465238363c25aaadb971745d2504e14552f6c2583a17691e4102b17b5a3',
        '.claude/skills/spike/SKILL.md':
          '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          '1980ba580e89d5c0ec1d47a6ff60aefd9d12a19922efbae18da61333a97bf13e',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          '9ad40afef962e0133eb80d958f21c2c2e8e5d692c59ed5c7a325914ad05812aa',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '6a9db8288c41ec3e66c0fc8281cd752ffb61ed017d44f952416384a0c8d339ae',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '0a6cc9568d795b1da37a06416061be0fe2bdc4724f578b3e6a94bd999edded7e',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '351495796bebcc97b031043ec6d17ce801be121a5fe76c81535f7b2eab6802d5',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '65ddec922bb677b58b82e96567624aabb15f2deba77ce3ce8af5ca73ef6c928a',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '0b30324e00532f095ded4f711d06f3dd4c25737beea29f4432690e91fed8c9b9',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '7f8d11fe57ba4ea86c71eb3c6b7e44912501076e32eaf63aff8c802aaa1850bf',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
    '0.72.0': {
      files: {
        '.claude/agents/safeword-retro-filer.md':
          '56ae79a72b5947b5a2ed319685232aac55d42deaf74decac11499b7082f2804f',
        '.claude/skills/audit/SKILL.md':
          '784da329a70fe34b6e3a477b50caaee0d6bbfc1a3ed1d33b213fd9fb55346f4d',
        '.claude/skills/bdd/DISCOVERY.md':
          '057b81e87cf4857c780e01ebebdc278485d3179c249335fbc38264784f0587bb',
        '.claude/skills/bdd/DONE.md':
          'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
        '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
          '96ca374881b14d59631583c82b73d73a27a98e86ea93b38f8a630256b41e7814',
        '.claude/skills/bdd/SCENARIOS.md':
          '1600df799059ea9d399f6a7bdd16c0f03be2cdd1f1f743595c350600a5d9ce5b',
        '.claude/skills/bdd/SKILL.md':
          '7912523b42a4637ad67306b03bee00f711437b3f6aa63eff03359bc3f2d938a8',
        '.claude/skills/bdd/SPLITTING.md':
          'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
        '.claude/skills/bdd/TDD.md':
          '6e33c42b4a12796de0f542f0317715b58fb16c22bf6797303563b40518d34357',
        '.claude/skills/bdd/VERIFY.md':
          '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
        '.claude/skills/brainstorm/SKILL.md':
          'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
        '.claude/skills/cleanup-zombies/SKILL.md':
          'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
        '.claude/skills/closeout/SKILL.md':
          'd612ee520e5d36ffc29d46e02e66c94b25d4d079bf9912d72f436830e317b460',
        '.claude/skills/debug/SKILL.md':
          '730bc2878af36eaaf7e91d34ab76c3bcd8d05820753eed42582d70c4822daaf5',
        '.claude/skills/elicit/SKILL.md':
          '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
        '.claude/skills/explain/SKILL.md':
          '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
        '.claude/skills/figure-it-out/SKILL.md':
          '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
        '.claude/skills/lint/SKILL.md':
          '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
        '.claude/skills/quality-review/SKILL.md':
          '641a12f6df44413424e247501fb22030b095336361bea1df0f1bbcbf5a6ae9ae',
        '.claude/skills/refactor/SKILL.md':
          'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
        '.claude/skills/retro-filer/SKILL.md':
          '85d200d86d8b20f17b99209b12de7a12cdd28713de98519e3febc3373d798519',
        '.claude/skills/retro/SKILL.md':
          '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
        '.claude/skills/review-spec/SKILL.md':
          '8aa2949e1f1197a77784770690a2b834acc0c95d30ef1adc61edd1bfd494eeed',
        '.claude/skills/self-review/SKILL.md':
          '51bccc782884dc2ef6171465909df2726875bb308d0004fd2bbed13e51208ffc',
        '.claude/skills/spike/SKILL.md':
          '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
        '.claude/skills/tdd-review/SKILL.md':
          'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
        '.claude/skills/testing/SKILL.md':
          'e361b302f7a3f71ca6fdc30d65dbc6fc20bfeedaa012c489c3af96c20d1332d5',
        '.claude/skills/ticket-system/SKILL.md':
          '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
        '.claude/skills/verify/SKILL.md':
          'e412319f4df946e146a377fb1581f4a6cc69faee92b4c25129593787506a2dd9',
      },
      hook_files: {
        '.safeword/hooks/post-tool-bypass-warn.ts':
          'f7f9d408e58e2f3f223b9a2a94447560671dcdc7e7bac8d35e786417337fce8a',
        '.safeword/hooks/post-tool-dependency-readiness.ts':
          '21bc470f5f84f1ad11f7d757738ca09f1a2fbd509ecf20beea7d77e1a46f93f4',
        '.safeword/hooks/post-tool-lint.ts':
          'f563b8f7ceebbed051d261ed87ed908199555274cdcc795ba0619f78d07876fa',
        '.safeword/hooks/post-tool-quality.ts':
          '15563ef325306e9ed63db14a15129b68f602dbe3648989eb70cab8f61a6da0ab',
        '.safeword/hooks/post-tool-skill-nudge.ts':
          'a50c50975135af4183d52056b81234c2feb989e0ca3396fc5bee91662876bfe4',
        '.safeword/hooks/post-tool-sync-learnings.ts':
          'bc272acc87b1d52db960b2c96ac36ea553e21fdf161122312b74cd61157acb82',
        '.safeword/hooks/post-tool-work-log.ts':
          'f8816f7799c564006aad2b6469fbd4d04a51ba2ca3d6f3bdbe93bb03d17b6978',
        '.safeword/hooks/pre-tool-architecture-stage.ts':
          '4d0c4506dc25d3988bf307eabdc8b3f65cf0712f4ed41cbc05d459222f472b8c',
        '.safeword/hooks/pre-tool-config-guard.ts':
          '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
        '.safeword/hooks/pre-tool-dependency-readiness.ts':
          '5b1f06f286f7d2ec6816ed923ca37aed7115e1b888b214b7c3d0ea19f819874a',
        '.safeword/hooks/pre-tool-git-bare-fix.sh':
          '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
        '.safeword/hooks/pre-tool-quality.ts':
          '29f5f59378aa21c020ed2c182549628bf6ccf8f8417d74abede79c5353c26c5f',
        '.safeword/hooks/pre-tool-stale-main.ts':
          'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
        '.safeword/hooks/prompt-questions.ts':
          '57182cccb8550bb2b585c27672bc9bfef56f4688d0afc1afc18bf52661b7c2a6',
        '.safeword/hooks/prompt-retro-nudge.ts':
          '0800c8949b5cf2671173816d45e857f1759329e27b33fda7c7b16ecd54a9398a',
        '.safeword/hooks/prompt-timestamp.ts':
          'd7939e98528717fed556adf65dcb9fd3c24fac530ba76be2db9c5faebbac27f3',
        '.safeword/hooks/session-architecture-heal.ts':
          '76f1b55c3173d3ebc2a819a41e06a814a57d78b94faf30108afed439dc7ce747',
        '.safeword/hooks/session-author-model.ts':
          '9cead0101141497aec277d6609ab1bfcbf7048cc02650e7f284ac15141eaf291',
        '.safeword/hooks/session-auto-upgrade.ts':
          '51cb48954d5b6154d1b4f831f9689fc5044cc8abf6aa9eb664fcddbf6fa859c0',
        '.safeword/hooks/session-bun-check.sh':
          '7365954b09c157e45e213981ebd0b609b97b81fb3e6b6b73571e23e459ef09ef',
        '.safeword/hooks/session-cleanup-quality.ts':
          'b43a169e86d240ecc12ece40d5375a84c59db6dc9708c91849a55038144736a2',
        '.safeword/hooks/session-compact-context.ts':
          '5acc8a0359a3ea4c9b41bb37b9a539676c83531c3836c919520b4fc4b7c050b1',
        '.safeword/hooks/session-dependency-readiness.ts':
          '28c0268265f0dcbce04844faac5cbc9f9903ac4f8fa893a470ca6b102498613f',
        '.safeword/hooks/session-lint-check.ts':
          '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
        '.safeword/hooks/session-safeword-context.ts':
          '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
        '.safeword/hooks/session-start-reentry.ts':
          'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
        '.safeword/hooks/session-version.ts':
          '60e487ff1b29ee6bf7ace671a39aad3ab7f3569a8b5f7694ba13c8f8720862af',
        '.safeword/hooks/stop-quality.ts':
          '9355b30aa20b3087c99332be4162ab98eec3c7b790ded0df7ac91d1bf2d2e58c',
        '.safeword/hooks/stop-reentry.ts':
          'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
        '.safeword/hooks/stop-retro-filing.ts':
          '89346f357126706623237a0c79c0ea5947b6b95493a7689b1aee5a4546e034de',
        '.safeword/hooks/stop-retro.ts':
          '56cad026d6fb399c910c348623d92fe459011fb58b53ba9f18b861dd0f80caa9',
        '.safeword/hooks/stop-self-report.ts':
          'baf9f946918f74d2ec2916024c6a5e9818b5468a45ac177bbdb73443f66399e0',
      },
      hooks: {
        SessionStart: [
          '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0',
          '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0',
          '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff',
          '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007',
          '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33',
          'eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d',
          '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c',
          '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f',
          'f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923',
          '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d',
          'd3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8',
        ],
        UserPromptSubmit: [
          'c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082',
          '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c',
          'da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80',
        ],
        Stop: [
          'b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640',
          '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b',
          '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60',
          '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722',
          'fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429',
        ],
        PreToolUse: [
          'ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3',
          '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc',
          'b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20',
          'cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9',
          '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160',
          '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316',
          '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e',
          '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d',
        ],
        PostToolUse: [
          '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088',
          '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc',
          '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe',
          '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59',
          '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e',
          '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c',
          'ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823',
        ],
        SessionEnd: ['bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f'],
      },
    },
  },
  hook_entries: {
    '02e010df74c5114d87b115f0252fbda3a5dd8610fb5e7177c116a4cc9ea8c088': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-lint.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '1161ed35ca2d43cccf62773b926add8982e4bc8d375412a8ba5e9ca99c34241e': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-sync-learnings.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '167b3fe8cf355f66018c6c0f774b6d2e73ebecc81d4659701f9bfe45e1001722': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-retro-filing.ts',
          type: 'command',
        },
      ],
    },
    '1748d249b1ef227d313b5da2e098dd26c38b78a1de5bb8f6f236ba567420a17d': {
      hooks: [
        {
          command:
            'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-reply-format.ts --agent=claude',
          type: 'command',
        },
      ],
    },
    '2d36e07ce195e76fa77dce0c3365269bcdd686d5130c39b9ba81b6b634e0b316': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-architecture-stage.ts',
          if: 'Bash(git commit*)',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    '2e0ec239ca638a9b4621493ef341d382054473fdac613fcbb876420a1b6fde59': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-bypass-warn.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '4537a8fa49d8fc6cb7b604789be118adc89ec6b69c56a2d2753c26ba408bb0fe': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-skill-nudge.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '49e2bc8bce947a8c427873963acab1bc872b11cda942e6a6617ec5af4d30a0cc': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-quality.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash',
    },
    '4d8bebe51f8e0160cbd954c539c217793362e4878dffbdb7b5a1cc527db4f33e': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-stale-main.ts',
          if: 'Bash(git checkout*)',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    '5fbab3be700e9ad4cd38aef9711316c1dc05fb202c818c5446c0cf1e9009b160': {
      hooks: [
        {
          command: 'bash "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-git-bare-fix.sh',
          if: 'Bash(git *)',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    '6208c493671fc67d1cd136ddd0a51de62175efce3498b902085373bc0ccc0db0': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-dependency-readiness.ts',
          type: 'command',
        },
      ],
    },
    '6988371a3718b3e8106f6758c4e71b180facb47eb4c6a9726a2e5318737feb60': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-self-report.ts',
          type: 'command',
        },
      ],
    },
    '6a8b982c578e094444df4106084135358672b402f3dbed42d0860cdff163cf0c': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/prompt-questions.ts',
          type: 'command',
        },
      ],
    },
    '7a318d747884bb53ecc1d4578c79772ececfb786ae3c9cba823cafb3095a743c': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-work-log.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '8181faff2ffc1e802bb47d826b3649c94c83dbe33b22df9f60ed62275e66114d': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-stale-main.ts',
          if: 'Bash(git switch*)',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    '82821d39ad90cc6d81c5ac22a97e68ecafbba6cf1281ae1c875d0503a26f6d3f': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-author-model.ts',
          type: 'command',
        },
      ],
    },
    '83138a5df5610b37cb9dfd291b69fada684446e4dbdda0ddbab5a7e1dbf7c1ff': {
      hooks: [
        {
          asyncRewake: true,
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-auto-upgrade.ts',
          type: 'command',
        },
      ],
    },
    '839788553e5e540ab64361a8075fe397ecd46117cbef48696f6faba3648d1d2d': {
      hooks: [
        {
          command:
            'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-safeword-context.ts --agent=claude',
          type: 'command',
        },
      ],
      matcher: 'compact',
    },
    '8c7cf4fdb7cbecebcb4a9f3ec16cdf6aa777c1dfcf7110cb432798c86e31276c': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-architecture-heal.ts',
          type: 'command',
        },
      ],
    },
    '8d16ca09ac8148e614366f91b2f3dec1cef6925f96a17eacd24706269356978b': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-reentry.ts',
          type: 'command',
        },
      ],
    },
    '921a0c53ce98ef7d84b1c6e4607f4703d1bda419fb6c813d0ed2925b0f16a9cc': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-quality.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    '98ed934c8e5cef5e3f94332b56968c980fde50fc79603e4dfe80ecaca49d77c0': {
      hooks: [
        {
          command: 'bash "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-bun-check.sh',
          type: 'command',
        },
      ],
    },
    '9dc99ba11055242f20b4f3c8944a382c2506931dcbdb6f99d97668b0afd70007': {
      hooks: [
        {
          command:
            'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-safeword-context.ts --agent=claude',
          type: 'command',
        },
      ],
    },
    '9ecd49f0d9143ba458f3db192dbe811184c6666ea3e74f9bf1d34d310dd0ba33': {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-version.ts',
          type: 'command',
        },
      ],
    },
    ada31831d8fc49b5b33bf72a5f0d47d883ca142a6f522fa2bbfff347174c07f3: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-dependency-readiness.ts',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    b1a641275edfca16f26bdfd99f9f83f832373ca1da813d96518f7d713b061ae0: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-quality.ts',
          timeout: 2400,
          type: 'command',
        },
      ],
    },
    b8663c68fcb3cfa99a5eb61f521ac6ecca05aa4ff8d50f2502b2585845cff640: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-quality.ts',
          type: 'command',
        },
      ],
    },
    b999d2b8223d74226377cc18ba5ae8e166586195c72208758ff115b91e2dce20: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-quality.ts',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    bdd68a3e1c4e47e615b9acd472a88bb884fdc38d85bd418e761b91682b339c7f: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-cleanup-quality.ts',
          type: 'command',
        },
      ],
    },
    c35e7daf8dce6e9de2ed10cb1793bc88096b6da9625b5901f3a6e944b5337082: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/prompt-timestamp.ts',
          type: 'command',
        },
      ],
    },
    cfbb47df37dd5dabe4c53b4ed922011b53f96310a3c7092f953bc34acae0cbd9: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-config-guard.ts',
          type: 'command',
        },
      ],
      matcher: 'Edit|Write|MultiEdit|NotebookEdit',
    },
    d3086b18bd08c1fc5779951d6d2162bf15ca2ccfc9ac689b7f38007bf27a1bc8: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-compact-context.ts',
          type: 'command',
        },
      ],
      matcher: 'compact',
    },
    da9392c2520f6de0f4f5a649a58b578b7115f3a06ae6fb161bc71da58913ec80: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/prompt-retro-nudge.ts',
          type: 'command',
        },
      ],
    },
    eaaf5018219f6868c77b5e78e40363a77fd3cd18f6d92890677196616d7ef97d: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-lint-check.ts',
          type: 'command',
        },
      ],
    },
    ebbc830c0c899a3ec0ab44564ae1db5e9566a2753b71e818bcd906c9bfdad823: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/post-tool-dependency-readiness.ts',
          type: 'command',
        },
      ],
      matcher: 'Bash',
    },
    f859fd42b853152ccfb4352e25d9b0c5026ab169d5c20291422395988e22e923: {
      hooks: [
        {
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-start-reentry.ts',
          type: 'command',
        },
      ],
    },
    fb64b381e9af34f6a19277b572e46f9069266073c12e93e6851893a6a34b5429: {
      hooks: [
        {
          async: true,
          command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/stop-retro.ts',
          type: 'command',
        },
      ],
    },
  },
};

// claude-plugin/historical-ownership.ts
function sha256(content) {
  return createHash2('sha256').update(content).digest('hex');
}
function compareKeys(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => compareKeys(left, right))
      .map(([key, child]) => [key, stable(child)]),
  );
}
function historicalCatalogueDigest() {
  return sha256(JSON.stringify(CLAUDE_HISTORICAL_CATALOGUE));
}
function acceptedReleases() {
  return [
    CLAUDE_HISTORICAL_CATALOGUE.current,
    ...Object.values(CLAUDE_HISTORICAL_CATALOGUE.releases),
  ];
}
function acceptedHookFingerprints(event) {
  return acceptedReleases().flatMap(release => release.hooks[event] ?? []);
}
function isAcceptedHistoricalFile(relativePath, content) {
  const digest2 = sha256(content);
  return acceptedReleases().some(release => release.files[relativePath] === digest2);
}
function isAcceptedHistoricalHookFile(relativePath, content) {
  const digest2 = sha256(content);
  return acceptedReleases().some(release => release.hook_files[relativePath] === digest2);
}
function isAcceptedHistoricalHook(event, entry) {
  const canonical = JSON.stringify(stable(normalizeSafewordHookCommands(entry)));
  const fingerprint = sha256(canonical);
  return acceptedHookFingerprints(event).includes(fingerprint);
}
function cataloguedClaudeLegacyPaths() {
  return [...new Set(acceptedReleases().flatMap(release => Object.keys(release.files)))].toSorted(
    (left, right) => left.localeCompare(right),
  );
}

// claude-plugin/legacy-classifier.ts
import {
  existsSync as existsSync3,
  lstatSync as lstatSync2,
  readFileSync as readFileSync2,
} from 'node:fs';
import nodePath4 from 'node:path';
function referencesLegacyHook(value) {
  if (typeof value === 'string') return value.includes('.safeword/hooks/');
  if (Array.isArray(value)) return value.some(child => referencesLegacyHook(child));
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => referencesLegacyHook(child));
}
function observeFiles(cwd) {
  const recognizedFiles = [];
  const conflictingFiles = [];
  for (const relativePath of cataloguedClaudeLegacyPaths()) {
    const path = nodePath4.join(cwd, relativePath);
    if (!existsSync3(path)) continue;
    try {
      const safePath = assertSafeClaudeCleanupTarget(cwd, relativePath);
      const regular = lstatSync2(safePath).isFile();
      if (regular && isAcceptedHistoricalFile(relativePath, readFileSync2(safePath))) {
        recognizedFiles.push(relativePath);
      } else {
        conflictingFiles.push(relativePath);
      }
    } catch {
      if (existsSync3(path)) conflictingFiles.push(relativePath);
    }
  }
  return { recognizedFiles, conflictingFiles };
}
function observeSettings(cwd) {
  const settingsPath = nodePath4.join(cwd, '.claude/settings.json');
  if (!existsSync3(settingsPath)) return { recognizedHooks: [], conflictingHooks: [] };
  if (!lstatSync2(settingsPath).isFile()) {
    return {
      recognizedHooks: [],
      conflictingHooks: [],
      settingsError: '.claude/settings.json is not a regular file.',
    };
  }
  const errors = [];
  const settings = parse2(readFileSync2(settingsPath, 'utf8'), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0 || typeof settings !== 'object' || settings === null) {
    return {
      recognizedHooks: [],
      conflictingHooks: [],
      settingsError: '.claude/settings.json could not be parsed safely.',
    };
  }
  return classifySettingsHooks(settings.hooks ?? {});
}
function classifySettingsHooks(hooks) {
  const recognizedHooks = [];
  const conflictingHooks = [];
  const events = Object.entries(hooks);
  for (const [event, value] of events) {
    if (!Array.isArray(value)) continue;
    const entries = value.entries();
    for (const [index, entry] of entries) {
      if (isAcceptedHistoricalHook(event, entry)) {
        recognizedHooks.push({ event, index, entry });
      } else if (referencesLegacyHook(entry)) {
        conflictingHooks.push({ event, index, entry });
      }
    }
  }
  return { recognizedHooks, conflictingHooks };
}
function observeClaudeLegacy(cwd) {
  return { ...observeFiles(cwd), ...observeSettings(cwd) };
}

// claude-plugin/migration-state.ts
import { createHash as createHash4, randomUUID as randomUUID2 } from 'node:crypto';
import {
  cpSync,
  existsSync as existsSync5,
  mkdirSync as mkdirSync3,
  readFileSync as readFileSync4,
  renameSync as renameSync2,
  rmSync as rmSync3,
} from 'node:fs';
import nodePath8 from 'node:path';

// claude-plugin/inventory.ts
import {
  closeSync as closeSync2,
  constants as fsConstants,
  fstatSync,
  lstatSync as lstatSync3,
  openSync as openSync2,
  readdirSync,
  readSync,
  realpathSync,
} from 'node:fs';
import nodePath5 from 'node:path';
var CLAUDE_PLUGIN_ID = 'safeword@safeword';
var CLAUDE_MIGRATION_SCHEMA = {
  data: {
    pluginsRoot: 'plugins/data',
    proofs: 'execution-proofs-v2',
    projectState: 'project-state-v1',
  },
  state: {
    pluginMarkerV2: 'plugin-mode-v2.json',
    attention: 'attention-v1.json',
    attemptsDirectory: 'attempts-v1',
    transaction: 'cleanup-transaction-v1.json',
  },
  legacy: {
    /**
     * The v1 plugin-mode marker is never written by current code — its presence
     * in the working tree is the signal that a pre-v2 plugin ran here, so it
     * stays a repository path by definition.
     */
    pluginMarker: '.safeword/claude-plugin/plugin-mode-v1.json',
    pluginMarkerV2: '.safeword/claude-plugin/plugin-mode-v2.json',
    attention: '.safeword/claude-plugin/attention-v1.json',
    attemptsDirectory: '.safeword/claude-plugin/attempts-v1',
    transaction: '.safeword/claude-plugin/cleanup-transaction-v1.json',
  },
};
var CLAUDE_ADOPTED_LEGACY_STATE = [
  'pluginMarkerV2',
  'attention',
  'attemptsDirectory',
  'transaction',
];
var CLAUDE_NATIVE_REQUIRED_ASSETS = [
  '.claude-plugin/plugin.json',
  'hooks/hooks.json',
  'resources/SAFEWORD.md',
  'runtime/cli.js',
  'runtime/dispatch.js',
  'runtime/event-groups.json',
];
var CLAUDE_NATIVE_METADATA_FILES = ['README.md', 'identity.json', 'inventory.json'];
var MAX_CLAUDE_CACHE_METADATA_BYTES = 1024;
function isSmallRegularMetadata(metadata) {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.size <= MAX_CLAUDE_CACHE_METADATA_BYTES
  );
}
function isSameSmallMetadata(before, opened, after) {
  return (
    opened.isFile() &&
    isSmallRegularMetadata(after) &&
    opened.dev === before.dev &&
    opened.ino === before.ino &&
    opened.dev === after.dev &&
    opened.ino === after.ino &&
    opened.nlink === 1 &&
    opened.size <= MAX_CLAUDE_CACHE_METADATA_BYTES
  );
}
function readSmallDescriptor(descriptor) {
  const buffer = Buffer.alloc(MAX_CLAUDE_CACHE_METADATA_BYTES + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  return offset > MAX_CLAUDE_CACHE_METADATA_BYTES
    ? void 0
    : buffer.subarray(0, offset).toString('utf8');
}
function readSmallMetadataFile(path) {
  let descriptor;
  try {
    const linkedBefore = lstatSync3(path);
    if (!isSmallRegularMetadata(linkedBefore)) return void 0;
    descriptor = openSync2(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    const linkedAfter = lstatSync3(path);
    if (!isSameSmallMetadata(linkedBefore, opened, linkedAfter)) return void 0;
    const content = readSmallDescriptor(descriptor);
    const final = fstatSync(descriptor);
    return content !== void 0 && isSameSmallMetadata(linkedBefore, final, linkedAfter)
      ? content
      : void 0;
  } catch {
    return void 0;
  } finally {
    if (descriptor !== void 0) closeSync2(descriptor);
  }
}
function isLeaseRecord(value, expectedPid) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record2 = value;
  const hasExactFields =
    Object.keys(record2).length === 2 &&
    Object.hasOwn(record2, 'pid') &&
    Object.hasOwn(record2, 'procStart');
  return (
    hasExactFields &&
    Number.isSafeInteger(record2.pid) &&
    record2.pid === expectedPid &&
    typeof record2.procStart === 'string' &&
    record2.procStart.length > 0
  );
}
var LEASE_TEMP_INFIX = '.tmp.';
var LEASE_PID = /^\d{1,10}$/u;
var LEASE_TEMP_SUFFIX = /^[0-9a-f]{1,32}$/u;
function leaseMarkerPid(name) {
  const infix = name.indexOf(LEASE_TEMP_INFIX);
  if (infix === -1) return LEASE_PID.test(name) ? name : void 0;
  const pid = name.slice(0, infix);
  const suffix = name.slice(infix + LEASE_TEMP_INFIX.length);
  if (!LEASE_PID.test(pid) || !LEASE_TEMP_SUFFIX.test(suffix)) return void 0;
  return pid;
}
function vanishedDuringScan(path) {
  try {
    lstatSync3(path);
    return false;
  } catch (error) {
    return error.code === 'ENOENT';
  }
}
function isClaudeLeaseMarker(path, name) {
  const pid = leaseMarkerPid(name);
  if (pid === void 0) return false;
  const content = readSmallMetadataFile(path);
  if (content === void 0) return name.includes(LEASE_TEMP_INFIX) && vanishedDuringScan(path);
  try {
    return isLeaseRecord(JSON.parse(content), Number(pid));
  } catch {
    return name.includes(LEASE_TEMP_INFIX);
  }
}
function isClaudeCacheMetadataFile(logicalDirectory, physicalPath, entry) {
  if (!entry.isFile()) return false;
  if (logicalDirectory === '.in_use') return isClaudeLeaseMarker(physicalPath, entry.name);
  if (logicalDirectory !== '' || entry.name !== '.orphaned_at') return false;
  return /^\d{13}\n?$/u.test(readSmallMetadataFile(physicalPath) ?? '');
}
function directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot) {
  const metadata = lstatSync3(physicalDirectory);
  const canonical = realpathSync(physicalDirectory);
  const insideRoot =
    canonical === canonicalRoot || canonical.startsWith(`${canonicalRoot}${nodePath5.sep}`);
  if (!metadata.isDirectory() || !insideRoot) {
    throw new Error(`Claude plugin cache traversal escaped its root: ${logicalDirectory || '.'}`);
  }
  return { canonical, device: metadata.dev, inode: metadata.ino };
}
function claudeNativePayloadFiles(root) {
  const files = [];
  const canonicalRoot = realpathSync(root);
  const visit3 = (physicalDirectory, logicalDirectory) => {
    const before = directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot);
    const entries = readdirSync(physicalDirectory, { withFileTypes: true });
    const after = directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot);
    if (
      before.device !== after.device ||
      before.inode !== after.inode ||
      before.canonical !== after.canonical
    ) {
      throw new Error(`Claude plugin cache changed during traversal: ${logicalDirectory || '.'}`);
    }
    for (const entry of entries) {
      const physicalPath = nodePath5.join(physicalDirectory, entry.name);
      const logicalPath =
        logicalDirectory === '' ? entry.name : nodePath5.posix.join(logicalDirectory, entry.name);
      if (isClaudeCacheMetadataFile(logicalDirectory, physicalPath, entry)) continue;
      if (entry.isDirectory()) visit3(physicalPath, logicalPath);
      else files.push(logicalPath);
    }
  };
  visit3(root, '');
  return files;
}

// claude-plugin/plugin-data.ts
import { createHash as createHash3 } from 'node:crypto';
import { homedir } from 'node:os';
import nodePath7 from 'node:path';

// claude-plugin/project-root.ts
import { spawnSync } from 'node:child_process';

// utils/fs.ts
import {
  chmodSync,
  existsSync as existsSync4,
  mkdirSync as mkdirSync2,
  readdirSync as readdirSync2,
  readFileSync as readFileSync3,
  realpathSync as realpathSync2,
  rmdirSync,
  rmSync as rmSync2,
  statSync,
  writeFileSync as writeFileSync2,
} from 'node:fs';
import nodePath6 from 'node:path';
var __dirname = import.meta.dirname;
function canonicalDirectory(path) {
  if (typeof path !== 'string' || path.trim() === '') return void 0;
  try {
    if (!statSync(path).isDirectory()) return void 0;
    return nodePath6.normalize(realpathSync2(path));
  } catch {
    return void 0;
  }
}

// claude-plugin/project-root.ts
function canonicalClaudeProjectRoot(cwd) {
  const configuredRoot = process.env.CLAUDE_PROJECT_DIR;
  const environmentRoot = configuredRoot === void 0 ? void 0 : configuredRoot.trim();
  let candidate = environmentRoot === '' ? void 0 : environmentRoot;
  if (candidate === void 0) {
    const result = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    });
    const gitRoot = result.status === 0 ? result.stdout?.trim() : void 0;
    candidate = gitRoot === '' || gitRoot === void 0 ? cwd : gitRoot;
  }
  const canonical = canonicalDirectory(candidate);
  if (canonical === void 0) {
    throw new Error(
      `Claude project root is missing, not a directory, or cannot be resolved: ${candidate}`,
    );
  }
  return canonical;
}

// claude-plugin/plugin-data.ts
function claudeConfigDirectory(environment = process.env) {
  const configured = (environment.CLAUDE_CONFIG_DIR ?? '').trim();
  return configured === '' ? nodePath7.join(homedir(), '.claude') : configured;
}
function claudePluginDataId(pluginId = CLAUDE_PLUGIN_ID) {
  return pluginId.replaceAll(/[^\w-]/gu, '-');
}
function claudePluginDataDirectory(environment = process.env) {
  const exported = (environment.CLAUDE_PLUGIN_DATA ?? '').trim();
  if (exported !== '') return exported;
  return nodePath7.join(
    claudeConfigDirectory(environment),
    CLAUDE_MIGRATION_SCHEMA.data.pluginsRoot,
    claudePluginDataId(),
  );
}
function claudeProjectDigest(canonicalProjectRoot) {
  return createHash3('sha256').update(canonicalProjectRoot).digest('hex');
}
function claudeProofDirectory(environment = process.env) {
  return nodePath7.join(
    claudePluginDataDirectory(environment),
    CLAUDE_MIGRATION_SCHEMA.data.proofs,
  );
}
function claudeProjectStateDirectory(cwd) {
  const canonical = canonicalClaudeProjectRoot(cwd);
  return nodePath7.join(
    claudePluginDataDirectory(),
    CLAUDE_MIGRATION_SCHEMA.data.projectState,
    claudeProjectDigest(canonical),
  );
}

// claude-plugin/migration-state.ts
function createClaudePluginMode(marker) {
  return {
    ...marker,
    schema_version: 2,
    state: marker.unresolved_paths.length === 0 ? 'clean' : 'unresolved',
  };
}
var PROCESS_SESSION_ID = `process-${randomUUID2()}`;
function migrationSessionDigest(sessionId, fallbackSessionId) {
  return digest(sessionId?.trim() || fallbackSessionId);
}
function digest(value) {
  return createHash4('sha256').update(value).digest('hex');
}
var adopted = /* @__PURE__ */ new Set();
function relocateLegacyState(
  from,
  to,
  rename = renameSync2,
  copy = (source, destination) => {
    cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
  },
) {
  try {
    rename(from, to);
    return false;
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
  }
  const staging = `${to}.${randomUUID2()}.partial`;
  try {
    copy(from, staging);
    rename(staging, to);
  } catch (error) {
    rmSync3(staging, { recursive: true, force: true });
    throw error;
  }
  return true;
}
function adoptLegacyProjectState(cwd, directory) {
  if (adopted.has(directory)) return;
  adopted.add(directory);
  for (const key of CLAUDE_ADOPTED_LEGACY_STATE) {
    const legacy = nodePath8.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy[key]);
    if (!existsSync5(legacy)) continue;
    const destination = nodePath8.join(directory, CLAUDE_MIGRATION_SCHEMA.state[key]);
    try {
      if (existsSync5(adoptionReceipt(directory, key)) || existsSync5(destination)) {
        recordAdoption(directory, key);
        rmSync3(legacy, { recursive: true, force: true });
        continue;
      }
      mkdirSync3(directory, { recursive: true, mode: 448 });
      const sourceRemains = relocateLegacyState(legacy, destination);
      recordAdoption(directory, key);
      if (sourceRemains) rmSync3(legacy, { recursive: true, force: true });
    } catch {}
  }
}
function adoptionReceipt(directory, key) {
  return nodePath8.join(directory, `.adopted-${CLAUDE_MIGRATION_SCHEMA.state[key]}`);
}
function recordAdoption(directory, key) {
  try {
    writeDurableFile(adoptionReceipt(directory, key), '', { mode: 384 });
  } catch {}
}
function stateDirectory(cwd) {
  const directory = claudeProjectStateDirectory(cwd);
  adoptLegacyProjectState(cwd, directory);
  return directory;
}
function claudeProjectStatePath(cwd, key) {
  const directory = stateDirectory(cwd);
  const adoptedPath = nodePath8.join(directory, CLAUDE_MIGRATION_SCHEMA.state[key]);
  if (existsSync5(adoptedPath)) return adoptedPath;
  if (existsSync5(adoptionReceipt(directory, key))) return adoptedPath;
  const legacy = nodePath8.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy[key]);
  return existsSync5(legacy) ? legacy : adoptedPath;
}
function removeClaudeProjectState(cwd, key) {
  rmSync3(nodePath8.join(stateDirectory(cwd), CLAUDE_MIGRATION_SCHEMA.state[key]), {
    recursive: true,
    force: true,
  });
  rmSync3(nodePath8.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy[key]), {
    recursive: true,
    force: true,
  });
}
function attemptsPath(cwd) {
  return claudeProjectStatePath(cwd, 'attemptsDirectory');
}
function exclusiveRecord(path, value) {
  try {
    writeDurableFileExclusive(
      path,
      `${JSON.stringify(value)}
`,
      { mode: 384 },
    );
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}
function initialSessionDigest(cwd, sessionDigest) {
  const directory = attemptsPath(cwd);
  mkdirSync3(directory, { recursive: true, mode: 448 });
  const path = nodePath8.join(directory, 'initial-session-v1.json');
  exclusiveRecord(path, { schema_version: 1, session_digest: sessionDigest });
  try {
    const value = JSON.parse(readFileSync4(path, 'utf8'));
    return value.schema_version === 1 && validDigest(value.session_digest)
      ? value.session_digest
      : '';
  } catch {
    return '';
  }
}
function claimClaudeMigrationAttempt(
  cwd,
  sessionId,
  kind = 'migration',
  fallbackSessionId = PROCESS_SESSION_ID,
) {
  const sessionDigest = migrationSessionDigest(sessionId, fallbackSessionId);
  const initialSession = initialSessionDigest(cwd, sessionDigest) === sessionDigest;
  const limit = initialSession ? 3 : 1;
  const directory = nodePath8.join(
    attemptsPath(cwd),
    kind === 'recovery' && !initialSession ? 'recoveries' : 'launches',
  );
  mkdirSync3(directory, { recursive: true, mode: 448 });
  for (let slot = 1; slot <= limit; slot += 1) {
    if (
      exclusiveRecord(nodePath8.join(directory, `${sessionDigest}-${String(slot)}.json`), {
        schema_version: 1,
        session_digest: sessionDigest,
        slot,
      })
    ) {
      return true;
    }
  }
  return false;
}
function claimClaudeMigrationAdvisory(
  cwd,
  sessionId,
  stateDigest,
  fallbackSessionId = PROCESS_SESSION_ID,
) {
  if (!validDigest(stateDigest))
    throw new TypeError('Claude migration advisory digest is invalid.');
  const directory = nodePath8.join(attemptsPath(cwd), 'advisories');
  mkdirSync3(directory, { recursive: true, mode: 448 });
  const sessionDigest = migrationSessionDigest(sessionId, fallbackSessionId);
  return exclusiveRecord(nodePath8.join(directory, `${sessionDigest}-${stateDigest}.json`), {
    schema_version: 1,
    session_digest: sessionDigest,
    state_digest: stateDigest,
  });
}
function advisoryStateDigest(advisory) {
  return digest(advisory);
}
function claudeWatchedSettingsDigest(cwd) {
  const configDirectory = claudeConfigDirectory();
  const paths = [
    nodePath8.join(cwd, '.claude/settings.json'),
    nodePath8.join(configDirectory, 'settings.json'),
  ];
  const hash = createHash4('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(existsSync5(path) ? readFileSync4(path) : '<absent>');
    hash.update('\0');
  }
  return hash.digest('hex');
}
function markerPath(cwd) {
  return claudeProjectStatePath(cwd, 'pluginMarkerV2');
}
function validDigest(value) {
  return typeof value === 'string' && /^[\da-f]{64}$/u.test(value);
}
function validPluginMode(value) {
  const unresolvedPaths2 = value.unresolved_paths;
  const consistentState =
    (value.state === 'clean' && unresolvedPaths2?.length === 0) ||
    (value.state === 'unresolved' && (unresolvedPaths2?.length ?? 0) > 0);
  return [
    value.schema_version === 2,
    ['clean', 'unresolved'].includes(value.state ?? ''),
    typeof value.plugin_version === 'string',
    validDigest(value.hook_manifest_sha256),
    validDigest(value.catalogue_sha256),
    Array.isArray(unresolvedPaths2),
    Array.isArray(unresolvedPaths2) && unresolvedPaths2.every(item => typeof item === 'string'),
    consistentState,
  ].every(Boolean);
}
function readClaudePluginMode(cwd) {
  try {
    const path = markerPath(cwd);
    const value = JSON.parse(readFileSync4(path, 'utf8'));
    return validPluginMode(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
function pluginModeIsTerminal(marker, identity) {
  return (
    marker.plugin_version === identity.plugin_version &&
    marker.hook_manifest_sha256 === identity.hook_manifest_sha256 &&
    marker.catalogue_sha256 === identity.catalogue_sha256
  );
}
function writeClaudePluginMode(cwd, marker) {
  const normalized = createClaudePluginMode({
    plugin_version: marker.plugin_version,
    hook_manifest_sha256: marker.hook_manifest_sha256,
    catalogue_sha256: marker.catalogue_sha256,
    unresolved_paths: marker.unresolved_paths,
    ...(marker.advisory !== void 0 && { advisory: marker.advisory }),
    ...(marker.transaction_id !== void 0 && { transaction_id: marker.transaction_id }),
  });
  writeDurableFile(
    markerPath(cwd),
    `${JSON.stringify(normalized, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
}
function writeClaudeMigrationAttention(cwd, attention) {
  writeDurableFile(
    claudeProjectStatePath(cwd, 'attention'),
    `${JSON.stringify(attention, void 0, 2)}
`,
    { mode: 384 },
  );
}
function removeLegacyClaudePluginMode(cwd) {
  rmSync3(nodePath8.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy.pluginMarker), { force: true });
}

// claude-plugin/cleanup.ts
function sha2562(content) {
  return createHash5('sha256').update(content).digest('hex');
}
function containsJsonComments(content) {
  let found = false;
  visit2(content, { onComment: () => (found = true) });
  return found;
}
function settingsMutation(cwd, legacy) {
  const relative = '.claude/settings.json';
  const path = nodePath9.join(cwd, relative);
  if (!existsSync6(path) || legacy.recognizedHooks.length === 0) return void 0;
  const original = readFileSync5(path, 'utf8');
  return { path: relative, content: contractHistoricalClaudeSettings(original) };
}
function contractHistoricalClaudeSettings(original) {
  const parsed = parse2(original, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const hooks = parsed.hooks ?? {};
  const recognizedHooks = Object.entries(hooks).flatMap(([event, entries]) =>
    Array.isArray(entries)
      ? entries.flatMap((entry, index) =>
          isAcceptedHistoricalHook(event, entry) ? [{ event, index, entry }] : [],
        )
      : [],
  );
  if (recognizedHooks.length === 0)
    throw new Error('Claude settings transaction has no legacy hooks.');
  return settingsMutationFromContent(original, recognizedHooks);
}
function settingsMutationFromContent(original, recognizedHooks) {
  const parsed = parse2(original, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const hooks = parsed.hooks ?? {};
  const allHookValuesAreArrays = Object.values(hooks).every(entries => Array.isArray(entries));
  const hookCount = Object.values(hooks).reduce(
    (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  if (
    Object.keys(parsed).length === 1 &&
    allHookValuesAreArrays &&
    Object.values(hooks).every(entries => entries.length > 0) &&
    hookCount === recognizedHooks.length &&
    !containsJsonComments(original)
  ) {
    return null;
  }
  let content = original;
  const references = recognizedHooks.toSorted((left, right) => {
    const eventOrder = right.event.localeCompare(left.event);
    return eventOrder === 0 ? right.index - left.index : eventOrder;
  });
  for (const reference of references) {
    content = applyEdits(
      content,
      modify(content, ['hooks', reference.event, reference.index], void 0, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  }
  return content;
}
function claudeLegacyMutations(cwd) {
  const legacy = observeClaudeLegacy(cwd);
  const files = legacy.recognizedFiles.map(path => ({
    path,
    content: null,
  }));
  const settings = settingsMutation(cwd, legacy);
  if (settings !== void 0) files.push(settings);
  return files;
}
function transactionPath(cwd) {
  return claudeProjectStatePath(cwd, 'transaction');
}
function writeTransaction(cwd, transaction) {
  const path = transactionPath(cwd);
  mkdirSync4(nodePath9.dirname(path), { recursive: true, mode: 448 });
  const content = `${JSON.stringify(transaction, void 0, 2)}
`;
  if (
    transaction.entries.length > 1024 ||
    Buffer.byteLength(content) > MAX_CLAUDE_TRANSACTION_BYTES
  ) {
    throw new Error('Claude cleanup transaction exceeds its recoverable size limit.');
  }
  writeDurableFileExclusive(path, content, {
    mode: 384,
  });
}
function entryFor(cwd, mutation) {
  const path = assertSafeClaudeCleanupTarget(cwd, mutation.path);
  const before = readFileSync5(path);
  const after = mutation.content === null ? null : Buffer.from(mutation.content);
  const mode = lstatSync4(path).mode & 511;
  return {
    path: mutation.path,
    before_sha256: sha2562(before),
    before_base64: before.toString('base64'),
    before_mode: mode,
    after_sha256: after === null ? null : sha2562(after),
    after_base64: after === null ? null : after.toString('base64'),
    after_mode: after === null ? null : mode,
    ...(after === null && {
      quarantine_path: `.safeword/claude-plugin/quarantine/${randomUUID3()}.retired`,
    }),
  };
}
function observedSha(path) {
  return existsSync6(path) ? sha2562(readFileSync5(path)) : null;
}
function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}
function isValidOpenCleanupTarget(snapshot) {
  const { targetBefore, opened, targetAfter, parentBefore, openedParent, parentAfter } = snapshot;
  return (
    opened.isFile() &&
    opened.nlink === 1 &&
    sameFile(targetBefore, opened) &&
    sameFile(opened, targetAfter) &&
    sameFile(parentBefore, openedParent) &&
    sameFile(parentBefore, parentAfter)
  );
}
function openCleanupTarget(root, relative, flags) {
  const path = assertSafeClaudeCleanupTarget(root, relative);
  const parentPath = nodePath9.dirname(path);
  const targetBefore = lstatSync4(path);
  const parentBefore = lstatSync4(parentPath);
  const parentDescriptor = openSync3(
    parentPath,
    fsConstants2.O_RDONLY | (fsConstants2.O_DIRECTORY ?? 0) | (fsConstants2.O_NOFOLLOW ?? 0),
  );
  let descriptor;
  try {
    descriptor = openSync3(path, flags | (fsConstants2.O_NOFOLLOW ?? 0));
    const targetAfter = lstatSync4(path);
    const parentAfter = lstatSync4(parentPath);
    const opened = fstatSync2(descriptor);
    const openedParent = fstatSync2(parentDescriptor);
    if (
      !isValidOpenCleanupTarget({
        targetBefore,
        opened,
        targetAfter,
        parentBefore,
        openedParent,
        parentAfter,
      })
    ) {
      throw new Error(`Claude cleanup target changed during validation: ${relative}`);
    }
    return { descriptor, parentDescriptor, path, target: opened, parent: parentAfter };
  } catch (error) {
    if (descriptor !== void 0) closeSync3(descriptor);
    closeSync3(parentDescriptor);
    throw error;
  }
}
function quarantineOpenTarget(root, opened, quarantinePath, beforeQuarantine) {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    throw new Error('Atomic Claude cleanup quarantine is unavailable on this platform.');
  }
  const safeQuarantinePath = containedClaudeCleanupPath(root, quarantinePath);
  const quarantineDirectory = nodePath9.dirname(safeQuarantinePath);
  mkdirSync4(quarantineDirectory, { recursive: true, mode: 448 });
  beforeQuarantine?.();
  renameSync3(opened.path, safeQuarantinePath);
  const quarantined = lstatSync4(safeQuarantinePath);
  const descriptor = fstatSync2(opened.descriptor);
  if (!sameFile(quarantined, descriptor) || descriptor.size !== opened.target.size) {
    throw new Error('Claude cleanup quarantined a replacement target; retained it for recovery.');
  }
  ftruncateSync(opened.descriptor, 0);
  fchmodSync(opened.descriptor, 384);
  fsyncSync2(opened.descriptor);
}
function revalidateOpenTarget(root, relative, opened) {
  const path = assertSafeClaudeCleanupTarget(root, relative);
  const target = lstatSync4(path);
  const parent = lstatSync4(nodePath9.dirname(path));
  const descriptor = fstatSync2(opened.descriptor);
  if (
    path !== opened.path ||
    !sameFile(opened.target, descriptor) ||
    !sameFile(descriptor, target) ||
    !sameFile(opened.parent, parent) ||
    descriptor.size !== opened.target.size ||
    descriptor.nlink !== 1
  ) {
    throw new Error(`Claude cleanup target changed before mutation: ${relative}`);
  }
}
function descriptorSha256(descriptor, size) {
  if (size > MAX_CLAUDE_TRANSACTION_BYTES) throw new Error('Claude cleanup target is too large.');
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync2(descriptor, bytes, offset, bytes.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  return sha2562(bytes.subarray(0, offset));
}
function writeImage(root, relative, expectedSha256, content, options) {
  const opened = openCleanupTarget(root, relative, fsConstants2.O_RDWR);
  try {
    revalidateOpenTarget(root, relative, opened);
    if (descriptorSha256(opened.descriptor, opened.target.size) !== expectedSha256) {
      throw new Error(`Claude cleanup target changed before mutation: ${relative}`);
    }
    revalidateOpenTarget(root, relative, opened);
    if (content === null) {
      if (options.quarantinePath === void 0) {
        throw new Error(`Claude cleanup transaction has no quarantine path: ${relative}`);
      }
      quarantineOpenTarget(root, opened, options.quarantinePath, options.beforeQuarantine);
      return;
    }
    const bytes = Buffer.from(content, 'base64');
    ftruncateSync(opened.descriptor, 0);
    let offset = 0;
    while (offset < bytes.length) {
      offset += writeSync(opened.descriptor, bytes, offset, bytes.length - offset, offset);
    }
    fchmodSync(opened.descriptor, options.mode ?? 420);
    fsyncSync2(opened.descriptor);
  } finally {
    closeSync3(opened.descriptor);
    closeSync3(opened.parentDescriptor);
  }
}
function applyEntries(cwd, entries, shouldDefer = () => false, beforeQuarantine) {
  for (const entry of entries) {
    if (shouldDefer()) return false;
    const path = assertSafeClaudeCleanupTarget(cwd, entry.path);
    if (observedSha(path) !== entry.before_sha256) {
      throw new Error(`Claude cleanup target changed after planning: ${entry.path}`);
    }
    writeImage(cwd, entry.path, entry.before_sha256, entry.after_base64, {
      mode: entry.after_mode,
      quarantinePath: entry.quarantine_path,
      beforeQuarantine,
    });
  }
  return true;
}
function pruneEmptyLegacyDirectories(cwd, entries) {
  const candidates = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (entry.after_sha256 !== null) continue;
    let directory = nodePath9.dirname(entry.path);
    while (directory === '.claude' || directory.startsWith('.claude/')) {
      candidates.add(directory);
      directory = nodePath9.dirname(directory);
    }
  }
  const deepestFirst = [...candidates].toSorted(
    (left, right) => right.split('/').length - left.split('/').length,
  );
  for (const directory of deepestFirst) {
    try {
      rmdirSync2(containedClaudeCleanupPath(cwd, directory));
    } catch {}
  }
}
function unresolvedPaths(legacy) {
  return [
    ...legacy.conflictingFiles,
    ...legacy.conflictingHooks.map(
      hook => `.claude/settings.json#hooks.${hook.event}[${String(hook.index)}]`,
    ),
    ...(legacy.settingsError === void 0 ? [] : ['.claude/settings.json']),
  ];
}
function automaticAdvisory(paths) {
  if (paths.length === 0) return void 0;
  return `Safeword removed the old Claude integration it could verify, but preserved unrecognized content at ${paths.join(', ')}. Review those paths; your prompt was not blocked.`;
}
function recordAutomaticAttention(cwd, options, classification, advisory) {
  writeClaudeMigrationAttention(cwd, {
    schema_version: 1,
    state_digest: advisoryStateDigest(advisory),
    plugin_version: options.pluginVersion,
    catalogue_sha256: options.catalogueSha256,
    watched_settings_sha256: claudeWatchedSettingsDigest(cwd),
    classification,
    advisory,
  });
}
function waitForPluginMode(cwd, deadline, now) {
  const marker = claudeProjectStatePath(cwd, 'pluginMarkerV2');
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const maximumChecks = 25;
  for (let checks = 0; checks < maximumChecks && now() < deadline; checks += 1) {
    if (existsSync6(marker)) return true;
    const remaining = Math.max(1, deadline - now());
    Atomics.wait(pause, 0, 0, Math.min(20, remaining));
  }
  return existsSync6(marker);
}
function writeAutomaticPluginMode(cwd, transaction) {
  const pluginMode = transaction.plugin_mode;
  writeClaudePluginMode(
    cwd,
    createClaudePluginMode({
      plugin_version: pluginMode.plugin_version,
      hook_manifest_sha256: pluginMode.hook_manifest_sha256,
      catalogue_sha256: pluginMode.catalogue_sha256,
      unresolved_paths: pluginMode.unresolved_paths,
      advisory: pluginMode.advisory,
      transaction_id: transaction.transaction_id,
    }),
  );
}
function cleanupFailure(error) {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
    nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
    data: { command: 'claude cleanup', classification: 'recovery-required' },
  });
}
function migrateClaudeLegacyAutomatically(cwd, options) {
  const now = options.now ?? Date.now;
  let projectRoot;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
    return performAutomaticMigration(projectRoot, options, now);
  } catch (error) {
    const advisory = `Safeword preserved the old Claude integration after cleanup could not finish: ${error instanceof Error ? error.message : String(error)} Your prompt was not blocked; run \`safeword claude recover\` to repair it.`;
    if (projectRoot !== void 0) {
      try {
        recordAutomaticAttention(projectRoot, options, 'migration-error', advisory);
      } catch {}
    }
    return {
      state: 'attention',
      advisory,
      unresolvedPaths: [],
    };
  }
}
function recoveredAutomaticResult(projectRoot) {
  const recovered = recoverClaudeCleanup(projectRoot);
  if (recovered.state !== 'failed') {
    return observedPluginModeResult(projectRoot);
  }
  const detail =
    recovered.errors?.[0]?.message ?? 'the recorded cleanup transaction could not be read safely';
  return {
    state: 'attention',
    advisory: `Safeword preserved the old Claude integration because automatic recovery could not finish: ${detail} Your prompt was not blocked; run \`safeword claude recover\` to repair it.`,
    unresolvedPaths: [],
  };
}
function observedPluginModeResult(projectRoot) {
  const marker = readClaudePluginMode(projectRoot);
  return {
    state: 'complete',
    advisory: marker?.advisory,
    unresolvedPaths: marker?.unresolved_paths ?? [],
  };
}
function writeObservedPluginMode(projectRoot, options, unresolved, advisory) {
  const existing = readClaudePluginMode(projectRoot);
  writeClaudePluginMode(
    projectRoot,
    createClaudePluginMode({
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
      ...(existing?.transaction_id !== void 0 && {
        transaction_id: existing.transaction_id,
      }),
    }),
  );
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}
var CONCURRENT_MIGRATION_ADVISORY =
  'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.';
function deferredConcurrentMigration(paths) {
  return {
    state: 'deferred',
    advisory: CONCURRENT_MIGRATION_ADVISORY,
    unresolvedPaths: paths,
  };
}
function claimAutomaticTransaction(projectRoot, transaction, options, now, unresolved) {
  try {
    writeTransaction(projectRoot, transaction);
    return void 0;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (waitForPluginMode(projectRoot, options.deadline, now)) {
      return observedPluginModeResult(projectRoot);
    }
    return deferredConcurrentMigration(unresolved);
  }
}
function concurrentMigrationResult(projectRoot, options, now) {
  try {
    const transaction = parseTransaction(projectRoot);
    if (transactionCanRecover(transaction)) return recoveredAutomaticResult(projectRoot);
  } catch {}
  const concurrentDeadline = Math.min(options.deadline, now() + 500);
  if (waitForPluginMode(projectRoot, concurrentDeadline, now)) {
    return observedPluginModeResult(projectRoot);
  }
  if (now() >= options.deadline) {
    return deferredConcurrentMigration([]);
  }
  try {
    const transaction = parseTransaction(projectRoot);
    return transactionCanRecover(transaction)
      ? recoveredAutomaticResult(projectRoot)
      : deferredConcurrentMigration([]);
  } catch {
    return recoveredAutomaticResult(projectRoot);
  }
}
function planCleanupEntries(projectRoot, mutations) {
  try {
    return mutations.map(mutation => entryFor(projectRoot, mutation));
  } catch (error) {
    if (existsSync6(transactionPath(projectRoot))) return void 0;
    throw error;
  }
}
function performAutomaticMigration(projectRoot, options, now) {
  if (now() >= options.deadline) {
    return {
      state: 'deferred',
      advisory: 'Safeword deferred old Claude integration cleanup until the next prompt.',
      unresolvedPaths: [],
    };
  }
  if (existsSync6(transactionPath(projectRoot)))
    return concurrentMigrationResult(projectRoot, options, now);
  const legacy = observeClaudeLegacy(projectRoot);
  const unresolved = unresolvedPaths(legacy);
  const advisory = automaticAdvisory(unresolved);
  const mutations = claudeLegacyMutations(projectRoot);
  if (mutations.length === 0) {
    return writeObservedPluginMode(projectRoot, options, unresolved, advisory);
  }
  const entries = planCleanupEntries(projectRoot, mutations);
  if (entries === void 0) return concurrentMigrationResult(projectRoot, options, now);
  const transaction = {
    schema_version: 1,
    transaction_id: randomUUID3(),
    disposition: 'complete-forward',
    state: 'active',
    owner_pid: process.pid,
    entries,
    plugin_mode: {
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
    },
  };
  const contention = claimAutomaticTransaction(projectRoot, transaction, options, now, unresolved);
  if (contention !== void 0) return contention;
  options.beforeApply?.();
  let applied;
  try {
    applied = applyEntries(
      projectRoot,
      transaction.entries,
      () => now() >= options.deadline,
      options.beforeQuarantine,
    );
  } catch (error) {
    writeDurableFile(
      transactionPath(projectRoot),
      `${JSON.stringify({ ...transaction, state: 'recoverable' }, void 0, 2)}
`,
      { mode: 384 },
    );
    throw error;
  }
  if (!applied) {
    writeDurableFile(
      transactionPath(projectRoot),
      `${JSON.stringify({ ...transaction, state: 'recoverable' }, void 0, 2)}
`,
      { mode: 384 },
    );
    return {
      state: 'deferred',
      advisory: 'Safeword will finish removing its old Claude integration on the next prompt.',
      unresolvedPaths: unresolved,
    };
  }
  writeAutomaticPluginMode(projectRoot, transaction);
  removeClaudeProjectState(projectRoot, 'transaction');
  pruneEmptyLegacyDirectories(projectRoot, transaction.entries);
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}
var MAX_CLAUDE_TRANSACTION_BYTES = 8 * 1024 * 1024;
var SHA256_PATTERN = /^[\da-f]{64}$/u;
var UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
function isTransactionFile(before, opened, after) {
  return (
    isSafeTransactionMetadata(before) &&
    isSafeTransactionMetadata(opened) &&
    isSafeTransactionMetadata(after) &&
    before.dev === opened.dev &&
    before.ino === opened.ino &&
    opened.dev === after.dev &&
    opened.ino === after.ino
  );
}
function isSafeTransactionMetadata(metadata) {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.nlink === 1 &&
    metadata.size <= MAX_CLAUDE_TRANSACTION_BYTES
  );
}
function readTransactionBytes(path) {
  let descriptor;
  try {
    const before = lstatSync4(path);
    descriptor = openSync3(
      path,
      fsConstants2.O_RDONLY | fsConstants2.O_NONBLOCK | (fsConstants2.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync2(descriptor);
    const after = lstatSync4(path);
    if (!isTransactionFile(before, opened, after)) throw new Error('Unsafe transaction file.');
    const buffer = Buffer.alloc(MAX_CLAUDE_TRANSACTION_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync2(descriptor, buffer, offset, buffer.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const final = fstatSync2(descriptor);
    if (
      offset > MAX_CLAUDE_TRANSACTION_BYTES ||
      !isTransactionFile(before, final, lstatSync4(path))
    ) {
      throw new Error('Unsafe transaction file.');
    }
    return buffer.subarray(0, offset);
  } finally {
    if (descriptor !== void 0) closeSync3(descriptor);
  }
}
function record(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Claude cleanup transaction is malformed.');
  }
  return value;
}
function canonicalBase64(value) {
  if (typeof value !== 'string') throw new Error('Claude cleanup image is malformed.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('Claude cleanup image is malformed.');
  return bytes;
}
function hasExactKeys(value, keys) {
  const actual = Object.keys(value).toSorted((left, right) => left.localeCompare(right));
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}
var CLEANUP_ENTRY_KEYS = [
  'after_base64',
  'after_mode',
  'after_sha256',
  'before_base64',
  'before_mode',
  'before_sha256',
  'path',
];
function expectedCleanupEntryKeys(entry) {
  return [
    ...CLEANUP_ENTRY_KEYS,
    ...(entry.quarantine_path === void 0 ? [] : ['quarantine_path']),
  ].toSorted((left, right) => left.localeCompare(right));
}
function hasValidBeforeImage(entry, before) {
  return (
    hasExactKeys(entry, expectedCleanupEntryKeys(entry)) &&
    typeof entry.path === 'string' &&
    typeof entry.before_sha256 === 'string' &&
    SHA256_PATTERN.test(entry.before_sha256) &&
    sha2562(before) === entry.before_sha256 &&
    Number.isSafeInteger(entry.before_mode) &&
    entry.before_mode >= 0 &&
    entry.before_mode <= 511
  );
}
function deterministicAfterImage(path, before) {
  if (path === '.claude/settings.json')
    return contractHistoricalClaudeSettings(before.toString('utf8'));
  if (cataloguedClaudeLegacyPaths().includes(path) && isAcceptedHistoricalFile(path, before)) {
    return null;
  }
  return void 0;
}
function hasExpectedAfterImage(entry, expectedBytes) {
  const expectedHash = expectedBytes === null ? null : sha2562(expectedBytes);
  const expectedBase64 = expectedBytes === null ? null : expectedBytes.toString('base64');
  const expectedMode = expectedBytes === null ? null : entry.before_mode;
  return (
    entry.after_sha256 === expectedHash &&
    entry.after_base64 === expectedBase64 &&
    entry.after_mode === expectedMode
  );
}
function hasValidQuarantinePath(entry, deleting) {
  if (entry.quarantine_path === void 0) return true;
  if (!deleting || typeof entry.quarantine_path !== 'string') return false;
  return (
    entry.quarantine_path.startsWith('.safeword/claude-plugin/quarantine/') &&
    entry.quarantine_path.endsWith('.retired') &&
    !nodePath9.isAbsolute(entry.quarantine_path) &&
    !entry.quarantine_path.split('/').includes('..')
  );
}
function validateCleanupEntry(value) {
  const entry = record(value);
  const before = canonicalBase64(entry.before_base64);
  if (!hasValidBeforeImage(entry, before)) {
    throw new Error('Claude cleanup entry is malformed.');
  }
  const expectedAfter = deterministicAfterImage(entry.path, before);
  if (expectedAfter === void 0) throw new Error('Claude cleanup entry is not catalogued.');
  const expectedBytes = expectedAfter === null ? null : Buffer.from(expectedAfter);
  if (!hasExpectedAfterImage(entry, expectedBytes)) {
    throw new Error('Claude cleanup after-image is not the deterministic legacy contraction.');
  }
  if (!hasValidQuarantinePath(entry, expectedAfter === null)) {
    throw new Error('Claude cleanup quarantine path is malformed.');
  }
  return entry;
}
function expectedPluginModeKeys(pluginMode) {
  return [
    ...(pluginMode.advisory === void 0 ? [] : ['advisory']),
    'catalogue_sha256',
    'hook_manifest_sha256',
    'plugin_version',
    'unresolved_paths',
  ].toSorted((left, right) => left.localeCompare(right));
}
function hasValidPluginModeDigests(pluginMode) {
  return (
    typeof pluginMode.hook_manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(pluginMode.hook_manifest_sha256) &&
    typeof pluginMode.catalogue_sha256 === 'string' &&
    SHA256_PATTERN.test(pluginMode.catalogue_sha256)
  );
}
function hasValidPluginModeMetadata(pluginMode) {
  return (
    typeof pluginMode.plugin_version === 'string' &&
    Array.isArray(pluginMode.unresolved_paths) &&
    pluginMode.unresolved_paths.every(path => typeof path === 'string') &&
    (pluginMode.advisory === void 0 || typeof pluginMode.advisory === 'string')
  );
}
function validatePluginMode(value) {
  const pluginMode = record(value);
  const expectedKeys = expectedPluginModeKeys(pluginMode);
  if (
    !hasExactKeys(pluginMode, expectedKeys) ||
    !hasValidPluginModeDigests(pluginMode) ||
    !hasValidPluginModeMetadata(pluginMode)
  ) {
    throw new Error('Claude cleanup plugin mode is malformed.');
  }
  return pluginMode;
}
function hasValidTransactionHeader(value) {
  return (
    hasExactKeys(value, [
      'disposition',
      'entries',
      'owner_pid',
      'plugin_mode',
      'schema_version',
      'state',
      'transaction_id',
    ]) &&
    value.schema_version === 1 &&
    typeof value.transaction_id === 'string' &&
    UUID_PATTERN.test(value.transaction_id) &&
    value.disposition === 'complete-forward' &&
    (value.state === 'active' || value.state === 'recoverable') &&
    Number.isSafeInteger(value.owner_pid) &&
    value.owner_pid > 0
  );
}
function hasValidTransactionEntries(value) {
  return Array.isArray(value.entries) && value.entries.length > 0 && value.entries.length <= 1024;
}
function parseTransaction(cwd) {
  const bytes = readTransactionBytes(transactionPath(cwd));
  const parsed = JSON.parse(bytes.toString('utf8'));
  const value = record(parsed);
  if (!hasValidTransactionHeader(value) || !hasValidTransactionEntries(value)) {
    throw new Error('Claude cleanup transaction is malformed.');
  }
  const entryValues = value.entries;
  const entries = entryValues.map(entry => validateCleanupEntry(entry));
  if (new Set(entries.map(entry => entry.path)).size !== entries.length) {
    throw new Error('Claude cleanup transaction repeats a target.');
  }
  return {
    schema_version: 1,
    transaction_id: value.transaction_id,
    disposition: 'complete-forward',
    state: value.state,
    owner_pid: value.owner_pid,
    entries,
    plugin_mode: validatePluginMode(value.plugin_mode),
  };
}
function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}
function transactionCanRecover(transaction) {
  return transaction.state === 'recoverable' || !processIsRunning(transaction.owner_pid);
}
function ensureQuarantinePaths(projectRoot, transaction) {
  if (
    transaction.entries.every(
      entry => entry.after_sha256 !== null || entry.quarantine_path !== void 0,
    )
  ) {
    return transaction;
  }
  const upgraded = {
    ...transaction,
    entries: transaction.entries.map(entry =>
      entry.after_sha256 === null && entry.quarantine_path === void 0
        ? {
            ...entry,
            quarantine_path: `.safeword/claude-plugin/quarantine/${randomUUID3()}.retired`,
          }
        : entry,
    ),
  };
  writeDurableFile(
    transactionPath(projectRoot),
    `${JSON.stringify(upgraded, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
  return upgraded;
}
function interruptedAfterImage(path, entry) {
  if (entry.after_base64 === null) return false;
  const current = readFileSync5(path);
  const after = Buffer.from(entry.after_base64, 'base64');
  return current.length < after.length && after.subarray(0, current.length).equals(current);
}
function pendingRecoveryEntries(projectRoot, transaction) {
  const pending = [];
  for (const entry of transaction.entries) {
    if (entry.quarantine_path !== void 0) {
      const quarantine = assertSafeClaudeCleanupTarget(projectRoot, entry.quarantine_path);
      if (existsSync6(quarantine) && lstatSync4(quarantine).size > 0) {
        throw new Error(
          `Claude recovery preserved unverified bytes at ${entry.quarantine_path}; inspect and move or remove that file before retrying recovery`,
        );
      }
    }
    const path = assertSafeClaudeCleanupTarget(projectRoot, entry.path);
    const current = observedSha(path);
    const source = entry.before_sha256;
    const destination = entry.after_sha256;
    if (current === destination) continue;
    if (current === source) {
      pending.push({ entry, expectedSha256: source });
      continue;
    }
    if (current !== null && interruptedAfterImage(path, entry)) {
      pending.push({ entry, expectedSha256: current });
      continue;
    }
    throw new Error(`Claude recovery conflict at ${entry.path}`);
  }
  return pending;
}
function applyRecoveryEntries(projectRoot, pending) {
  for (const { entry, expectedSha256 } of pending) {
    writeImage(projectRoot, entry.path, expectedSha256, entry.after_base64, {
      mode: entry.after_mode,
      quarantinePath: entry.quarantine_path,
    });
  }
}
function completedRecoveryResult(projectRoot, transaction) {
  writeAutomaticPluginMode(projectRoot, transaction);
  removeClaudeProjectState(projectRoot, 'transaction');
  pruneEmptyLegacyDirectories(projectRoot, transaction.entries);
  return createResult({
    state: 'changed',
    data: {
      command: 'claude recover',
      classification: 'plugin-mode',
    },
  });
}
function recoverClaudeCleanup(cwd) {
  let projectRoot;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return cleanupFailure(error);
  }
  if (!existsSync6(transactionPath(projectRoot))) {
    return createResult({
      state: 'healthy',
      data: { command: 'claude recover', classification: 'plugin-mode' },
    });
  }
  try {
    let transaction = parseTransaction(projectRoot);
    if (!transactionCanRecover(transaction)) {
      throw new Error(
        `Claude cleanup transaction is still owned by process ${transaction.owner_pid}.`,
      );
    }
    transaction = ensureQuarantinePaths(projectRoot, transaction);
    applyRecoveryEntries(projectRoot, pendingRecoveryEntries(projectRoot, transaction));
    return completedRecoveryResult(projectRoot, transaction);
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [{ code: 'CLAUDE_RECOVERY_CONFLICT', message: String(error), retryable: true }],
      nextActions: [
        { command: 'resolve the reported recovery conflict', mutates: false, requiresHuman: true },
      ],
      data: { command: 'claude recover', classification: 'recovery-required' },
    });
  }
}

// claude-plugin/runtime/dispatch.ts
function parseSettings(path) {
  if (!existsSync7(path)) return void 0;
  try {
    const errors = [];
    const parsed = parse2(readFileSync6(path, 'utf8'), errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    return errors.length === 0 &&
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : void 0;
  } catch {
    return void 0;
  }
}
function acceptedLegacyHookReference(value, projectRoot) {
  const reference = /\.safeword\/hooks\/[^\s"';&|)]+/u.exec(value)?.[0];
  if (reference === void 0) return false;
  try {
    const hooksRoot = nodePath10.resolve(projectRoot, '.safeword/hooks');
    const target = nodePath10.resolve(projectRoot, reference);
    if (!target.startsWith(`${hooksRoot}${nodePath10.sep}`)) return false;
    if (realpathSync3(hooksRoot) !== hooksRoot || realpathSync3(target) !== target) return false;
    return (
      lstatSync5(target).isFile() && isAcceptedHistoricalHookFile(reference, readFileSync6(target))
    );
  } catch {
    return false;
  }
}
function acceptedLegacyHookFile(value, projectRoot) {
  if (typeof value === 'string') return acceptedLegacyHookReference(value, projectRoot);
  if (Array.isArray(value)) {
    return value.some(child => acceptedLegacyHookFile(child, projectRoot));
  }
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => acceptedLegacyHookFile(child, projectRoot));
}
function viableLegacyAuthority(event, projectRoot) {
  const settingsPaths = /* @__PURE__ */ new Set([
    nodePath10.join(projectRoot, '.claude/settings.json'),
    nodePath10.join(projectRoot, '.claude/settings.local.json'),
    nodePath10.join(claudeConfigDirectory(), 'settings.json'),
  ]);
  return [...settingsPaths].some(settingsPath => {
    const settings = parseSettings(settingsPath);
    const hooks = settings?.hooks;
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return false;
    const entries = hooks[event];
    return (
      Array.isArray(entries) &&
      entries.some(
        entry =>
          isAcceptedHistoricalHook(event, entry) && acceptedLegacyHookFile(entry, projectRoot),
      )
    );
  });
}
function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === void 0 || value === '') throw new Error(`${name} is required.`);
  return value;
}
function readIdentity(pluginRoot) {
  const value = JSON.parse(readFileSync6(nodePath10.join(pluginRoot, 'identity.json'), 'utf8'));
  if (
    value.schema_version !== 1 ||
    typeof value.plugin_version !== 'string' ||
    !/^[\da-f]{64}$/u.test(value.hook_manifest_sha256 ?? '') ||
    !/^[\da-f]{64}$/u.test(value.inventory_sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin identity is malformed.');
  }
  return value;
}
function assertSafeInventoryAsset(asset) {
  const pathSegments = typeof asset.path === 'string' ? asset.path.split(/[\\/]/u) : [];
  if (
    typeof asset.path !== 'string' ||
    nodePath10.isAbsolute(asset.path) ||
    pathSegments.includes('..') ||
    !/^[\da-f]{64}$/u.test(asset.sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin inventory contains an unsafe asset.');
  }
}
function verifyInventoryAsset(pluginRoot, asset) {
  assertSafeInventoryAsset(asset);
  const assetPath = nodePath10.join(pluginRoot, asset.path);
  let isFile;
  try {
    isFile = lstatSync5(assetPath).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Safeword Claude plugin asset is missing: ${asset.path}`, { cause: error });
    }
    throw error;
  }
  if (!isFile) {
    throw new Error(`Safeword Claude plugin asset is not a regular file: ${asset.path}`);
  }
  const content = readFileSync6(assetPath);
  const actualDigest = createHash6('sha256').update(content).digest('hex');
  if (!claudeAssetMatches(asset, content)) {
    throw new Error(
      `Safeword Claude plugin asset failed integrity validation: ${asset.path} (${actualDigest})`,
    );
  }
  return content;
}
function verifyInventory(pluginRoot, identity) {
  const inventoryContent = readFileSync6(nodePath10.join(pluginRoot, 'inventory.json'), 'utf8');
  const inventoryDigest = createHash6('sha256').update(inventoryContent).digest('hex');
  if (inventoryDigest !== identity.inventory_sha256) {
    throw new Error('Safeword Claude plugin inventory does not match its bundled identity.');
  }
  const inventory = JSON.parse(inventoryContent);
  if (inventory.schema_version !== 1 || !Array.isArray(inventory.assets)) {
    throw new Error('Safeword Claude plugin inventory is malformed.');
  }
  for (const asset of inventory.assets) assertSafeInventoryAsset(asset);
  const inventoryPaths = new Set(inventory.assets.map(asset => asset.path));
  if (inventoryPaths.size !== inventory.assets.length) {
    throw new Error('Safeword Claude plugin inventory contains duplicate asset paths.');
  }
  for (const requiredPath of CLAUDE_NATIVE_REQUIRED_ASSETS) {
    if (!inventoryPaths.has(requiredPath)) {
      throw new Error(
        `Safeword Claude plugin inventory is missing required asset: ${requiredPath}`,
      );
    }
  }
  const verifiedAssets = /* @__PURE__ */ new Map();
  for (const asset of inventory.assets) {
    verifiedAssets.set(asset.path, verifyInventoryAsset(pluginRoot, asset));
  }
  const expectedPaths = /* @__PURE__ */ new Set([
    ...inventory.assets.map(asset => asset.path),
    ...CLAUDE_NATIVE_METADATA_FILES,
  ]);
  const unexpectedPath = claudeNativePayloadFiles(pluginRoot).find(
    path => !expectedPaths.has(path),
  );
  if (unexpectedPath !== void 0) {
    throw new Error(`Safeword Claude plugin contains an unlisted asset: ${unexpectedPath}`);
  }
  return verifiedAssets;
}
function verifyManifest(pluginRoot, identity) {
  const manifest = readFileSync6(nodePath10.join(pluginRoot, 'hooks', 'hooks.json'));
  const digest2 = createHash6('sha256').update(manifest).digest('hex');
  if (digest2 !== identity.hook_manifest_sha256) {
    throw new Error('Safeword Claude plugin hook manifest does not match its bundled identity.');
  }
}
function writeDurableRecord(pluginData, filename, record2) {
  writeDurableFile(
    nodePath10.join(pluginData, filename),
    `${JSON.stringify(record2, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
}
function recordExecutionProof(event, pluginRoot, identity, input) {
  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  writeDurableRecord(claudeProofDirectory(), `${claudeProjectDigest(projectRoot)}.json`, {
    schema_version: 2,
    project_root: projectRoot,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    canonical_plugin_root: pluginRoot,
    event,
    session_id: input.session_id,
    recorded_at: /* @__PURE__ */ new Date().toISOString(),
  });
}
function recordCacheSmoke(event, pluginRoot, identity, input) {
  if (event !== 'Setup') return;
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  writeDurableRecord(claudePluginDataDirectory(), 'cache-smoke-v1.json', {
    schema_version: 1,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    inventory_sha256: identity.inventory_sha256,
    canonical_plugin_root: pluginRoot,
    project_root: projectRoot,
    event,
    session_id: input.session_id,
    recorded_at: /* @__PURE__ */ new Date().toISOString(),
  });
}
function runFunctionalCommand(arguments_, input, captureOutput = false) {
  if (arguments_.length === 0) return { status: 0, stdout: '' };
  const [executable, ...parameters] = arguments_;
  if (executable === void 0) return { status: 0, stdout: '' };
  const result = spawnSync2(executable, parameters, {
    // Bun snapshots the parent environment for child_process unless it is
    // passed explicitly. The dispatcher sets SAFEWORD_PLUGIN_CLI at runtime,
    // so aggregate child hooks need the current environment rather than the
    // startup snapshot.
    env: process.env,
    input,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', captureOutput ? 'pipe' : 'inherit', 'inherit'],
  });
  if (result.error !== void 0) {
    process.stderr.write(`Safeword hook command could not start: ${result.error.message}
`);
  }
  return {
    status: result.status ?? 1,
    stdout: captureOutput ? (result.stdout?.toString('utf8') ?? '') : '',
  };
}
var MATCHER_SUBJECT_FIELD_BY_EVENT = {
  ConfigChange: 'source',
  CwdChanged: false,
  DirectoryAdded: 'source',
  Elicitation: 'mcp_server_name',
  ElicitationResult: 'mcp_server_name',
  FileChanged: 'file_path',
  InstructionsLoaded: 'load_reason',
  MessageDisplay: false,
  Notification: 'notification_type',
  PermissionDenied: 'tool_name',
  PermissionRequest: 'tool_name',
  PostCompact: 'trigger',
  PostModelSwitch: 'to_model',
  PostToolBatch: false,
  PostToolUse: 'tool_name',
  PostToolUseFailure: 'tool_name',
  PreCompact: 'trigger',
  PreModelSwitch: 'to_model',
  PreToolUse: 'tool_name',
  SessionEnd: 'reason',
  SessionStart: 'source',
  Setup: 'trigger',
  Stop: false,
  StopFailure: 'error',
  SubagentStart: 'agent_type',
  SubagentStop: 'agent_type',
  TaskCompleted: false,
  TaskCreated: false,
  TeammateIdle: false,
  UserPromptExpansion: 'command_name',
  UserPromptSubmit: false,
  WorktreeCreate: false,
  WorktreeRemove: false,
};
function eventMatcherSubject(event, input) {
  const field = MATCHER_SUBJECT_FIELD_BY_EVENT[event];
  if (field === void 0) {
    throw new TypeError(`Safeword cannot evaluate a matcher for unknown Claude event: ${event}`);
  }
  if (field === false) return { supported: false };
  const subject = input[field];
  return {
    supported: true,
    value: event === 'FileChanged' && subject ? nodePath10.basename(subject) : subject,
  };
}
function eventEntryMatches(event, entry, input) {
  if (entry.matcher === void 0 || ['', '*'].includes(entry.matcher)) return true;
  const subject = eventMatcherSubject(event, input);
  if (!subject.supported) return true;
  if (subject.value === void 0) return false;
  const exactMatcherCharacters =
    event === 'FileChanged' || event === 'StopFailure' ? /^[\w|]+$/u : /^[\w\- ,|]+$/u;
  if (exactMatcherCharacters.test(entry.matcher)) {
    return entry.matcher
      .split(/[|,]/u)
      .map(candidate => candidate.trim())
      .includes(subject.value);
  }
  return new RegExp(entry.matcher, 'u').test(subject.value);
}
function readEventEntries(event, eventGroupsContent) {
  const value = JSON.parse(eventGroupsContent.toString('utf8'));
  if (value.schema_version !== 1 || typeof value.groups !== 'object' || value.groups === null) {
    throw new TypeError('Safeword Claude plugin event groups are malformed.');
  }
  const entries = value.groups[event];
  if (!Array.isArray(entries)) {
    throw new TypeError(`Safeword Claude plugin event group is missing: ${event}`);
  }
  return entries;
}
function appendUniqueText(current, next) {
  if (typeof current !== 'string' || current === '') return next;
  if (current.split('\n').includes(next)) return current;
  return `${current}
${next}`;
}
function mergeBooleanResponse(target, key, current, value) {
  if (typeof current !== 'boolean' || typeof value !== 'boolean') return false;
  if (key === 'continue') target[key] = current && value;
  else if (key === 'suppressOutput') target[key] = current || value;
  else return false;
  return true;
}
function mergeTextResponse(target, key, current, value) {
  if (
    !['permissionDecisionReason', 'reason', 'stopReason', 'systemMessage'].includes(key) ||
    typeof current !== 'string' ||
    typeof value !== 'string'
  ) {
    return false;
  }
  target[key] = appendUniqueText(current, value);
  return true;
}
var PERMISSION_DECISION_PRECEDENCE = ['allow', 'ask', 'defer', 'deny'];
function mergePermissionDecision(target, key, value) {
  const current = target[key];
  if (key !== 'permissionDecision' || typeof current !== 'string' || typeof value !== 'string') {
    return false;
  }
  const currentRank = PERMISSION_DECISION_PRECEDENCE.indexOf(current);
  const valueRank = PERMISSION_DECISION_PRECEDENCE.indexOf(value);
  if (currentRank === -1 || valueRank === -1) return false;
  target[key] = PERMISSION_DECISION_PRECEDENCE[Math.max(currentRank, valueRank)];
  return true;
}
function mergeScalarResponse(target, key, value) {
  const current = target[key];
  if (current === void 0 || JSON.stringify(current) === JSON.stringify(value)) {
    target[key] = value;
    return;
  }
  if (mergeBooleanResponse(target, key, current, value)) return;
  if (mergeTextResponse(target, key, current, value)) return;
  if (mergePermissionDecision(target, key, value)) return;
  if (key === 'decision' && (current === 'block' || value === 'block')) {
    target[key] = 'block';
    return;
  }
  throw new Error(`Safeword Claude plugin sibling hooks returned conflicting ${key} values.`);
}
function specificOutput(target, event) {
  const current = target.hookSpecificOutput;
  if (current !== void 0) return current;
  const created = { hookEventName: event };
  target.hookSpecificOutput = created;
  return created;
}
function parseHookOutput(event, target, trimmed) {
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      if (event !== 'SessionStart' && event !== 'UserPromptSubmit') {
        throw new TypeError(`Safeword cannot safely aggregate plain ${event} hook output.`);
      }
      const output = specificOutput(target, event);
      output.additionalContext = appendUniqueText(output.additionalContext, trimmed);
      return void 0;
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    if (event !== 'SessionStart' && event !== 'UserPromptSubmit') {
      throw new TypeError(`Safeword cannot safely aggregate unparseable ${event} hook output.`, {
        cause: error,
      });
    }
    process.stderr.write(
      `Safeword received unparseable ${event} sibling-hook output; treating it as context, not authorization.
`,
    );
    const output = specificOutput(target, event);
    output.additionalContext = appendUniqueText(output.additionalContext, trimmed);
    return void 0;
  }
}
function mergeSpecificOutput(event, target, value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Safeword Claude plugin hookSpecificOutput must be an object.');
  }
  const source = value;
  if (source.hookEventName !== event) {
    throw new Error(`Safeword Claude plugin sibling returned the wrong hook event for ${event}.`);
  }
  const destination = specificOutput(target, event);
  for (const [key, next] of Object.entries(source)) {
    if (key === 'hookEventName') continue;
    if (key === 'additionalContext' && typeof next === 'string') {
      destination.additionalContext = appendUniqueText(destination.additionalContext, next);
    } else {
      mergeScalarResponse(destination, key, next);
    }
  }
}
function mergeHookOutput(event, target, output) {
  const trimmed = output.trim();
  if (trimmed === '') return;
  const response = parseHookOutput(event, target, trimmed);
  if (response === void 0) return;
  for (const [key, value] of Object.entries(response)) {
    if (key === 'hookSpecificOutput') mergeSpecificOutput(event, target, value);
    else mergeScalarResponse(target, key, value);
  }
}
function appendMigrationAdvisory(event, output, advisory) {
  const response = {};
  mergeHookOutput(event, response, output);
  const specific = specificOutput(response, event);
  specific.additionalContext = appendUniqueText(specific.additionalContext, advisory);
  return `${JSON.stringify(response)}
`;
}
function safeAppendMigrationAdvisory(event, output, advisory) {
  try {
    return appendMigrationAdvisory(event, output, advisory);
  } catch {
    return output;
  }
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(child => stableJson(child)).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'undefined';
  return `{${Object.entries(value)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
    .join(',')}}`;
}
function scopeDeclaration(path) {
  const settings = parseSettings(path);
  const enabledPlugins = settings?.enabledPlugins;
  const marketplaces = settings?.extraKnownMarketplaces;
  return {
    enabled:
      typeof enabledPlugins === 'object' &&
      enabledPlugins !== null &&
      !Array.isArray(enabledPlugins) &&
      enabledPlugins['safeword@safeword'] === true,
    marketplace:
      typeof marketplaces === 'object' && marketplaces !== null && !Array.isArray(marketplaces)
        ? marketplaces.safeword
        : void 0,
  };
}
function incompatibleScopeOverlap(projectRoot) {
  const project = scopeDeclaration(nodePath10.join(projectRoot, '.claude/settings.json'));
  const user = scopeDeclaration(nodePath10.join(claudeConfigDirectory(), 'settings.json'));
  return (
    project.enabled &&
    user.enabled &&
    stableJson(project.marketplace) !== stableJson(user.marketplace)
  );
}
function advisoryExecution(context, advisory, stateDigest = advisoryStateDigest(advisory)) {
  const { event, execution, projectRoot, sessionId } = context;
  if (!claimClaudeMigrationAdvisory(projectRoot, sessionId, stateDigest)) return execution;
  return {
    ...execution,
    stdout: appendMigrationAdvisory(event, execution.stdout, advisory),
  };
}
function scopeOverlapExecution(context, identity, catalogueSha256) {
  const { projectRoot } = context;
  const advisory =
    'Safeword found different project and user Claude plugin declarations. It preserved the old integration and did not block your prompt. Align the two Safeword plugin versions, then retry.';
  const stateDigest = advisoryStateDigest(advisory);
  writeClaudeMigrationAttention(projectRoot, {
    schema_version: 1,
    state_digest: stateDigest,
    plugin_version: identity.plugin_version,
    catalogue_sha256: catalogueSha256,
    watched_settings_sha256: claudeWatchedSettingsDigest(projectRoot),
    classification: 'scope-overlap',
    advisory,
  });
  return advisoryExecution(context, advisory, stateDigest);
}
function automaticMigrationAttemptKind(projectRoot) {
  return existsSync7(claudeProjectStatePath(projectRoot, 'transaction')) ? 'recovery' : 'migration';
}
function automaticMigrationProjectRoot(event, hookCwd) {
  if (event !== 'UserPromptSubmit') return void 0;
  const projectRoot = canonicalClaudeProjectRoot(hookCwd ?? process.cwd());
  return isDogfoodRepo(projectRoot) ? void 0 : projectRoot;
}
function automaticMigrationUnsafe(event, identity, execution, sessionId, hookCwd) {
  const projectRoot = automaticMigrationProjectRoot(event, hookCwd);
  if (projectRoot === void 0) return execution;
  const context = { event, execution, projectRoot, sessionId };
  const catalogueSha256 = historicalCatalogueDigest();
  if (incompatibleScopeOverlap(projectRoot)) {
    return scopeOverlapExecution(context, identity, catalogueSha256);
  }
  const marker = readClaudePluginMode(projectRoot);
  if (
    marker !== void 0 &&
    pluginModeIsTerminal(marker, {
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      catalogue_sha256: catalogueSha256,
    }) &&
    claudeLegacyMutations(projectRoot).length === 0
  ) {
    return execution;
  }
  if (
    !claimClaudeMigrationAttempt(projectRoot, sessionId, automaticMigrationAttemptKind(projectRoot))
  ) {
    const advisory =
      'Safeword could not finish retiring the old Claude integration in this session. Your prompt was not blocked; run `safeword claude recover` to repair it now, or start a new Claude session to retry automatically.';
    return advisoryExecution(context, advisory);
  }
  const result = migrateClaudeLegacyAutomatically(projectRoot, {
    pluginVersion: identity.plugin_version,
    hookManifestSha256: identity.hook_manifest_sha256,
    catalogueSha256,
    deadline: Date.now() + 2e3,
  });
  if (result.state === 'complete') removeLegacyClaudePluginMode(projectRoot);
  return result.advisory === void 0 ? execution : advisoryExecution(context, result.advisory);
}
function automaticMigration(event, identity, execution, sessionId, hookCwd) {
  try {
    return automaticMigrationUnsafe(event, identity, execution, sessionId, hookCwd);
  } catch (error) {
    if (event !== 'UserPromptSubmit') return execution;
    const advisory = `Safeword could not inspect the old Claude integration: ${error instanceof Error ? error.message : String(error)} Your prompt was not blocked; run \`safeword claude status\` for the repair action.`;
    return { ...execution, stdout: safeAppendMigrationAdvisory(event, execution.stdout, advisory) };
  }
}
function executionProofFailure(event, execution, error) {
  if (event !== 'UserPromptSubmit') {
    process.stderr.write(
      `Safeword could not record native plugin proof during ${event}: ${error instanceof Error ? error.message : String(error)}
`,
    );
    return execution;
  }
  const advisory = `Safeword could not record native plugin proof: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; verify protection with \`safeword claude status\`.`;
  return { ...execution, stdout: safeAppendMigrationAdvisory(event, execution.stdout, advisory) };
}
function postExecutionLifecycle(event, pluginRoot, identity, hookInput, execution) {
  try {
    recordExecutionProof(event, pluginRoot, identity, hookInput);
  } catch (error) {
    return executionProofFailure(event, execution, error);
  }
  try {
    recordCacheSmoke(event, pluginRoot, identity, hookInput);
  } catch {}
  return automaticMigration(event, identity, execution, hookInput.session_id, hookInput.cwd);
}
function degradedPluginResponse(event, advisory) {
  if (event === 'PreToolUse') {
    const recovery = `${advisory} Approve only a repair or diagnostic action; run \`safeword claude status\` to get the exact repair action.`;
    return {
      kind: 'damaged',
      status: 0,
      stderr: '',
      stdout: `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event,
          permissionDecision: 'ask',
          permissionDecisionReason: recovery,
          additionalContext: recovery,
        },
      })}
`,
    };
  }
  if (event !== 'UserPromptSubmit') {
    return {
      kind: 'damaged',
      status: 0,
      stderr: `${advisory}
`,
      stdout: '',
    };
  }
  const promptAdvisory = `${advisory} The prompt was not blocked.`;
  return {
    kind: 'damaged',
    status: 0,
    stderr: '',
    stdout: safeAppendMigrationAdvisory(event, '', promptAdvisory),
  };
}
function verifyPlugin(event, pluginRoot) {
  try {
    const identity = readIdentity(pluginRoot);
    verifyManifest(pluginRoot, identity);
    const verifiedAssets = verifyInventory(pluginRoot, identity);
    const eventGroupsContent = verifiedAssets.get('runtime/event-groups.json');
    if (eventGroupsContent === void 0) {
      throw new Error('Safeword Claude plugin verified event groups are unavailable.');
    }
    return { kind: 'verified', eventGroupsContent, identity };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return degradedPluginResponse(
      event,
      `Safeword detected a damaged native plugin cache: ${detail} No Safeword hook result was applied.`,
    );
  }
}
function emitDamagedPlugin(response) {
  if (response.stdout !== '') process.stdout.write(response.stdout);
  if (response.stderr !== '') process.stderr.write(response.stderr);
  return response.status;
}
function runEventHooks(event, hooks, standardInput, response) {
  for (const hook of hooks) {
    if (hook.type !== 'command' || typeof hook.command !== 'string') {
      throw new Error(`Safeword Claude plugin event group has an unsupported ${event} hook.`);
    }
    const result = runFunctionalCommand(['bash', '-c', hook.command], standardInput, true);
    if (result.status !== 0) {
      return 2;
    }
    mergeHookOutput(event, response, result.stdout);
  }
  return 0;
}
function runEventGroup(event, eventGroupsContent, hookInput, standardInput) {
  const entries = readEventEntries(event, eventGroupsContent);
  const response = {};
  for (const entry of entries) {
    if (!eventEntryMatches(event, entry, hookInput)) continue;
    const hooks = entry.hooks ?? [];
    const status = runEventHooks(event, hooks, standardInput, response);
    if (status !== 0) {
      if (event === 'UserPromptSubmit') {
        const priorReason = typeof response.reason === 'string' ? ` ${response.reason}` : '';
        process.stderr.write(
          `Safeword blocked prompt submission because a sibling hook failed; later checks did not run.${priorReason}
`,
        );
        return { postExecutionEligible: false, status: 2, stdout: '' };
      }
      return { status, stdout: '' };
    }
  }
  return {
    status: 0,
    stdout:
      Object.keys(response).length === 0
        ? ''
        : `${JSON.stringify(response)}
`,
  };
}
function functionalExecutionFailure(event, error) {
  if (event !== 'UserPromptSubmit') {
    process.stderr.write(
      `Safeword could not safely combine its ${event} hook output: ${error instanceof Error ? error.message : String(error)}
`,
    );
    return { status: 2, stdout: '' };
  }
  const advisory = `Safeword could not combine its Claude hook output: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; no combined Safeword hook result was applied.`;
  return {
    postExecutionEligible: false,
    status: 0,
    stdout: safeAppendMigrationAdvisory(event, '', advisory),
  };
}
function parseHookInput(standardInput) {
  try {
    const parsed = JSON.parse(standardInput.toString('utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function executeConfiguredHooks(input) {
  try {
    if (viableLegacyAuthority(input.event, input.projectRoot)) return { status: 0, stdout: '' };
    return input.mode === '--event-group'
      ? runEventGroup(input.event, input.eventGroupsContent, input.hookInput, input.standardInput)
      : runFunctionalCommand(
          input.command,
          input.standardInput,
          input.event === 'UserPromptSubmit',
        );
  } catch (error) {
    return functionalExecutionFailure(input.event, error);
  }
}
function exposePackagedSafewordContext(pluginRoot) {
  const packagedSafewordPath = nodePath10.join(pluginRoot, 'resources', 'SAFEWORD.md');
  if (existsSync7(packagedSafewordPath)) {
    process.env.SAFEWORD_PACKAGED_CONTEXT_PATH = packagedSafewordPath;
  } else {
    delete process.env.SAFEWORD_PACKAGED_CONTEXT_PATH;
  }
}
function completeSuccessfulExecution(input) {
  if (input.execution.status !== 0 || input.execution.postExecutionEligible === false) {
    return input.execution;
  }
  return postExecutionLifecycle(
    input.event,
    input.pluginRoot,
    input.identity,
    input.hookInput,
    input.execution,
  );
}
function executeVerifiedPlugin(input) {
  try {
    return completeSuccessfulExecution({
      event: input.event,
      pluginRoot: input.pluginRoot,
      identity: input.identity,
      hookInput: input.hookInput,
      execution: executeConfiguredHooks(input),
    });
  } catch (error) {
    return functionalExecutionFailure(input.event, error);
  }
}
function mainUnsafe(event, mode, command) {
  if (mode !== void 0 && mode !== '--' && mode !== '--event-group') {
    throw new Error('Expected -- or --event-group after the hook event.');
  }
  if (mode !== '--event-group' && command.length === 0) {
    throw new Error('A direct hook command is required.');
  }
  const pluginRoot = realpathSync3(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
  process.env.SAFEWORD_PLUGIN_CLI = nodePath10.join(pluginRoot, 'runtime', 'cli.js');
  exposePackagedSafewordContext(pluginRoot);
  const standardInput = readFileSync6(0);
  const hookInput = parseHookInput(standardInput);
  const projectRoot = canonicalClaudeProjectRoot(hookInput.cwd ?? process.cwd());
  const verification = verifyPlugin(event, pluginRoot);
  if (verification.kind === 'damaged') return emitDamagedPlugin(verification);
  const { eventGroupsContent, identity } = verification;
  const execution = executeVerifiedPlugin({
    event,
    mode,
    command,
    pluginRoot,
    identity,
    eventGroupsContent,
    hookInput,
    projectRoot,
    standardInput,
  });
  if (execution.status === 0 && execution.stdout !== '') process.stdout.write(execution.stdout);
  return execution.status;
}
function startupFailure(event, error) {
  const detail = error instanceof Error ? error.message : String(error);
  if (event === void 0) {
    process.stderr.write(`Safeword could not safely start its unknown hook: ${detail}
`);
    return 2;
  }
  const advisory = `Safeword could not start its Claude hook: ${detail} No Safeword hook result was applied.`;
  return emitDamagedPlugin(degradedPluginResponse(event, advisory));
}
function main() {
  const [event, mode, ...command] = process.argv.slice(2);
  try {
    if (event === void 0) throw new Error('Claude hook event is required.');
    return mainUnsafe(event, mode, command);
  } catch (error) {
    return startupFailure(event, error);
  }
}
process.exitCode = main();
