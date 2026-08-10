// claude-plugin/runtime/dispatch.ts
import { spawnSync as spawnSync2 } from 'node:child_process';
import { createHash as createHash4 } from 'node:crypto';
import {
  existsSync as existsSync5,
  lstatSync as lstatSync4,
  readFileSync as readFileSync4,
  realpathSync as realpathSync2,
} from 'node:fs';
import nodePath8 from 'node:path';

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
import nodePath from 'node:path';
function writeDurableFile(path, content, options) {
  const directory = nodePath.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath.join(
    directory,
    `.${nodePath.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
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
  const directory = nodePath.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath.join(
    directory,
    `.${nodePath.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
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
    descriptor = openSync(nodePath.dirname(destination), 'r');
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

// claude-plugin/cleanup.ts
import { createHash as createHash3, randomUUID as randomUUID2 } from 'node:crypto';
import {
  chmodSync,
  existsSync as existsSync4,
  lstatSync as lstatSync3,
  mkdirSync as mkdirSync3,
  readdirSync as readdirSync2,
  readFileSync as readFileSync3,
  rmdirSync,
  rmSync as rmSync3,
} from 'node:fs';
import nodePath7 from 'node:path';

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
    ...(input.presentation !== void 0 && { presentation: input.presentation }),
    ...(input.data !== void 0 && { data: input.data }),
  };
}

// claude-plugin/cleanup-target.ts
import { existsSync, lstatSync } from 'node:fs';
import nodePath2 from 'node:path';
function containedClaudeCleanupPath(cwd, relative) {
  if (
    relative === '' ||
    nodePath2.isAbsolute(relative) ||
    relative.split(/[\\/]/u).includes('..')
  ) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  const root = nodePath2.resolve(cwd);
  const target = nodePath2.resolve(root, relative);
  if (!target.startsWith(`${root}${nodePath2.sep}`)) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  return target;
}
function assertSafeClaudeCleanupTarget(cwd, relative) {
  const target = containedClaudeCleanupPath(cwd, relative);
  let cursor = nodePath2.resolve(cwd);
  for (const segment of relative.split(/[\\/]/u)) {
    cursor = nodePath2.join(cursor, segment);
    if (!existsSync(cursor)) continue;
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

// claude-plugin/inventory.ts
import { readdirSync } from 'node:fs';
import nodePath3 from 'node:path';
var CLAUDE_MIGRATION_SCHEMA = {
  paths: {
    proof: 'plugins/data/safeword-safeword/execution-proof-v1.json',
    proofDirectory: 'plugins/data/safeword-safeword/execution-proofs-v2',
    pluginMarker: '.safeword/claude-plugin/plugin-mode-v1.json',
    pluginMarkerV2: '.safeword/claude-plugin/plugin-mode-v2.json',
    attention: '.safeword/claude-plugin/attention-v1.json',
    attemptsDirectory: '.safeword/claude-plugin/attempts-v1',
    transaction: '.safeword/claude-plugin/cleanup-transaction-v1.json',
  },
};
var CLAUDE_NATIVE_REQUIRED_ASSETS = [
  '.claude-plugin/plugin.json',
  'hooks/hooks.json',
  'runtime/cli.js',
  'runtime/dispatch.js',
  'runtime/event-groups.json',
];
var CLAUDE_NATIVE_METADATA_FILES = ['README.md', 'identity.json', 'inventory.json'];
var BENIGN_CACHE_METADATA_BASENAMES = /* @__PURE__ */ new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
]);
function claudeNativePayloadFiles(root) {
  const files = [];
  const visit3 = (physicalDirectory, logicalDirectory) => {
    const entries = readdirSync(physicalDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (logicalDirectory === '' && entry.isDirectory() && entry.name === '.in_use') continue;
      const physicalPath = nodePath3.join(physicalDirectory, entry.name);
      const logicalPath =
        logicalDirectory === '' ? entry.name : nodePath3.posix.join(logicalDirectory, entry.name);
      if (entry.isDirectory()) visit3(physicalPath, logicalPath);
      else if (!BENIGN_CACHE_METADATA_BASENAMES.has(entry.name)) files.push(logicalPath);
    }
  };
  visit3(root, '');
  return files;
}

// claude-plugin/legacy-classifier.ts
import { existsSync as existsSync2, lstatSync as lstatSync2, readFileSync } from 'node:fs';
import nodePath4 from 'node:path';

// claude-plugin/historical-ownership.ts
import { createHash } from 'node:crypto';

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
        '0f4bc744e55e6e404dee4258b6180b111828ec833b66997ade79b0d159f7e8d4',
      '.claude/agents/safeword-reviewer.md':
        '5cc17d5cec1a6df812770cf80667673279bf1acc1bb961ebe458f8c5b58bdc1a',
      '.claude/skills/audit/SKILL.md':
        '784da329a70fe34b6e3a477b50caaee0d6bbfc1a3ed1d33b213fd9fb55346f4d',
      '.claude/skills/bdd/DISCOVERY.md':
        'c229895c53030b8f44ff563dd3728d8f4a4e4e593d8c29ae9349283ea25b5d91',
      '.claude/skills/bdd/DONE.md':
        'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
      '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
        'bf1b303505bae2ea3c66b699cfe8f24614f4c1be63d1ac20ee4ddf5ec76a2916',
      '.claude/skills/bdd/SCENARIOS.md':
        '2cf7c403e6a50c5ee1574f6e0a0965ee4afcbda9d0ec4580b425723ec5d4f83d',
      '.claude/skills/bdd/SKILL.md':
        'ec82db67adaa26f852779687b205b0fbcbc143e257d81cdc527ab320d4b0b756',
      '.claude/skills/bdd/SPLITTING.md':
        'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
      '.claude/skills/bdd/TDD.md':
        '1a9f64fd5161883f8e9dcbf506605b52cd6357cd3497338f1eccdbf92b2a504f',
      '.claude/skills/bdd/VERIFY.md':
        '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
      '.claude/skills/brainstorm/SKILL.md':
        'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
      '.claude/skills/cleanup-zombies/SKILL.md':
        'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
      '.claude/skills/closeout/SKILL.md':
        '8f995e4e149223b730edbe718b8710837c26a4a1ad4daf5b40c0ba661fafc09d',
      '.claude/skills/debug/SKILL.md':
        'ae56c4c9287f76a2250d13fa9908f5726ed4edbe4080ece10d1559507e242bd0',
      '.claude/skills/elicit/SKILL.md':
        '2638c773ce241a886563d1db8abbee70d72edefa780f762c0ed095df0f65cee5',
      '.claude/skills/explain/SKILL.md':
        '6673eccef3a9e68659c4e4b81b1e63bf9da03b1ae802dc7d22f419cb7c65472d',
      '.claude/skills/figure-it-out/SKILL.md':
        '4552275007b0161037a1791233722a89dac16f963f55aab80fc7a9b6b37f67d4',
      '.claude/skills/finish-review/REVIEWER.md':
        '1fdbcc909088278f39f69bb77efe49cf422333210e5b393f3a2a247e898e7efa',
      '.claude/skills/finish-review/SKILL.md':
        '09945ab0feae863101a31794a669b8d82fb8b08dafcd3cd990630a7916759768',
      '.claude/skills/lint/SKILL.md':
        '208ec54032cabdcb532d1070e5ef5f1fcd6f0f0bfe8daf08e4ecf007aa285f66',
      '.claude/skills/quality-review/SKILL.md':
        'c26985e7100390b7d79c569f71e15cf8223972dfac41b4527ccce0afccdebdec',
      '.claude/skills/refactor/SKILL.md':
        'ecfd1b594e9a4c18387e6b9bc84a5bd1ded6b0b3df40a69271ba779ce2b7f122',
      '.claude/skills/retro-filer/SKILL.md':
        '8e92f1a7579ba1dd70ced8e9815be0eeed3bc09d43c310a5646ff93c428412ff',
      '.claude/skills/retro/SKILL.md':
        '8e7b5912810c1e0fe596ff2367b5bc7d3890bd86db5719f49e3c0227b0fdd44a',
      '.claude/skills/review-spec/SKILL.md':
        '4188d2cf86c63c19622149eabbbd93391b6740b67735a8c0891df366accbc38d',
      '.claude/skills/self-review/SKILL.md':
        '51bccc782884dc2ef6171465909df2726875bb308d0004fd2bbed13e51208ffc',
      '.claude/skills/spike/SKILL.md':
        '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
      '.claude/skills/tdd-review/SKILL.md':
        'f49a7e07dea7a62f39e9919c0c4251ede4ec2dec72b9892e7e0c42205d510e6f',
      '.claude/skills/testing/SKILL.md':
        '697a4b090935989e0c8a53462d2b44087afafa50adc69e9a98da14bed23dbde9',
      '.claude/skills/ticket-system/SKILL.md':
        '12798a8ebd1fb2bb65b4ee42fb3611d12f6817bc6cd27af829294ef31bfed27b',
      '.claude/skills/verify/SKILL.md':
        '71a6236f9522df0ac6d9f6627d4b66e57dc5067d71c0b64cd66da2cdf5c2f24c',
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
  return createHash('sha256').update(content).digest('hex');
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
    if (!existsSync2(path)) continue;
    try {
      const safePath = assertSafeClaudeCleanupTarget(cwd, relativePath);
      const regular = lstatSync2(safePath).isFile();
      if (regular && isAcceptedHistoricalFile(relativePath, readFileSync(safePath))) {
        recognizedFiles.push(relativePath);
      } else {
        conflictingFiles.push(relativePath);
      }
    } catch {
      if (existsSync2(path)) conflictingFiles.push(relativePath);
    }
  }
  return { recognizedFiles, conflictingFiles };
}
function observeSettings(cwd) {
  const settingsPath = nodePath4.join(cwd, '.claude/settings.json');
  if (!existsSync2(settingsPath)) return { recognizedHooks: [], conflictingHooks: [] };
  if (!lstatSync2(settingsPath).isFile()) {
    return {
      recognizedHooks: [],
      conflictingHooks: [],
      settingsError: '.claude/settings.json is not a regular file.',
    };
  }
  const errors = [];
  const settings = parse2(readFileSync(settingsPath, 'utf8'), errors, {
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
import { createHash as createHash2 } from 'node:crypto';
import {
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync2,
  rmSync as rmSync2,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath5 from 'node:path';
function createClaudePluginMode(marker) {
  return {
    ...marker,
    schema_version: 2,
    state: marker.unresolved_paths.length === 0 ? 'clean' : 'unresolved',
  };
}
function digest(value) {
  return createHash2('sha256').update(value).digest('hex');
}
function attemptsPath(cwd) {
  return nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attemptsDirectory);
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
  mkdirSync2(directory, { recursive: true, mode: 448 });
  const path = nodePath5.join(directory, 'initial-session-v1.json');
  exclusiveRecord(path, { schema_version: 1, session_digest: sessionDigest });
  try {
    const value = JSON.parse(readFileSync2(path, 'utf8'));
    return value.schema_version === 1 && validDigest(value.session_digest)
      ? value.session_digest
      : '';
  } catch {
    return '';
  }
}
function claimClaudeMigrationAttempt(cwd, sessionId, kind = 'migration') {
  const sessionDigest = digest(sessionId?.trim() || 'unknown-session');
  const initialSession = initialSessionDigest(cwd, sessionDigest) === sessionDigest;
  const limit = initialSession ? 3 : 1;
  const directory = nodePath5.join(
    attemptsPath(cwd),
    kind === 'recovery' && !initialSession ? 'recoveries' : 'launches',
  );
  mkdirSync2(directory, { recursive: true, mode: 448 });
  for (let slot = 1; slot <= limit; slot += 1) {
    if (
      exclusiveRecord(nodePath5.join(directory, `${sessionDigest}-${String(slot)}.json`), {
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
function claimClaudeMigrationAdvisory(cwd, sessionId, stateDigest) {
  const directory = nodePath5.join(attemptsPath(cwd), 'advisories');
  mkdirSync2(directory, { recursive: true, mode: 448 });
  const sessionDigest = digest(sessionId?.trim() || 'unknown-session');
  return exclusiveRecord(nodePath5.join(directory, `${sessionDigest}-${stateDigest}.json`), {
    schema_version: 1,
    session_digest: sessionDigest,
    state_digest: stateDigest,
  });
}
function advisoryStateDigest(advisory) {
  return digest(advisory);
}
function claudeConfigDirectory() {
  const configured = (process.env.CLAUDE_CONFIG_DIR ?? '').trim();
  return configured === '' ? nodePath5.join(homedir(), '.claude') : configured;
}
function claudeWatchedSettingsDigest(cwd) {
  const configDirectory = claudeConfigDirectory();
  const paths = [
    nodePath5.join(cwd, '.claude/settings.json'),
    nodePath5.join(configDirectory, 'settings.json'),
  ];
  const hash = createHash2('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(existsSync3(path) ? readFileSync2(path) : '<absent>');
    hash.update('\0');
  }
  return hash.digest('hex');
}
function markerPath(cwd) {
  return nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
}
function validDigest(value) {
  return typeof value === 'string' && /^[\da-f]{64}$/u.test(value);
}
function validPluginMode(value) {
  const unresolvedPaths2 = value.unresolved_paths;
  return [
    value.schema_version === 2,
    ['clean', 'unresolved'].includes(value.state ?? ''),
    typeof value.plugin_version === 'string',
    validDigest(value.hook_manifest_sha256),
    validDigest(value.catalogue_sha256),
    Array.isArray(unresolvedPaths2),
    Array.isArray(unresolvedPaths2) && unresolvedPaths2.every(item => typeof item === 'string'),
  ].every(Boolean);
}
function readClaudePluginMode(cwd) {
  const path = markerPath(cwd);
  if (!existsSync3(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync2(path, 'utf8'));
    return validPluginMode(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
function pluginModeIsTerminal(marker, catalogueSha256) {
  return marker.state === 'clean' || marker.catalogue_sha256 === catalogueSha256;
}
function writeClaudePluginMode(cwd, marker) {
  writeDurableFile(
    markerPath(cwd),
    `${JSON.stringify(marker, void 0, 2)}
`,
    { mode: 384 },
  );
}
function readClaudeMigrationAttention(cwd) {
  const path = nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attention);
  if (!existsSync3(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync2(path, 'utf8'));
    if (
      value.schema_version !== 1 ||
      !validDigest(value.state_digest) ||
      typeof value.plugin_version !== 'string' ||
      !validDigest(value.catalogue_sha256) ||
      !validDigest(value.watched_settings_sha256) ||
      typeof value.classification !== 'string' ||
      typeof value.advisory !== 'string'
    ) {
      return void 0;
    }
    return value;
  } catch {
    return void 0;
  }
}
function writeClaudeMigrationAttention(cwd, attention) {
  writeDurableFile(
    nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attention),
    `${JSON.stringify(attention, void 0, 2)}
`,
    { mode: 384 },
  );
}
function hasLegacyClaudePluginMode(cwd) {
  return existsSync3(nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker));
}
function removeLegacyClaudePluginMode(cwd) {
  rmSync2(nodePath5.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker), { force: true });
}

// claude-plugin/project-root.ts
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import nodePath6 from 'node:path';
function canonicalDirectory(path) {
  if (typeof path !== 'string' || path.trim() === '') return void 0;
  try {
    if (!statSync(path).isDirectory()) return void 0;
    return nodePath6.normalize(realpathSync(path));
  } catch {
    return void 0;
  }
}
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

// claude-plugin/cleanup.ts
function sha2562(content) {
  return createHash3('sha256').update(content).digest('hex');
}
function containsJsonComments(content) {
  let found = false;
  visit2(content, { onComment: () => (found = true) });
  return found;
}
function settingsMutation(cwd, legacy) {
  const relative = '.claude/settings.json';
  const path = nodePath7.join(cwd, relative);
  if (!existsSync4(path) || legacy.recognizedHooks.length === 0) return void 0;
  const original = readFileSync3(path, 'utf8');
  const parsed = parse2(original);
  const hooks = parsed.hooks ?? {};
  const allHookValuesAreArrays = Object.values(hooks).every(entries => Array.isArray(entries));
  const hookCount = Object.values(hooks).reduce(
    (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  const generatedHookOnlyFile =
    Object.keys(parsed).length === 1 &&
    allHookValuesAreArrays &&
    hookCount === legacy.recognizedHooks.length &&
    !containsJsonComments(original);
  if (generatedHookOnlyFile) return { path: relative, content: null };
  let content = original;
  const references = legacy.recognizedHooks.toSorted((left, right) => {
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
  return {
    path: relative,
    content,
  };
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
  return containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.transaction);
}
function writeTransaction(cwd, transaction) {
  const path = transactionPath(cwd);
  mkdirSync3(nodePath7.dirname(path), { recursive: true, mode: 448 });
  writeDurableFileExclusive(
    path,
    `${JSON.stringify(transaction, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
}
function entryFor(cwd, mutation) {
  const path = assertSafeClaudeCleanupTarget(cwd, mutation.path);
  const before = readFileSync3(path);
  const after = mutation.content === null ? null : Buffer.from(mutation.content);
  return {
    path: mutation.path,
    before_sha256: sha2562(before),
    before_base64: before.toString('base64'),
    before_mode: lstatSync3(path).mode & 511,
    after_sha256: after === null ? null : sha2562(after),
    after_base64: after === null ? null : after.toString('base64'),
    after_mode: after === null ? null : lstatSync3(path).mode & 511,
  };
}
function observedSha(path) {
  return existsSync4(path) ? sha2562(readFileSync3(path)) : null;
}
function pruneEmptyAncestors(root, path) {
  const canonicalRoot = nodePath7.resolve(root);
  let directory = nodePath7.dirname(nodePath7.resolve(path));
  while (directory.startsWith(`${canonicalRoot}${nodePath7.sep}`)) {
    try {
      if (readdirSync2(directory).length > 0) return;
      rmdirSync(directory);
    } catch {
      return;
    }
    directory = nodePath7.dirname(directory);
  }
}
function writeImage(root, path, content, mode) {
  if (content === null) {
    rmSync3(path, { force: true });
    pruneEmptyAncestors(root, path);
    return;
  }
  mkdirSync3(nodePath7.dirname(path), { recursive: true });
  writeDurableFile(path, Buffer.from(content, 'base64'), { mode: mode ?? 420 });
  chmodSync(path, mode ?? 420);
}
function applyEntries(cwd, entries, shouldDefer = () => false) {
  for (const entry of entries) {
    if (shouldDefer()) return false;
    const path = assertSafeClaudeCleanupTarget(cwd, entry.path);
    if (observedSha(path) !== entry.before_sha256) {
      throw new Error(`Claude cleanup target changed after planning: ${entry.path}`);
    }
    writeImage(cwd, path, entry.after_base64, entry.after_mode);
  }
  return true;
}
function writePluginModeMarker(cwd, transactionId) {
  const marker = containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker);
  mkdirSync3(nodePath7.dirname(marker), { recursive: true });
  writeDurableFile(
    marker,
    `${JSON.stringify({ schema_version: 1, mode: 'plugin', transaction_id: transactionId })}
`,
    { mode: 384 },
  );
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
  const marker = containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const maximumChecks = 25;
  for (let checks = 0; checks < maximumChecks && now() < deadline; checks += 1) {
    if (existsSync4(marker)) return true;
    const remaining = Math.max(1, deadline - now());
    Atomics.wait(pause, 0, 0, Math.min(20, remaining));
  }
  return existsSync4(marker);
}
function writeAutomaticPluginMode(cwd, transaction) {
  const pluginMode = transaction.plugin_mode;
  if (pluginMode === void 0) {
    writePluginModeMarker(cwd, transaction.transaction_id);
    return;
  }
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
function cleanupFailure(error, classification = 'coexistence') {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
    nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
    data: { command: 'claude cleanup', classification },
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
  if (recovered.state !== 'failed') return { state: 'complete', unresolvedPaths: [] };
  const detail =
    recovered.errors?.[0]?.message ?? 'the recorded cleanup transaction could not be read safely';
  return {
    state: 'attention',
    advisory: `Safeword preserved the old Claude integration because automatic recovery could not finish: ${detail} Your prompt was not blocked; run \`safeword claude recover\` to repair it.`,
    unresolvedPaths: [],
  };
}
function writeObservedPluginMode(projectRoot, options, unresolved, advisory) {
  writeClaudePluginMode(
    projectRoot,
    createClaudePluginMode({
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
    }),
  );
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}
function claimAutomaticTransaction(projectRoot, transaction, options, now, unresolved) {
  try {
    writeTransaction(projectRoot, transaction);
    return void 0;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (waitForPluginMode(projectRoot, options.deadline, now)) {
      return { state: 'complete', unresolvedPaths: unresolved };
    }
    return {
      state: 'deferred',
      advisory:
        'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.',
      unresolvedPaths: unresolved,
    };
  }
}
function concurrentMigrationResult(projectRoot, options, now) {
  const concurrentDeadline = Math.min(options.deadline, now() + 500);
  if (waitForPluginMode(projectRoot, concurrentDeadline, now)) {
    return { state: 'complete', unresolvedPaths: [] };
  }
  if (now() >= options.deadline) {
    return {
      state: 'deferred',
      advisory:
        'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.',
      unresolvedPaths: [],
    };
  }
  return recoveredAutomaticResult(projectRoot);
}
function planCleanupEntries(projectRoot, mutations) {
  try {
    return mutations.map(mutation => entryFor(projectRoot, mutation));
  } catch (error) {
    if (existsSync4(transactionPath(projectRoot))) return void 0;
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
  if (existsSync4(transactionPath(projectRoot)))
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
    transaction_id: randomUUID2(),
    disposition: 'complete-forward',
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
  if (!applyEntries(projectRoot, transaction.entries, () => now() >= options.deadline)) {
    return {
      state: 'deferred',
      advisory: 'Safeword will finish removing its old Claude integration on the next prompt.',
      unresolvedPaths: unresolved,
    };
  }
  writeAutomaticPluginMode(projectRoot, transaction);
  rmSync3(transactionPath(projectRoot), { force: true });
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}
function parseTransaction(cwd) {
  const value = JSON.parse(readFileSync3(transactionPath(cwd), 'utf8'));
  if (value.schema_version !== 1 || !Array.isArray(value.entries))
    throw new Error('Claude cleanup transaction is malformed.');
  return value;
}
function pendingRecoveryEntries(projectRoot, transaction) {
  const forward = transaction.disposition === 'complete-forward';
  const pending = [];
  for (const entry of transaction.entries) {
    const path = assertSafeClaudeCleanupTarget(projectRoot, entry.path);
    const current = observedSha(path);
    const source = forward ? entry.before_sha256 : entry.after_sha256;
    const destination = forward ? entry.after_sha256 : entry.before_sha256;
    if (current === destination) continue;
    if (current !== source) throw new Error(`Claude recovery conflict at ${entry.path}`);
    pending.push(entry);
  }
  return pending;
}
function applyRecoveryEntries(projectRoot, transaction, pending) {
  const forward = transaction.disposition === 'complete-forward';
  for (const entry of pending) {
    const path = containedClaudeCleanupPath(projectRoot, entry.path);
    writeImage(
      projectRoot,
      path,
      forward ? entry.after_base64 : entry.before_base64,
      forward ? entry.after_mode : entry.before_mode,
    );
  }
}
function completedRecoveryResult(projectRoot, transaction) {
  if (transaction.disposition === 'complete-forward') {
    writeAutomaticPluginMode(projectRoot, transaction);
  }
  rmSync3(transactionPath(projectRoot), { force: true });
  return createResult({
    state: 'changed',
    data: {
      command: 'claude recover',
      classification:
        transaction.disposition === 'complete-forward' ? 'plugin-mode' : 'cleanup-ready',
    },
  });
}
function recoverClaudeCleanup(cwd) {
  let projectRoot;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return cleanupFailure(error, 'recovery-required');
  }
  if (!existsSync4(transactionPath(projectRoot))) {
    return createResult({
      state: 'healthy',
      data: { command: 'claude recover', classification: 'plugin-mode' },
    });
  }
  try {
    const transaction = parseTransaction(projectRoot);
    applyRecoveryEntries(
      projectRoot,
      transaction,
      pendingRecoveryEntries(projectRoot, transaction),
    );
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
function legacyHookCommand(value, projectRoot) {
  if (typeof value === 'string') {
    const reference = /\.safeword\/hooks\/[^\s"';&|)]+/u.exec(value)?.[0];
    if (reference === void 0) return false;
    try {
      const hooksRoot = nodePath8.resolve(projectRoot, '.safeword/hooks');
      const target = nodePath8.resolve(projectRoot, reference);
      if (!target.startsWith(`${hooksRoot}${nodePath8.sep}`)) return false;
      return lstatSync4(target).isFile();
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some(child => legacyHookCommand(child, projectRoot));
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => legacyHookCommand(child, projectRoot));
}
function viableLegacyAuthority(event) {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR;
  if (projectRoot === void 0 || projectRoot === '') return false;
  const settingsPath = nodePath8.join(projectRoot, '.claude/settings.json');
  if (!existsSync5(settingsPath)) return false;
  try {
    const settings = parse2(readFileSync4(settingsPath, 'utf8'));
    return legacyHookCommand(settings.hooks?.[event], projectRoot);
  } catch {
    return false;
  }
}
function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === void 0 || value === '') throw new Error(`${name} is required.`);
  return value;
}
function readIdentity(pluginRoot) {
  const value = JSON.parse(readFileSync4(nodePath8.join(pluginRoot, 'identity.json'), 'utf8'));
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
    nodePath8.isAbsolute(asset.path) ||
    pathSegments.includes('..') ||
    !/^[\da-f]{64}$/u.test(asset.sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin inventory contains an unsafe asset.');
  }
}
function verifyInventoryAsset(pluginRoot, asset) {
  assertSafeInventoryAsset(asset);
  const assetPath = nodePath8.join(pluginRoot, asset.path);
  if (!lstatSync4(assetPath).isFile()) {
    throw new Error(`Safeword Claude plugin asset is not a regular file: ${asset.path}`);
  }
  const content = readFileSync4(assetPath);
  const actualDigest = createHash4('sha256').update(content).digest('hex');
  if (actualDigest !== asset.sha256) {
    throw new Error(
      `Safeword Claude plugin asset failed integrity validation: ${asset.path} (${actualDigest})`,
    );
  }
  return content;
}
function verifyInventory(pluginRoot, identity) {
  const inventoryContent = readFileSync4(nodePath8.join(pluginRoot, 'inventory.json'), 'utf8');
  const inventoryDigest = createHash4('sha256').update(inventoryContent).digest('hex');
  if (inventoryDigest !== identity.inventory_sha256) {
    throw new Error('Safeword Claude plugin inventory does not match its bundled identity.');
  }
  const inventory = JSON.parse(inventoryContent);
  if (inventory.schema_version !== 1 || !Array.isArray(inventory.assets)) {
    throw new Error('Safeword Claude plugin inventory is malformed.');
  }
  const inventoryPaths = new Set(inventory.assets.map(asset => asset.path));
  for (const requiredPath of CLAUDE_NATIVE_REQUIRED_ASSETS) {
    if (!inventoryPaths.has(requiredPath)) {
      throw new Error(
        `Safeword Claude plugin inventory is missing required asset: ${requiredPath}`,
      );
    }
  }
  const verifiedAssets = /* @__PURE__ */ new Map();
  for (const asset of inventory.assets) {
    assertSafeInventoryAsset(asset);
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
  const manifest = readFileSync4(nodePath8.join(pluginRoot, 'hooks', 'hooks.json'));
  const digest2 = createHash4('sha256').update(manifest).digest('hex');
  if (digest2 !== identity.hook_manifest_sha256) {
    throw new Error('Safeword Claude plugin hook manifest does not match its bundled identity.');
  }
}
function writeDurableRecord(pluginData, filename, record) {
  writeDurableFile(
    nodePath8.join(pluginData, filename),
    `${JSON.stringify(record, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
}
function setupRanForSession(pluginData, sessionId) {
  if (sessionId === void 0) return false;
  const path = nodePath8.join(pluginData, 'cache-smoke-v1.json');
  if (!existsSync5(path)) return false;
  try {
    const smoke = JSON.parse(readFileSync4(path, 'utf8'));
    return smoke.event === 'Setup' && smoke.session_id === sessionId;
  } catch {
    return false;
  }
}
function recordExecutionProof(event, pluginRoot, identity, input) {
  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  const pluginData = requiredEnvironment('CLAUDE_PLUGIN_DATA');
  if (event === 'SessionStart' && setupRanForSession(pluginData, input.session_id)) return;
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  const projectDigest = createHash4('sha256').update(projectRoot).digest('hex');
  writeDurableRecord(nodePath8.join(pluginData, 'execution-proofs-v2'), `${projectDigest}.json`, {
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
  writeDurableRecord(requiredEnvironment('CLAUDE_PLUGIN_DATA'), 'cache-smoke-v1.json', {
    schema_version: 1,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    inventory_sha256: identity.inventory_sha256,
    canonical_plugin_root: pluginRoot,
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
  return {
    status: result.status ?? 1,
    stdout: captureOutput ? (result.stdout?.toString('utf8') ?? '') : '',
  };
}
function eventEntryMatches(entry, input) {
  if (entry.matcher === void 0 || entry.matcher === '') return true;
  return entry.matcher.split('|').includes(input.source ?? '');
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
  if (current === next || current.split('\n').includes(next)) return current;
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
      const output = specificOutput(target, event);
      output.additionalContext = appendUniqueText(output.additionalContext, trimmed);
      return void 0;
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
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
  if (!existsSync5(path)) return { enabled: false, marketplace: void 0 };
  const settings = parse2(readFileSync4(path, 'utf8'));
  return {
    enabled: settings?.enabledPlugins?.['safeword@safeword'] === true,
    marketplace: settings?.extraKnownMarketplaces?.safeword,
  };
}
function incompatibleScopeOverlap(projectRoot) {
  const project = scopeDeclaration(nodePath8.join(projectRoot, '.claude/settings.json'));
  const user = scopeDeclaration(nodePath8.join(claudeConfigDirectory(), 'settings.json'));
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
function terminalMarkerExecution(context, marker) {
  return marker.advisory === void 0
    ? context.execution
    : advisoryExecution(context, marker.advisory);
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
function matchingAttention(projectRoot, identity, catalogueSha256) {
  const attention = readClaudeMigrationAttention(projectRoot);
  if (
    attention?.plugin_version !== identity.plugin_version ||
    attention.catalogue_sha256 !== catalogueSha256 ||
    attention.watched_settings_sha256 !== claudeWatchedSettingsDigest(projectRoot)
  ) {
    return void 0;
  }
  return attention;
}
function automaticMigrationAttemptKind(projectRoot) {
  return existsSync5(nodePath8.join(projectRoot, CLAUDE_MIGRATION_SCHEMA.paths.transaction))
    ? 'recovery'
    : 'migration';
}
function automaticMigrationProjectRoot(event, hookCwd) {
  if (event !== 'UserPromptSubmit') return void 0;
  return canonicalClaudeProjectRoot(hookCwd ?? process.cwd());
}
function upgradeConsistentLegacyMarker(event, projectRoot, identity, catalogueSha256) {
  if (
    !hasLegacyClaudePluginMode(projectRoot) ||
    viableLegacyAuthority(event) ||
    incompatibleScopeOverlap(projectRoot)
  ) {
    return false;
  }
  writeClaudePluginMode(
    projectRoot,
    createClaudePluginMode({
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      catalogue_sha256: catalogueSha256,
      unresolved_paths: [],
    }),
  );
  removeLegacyClaudePluginMode(projectRoot);
  return true;
}
function automaticMigrationUnsafe(event, identity, execution, sessionId, hookCwd) {
  const projectRoot = automaticMigrationProjectRoot(event, hookCwd);
  if (projectRoot === void 0) return execution;
  const context = { event, execution, projectRoot, sessionId };
  const catalogueSha256 = historicalCatalogueDigest();
  const marker = readClaudePluginMode(projectRoot);
  if (upgradeConsistentLegacyMarker(event, projectRoot, identity, catalogueSha256))
    return execution;
  if (marker !== void 0 && pluginModeIsTerminal(marker, catalogueSha256)) {
    return terminalMarkerExecution(context, marker);
  }
  if (incompatibleScopeOverlap(projectRoot)) {
    return scopeOverlapExecution(context, identity, catalogueSha256);
  }
  const attention = matchingAttention(projectRoot, identity, catalogueSha256);
  if (attention !== void 0) {
    return advisoryExecution(context, attention.advisory, attention.state_digest);
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
  if (event !== 'UserPromptSubmit') return execution;
  const advisory = `Safeword could not record native plugin proof: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked and the old integration was preserved.`;
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
function verifiedIdentity(event, pluginRoot) {
  try {
    const identity = readIdentity(pluginRoot);
    verifyManifest(pluginRoot, identity);
    const verifiedAssets = verifyInventory(pluginRoot, identity);
    const eventGroupsContent = verifiedAssets.get('runtime/event-groups.json');
    if (eventGroupsContent === void 0) {
      throw new Error('Safeword Claude plugin verified event groups are unavailable.');
    }
    return { eventGroupsContent, identity };
  } catch (error) {
    if (event !== 'UserPromptSubmit') throw error;
    const advisory = `Safeword detected a damaged native plugin cache: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked and the old integration was preserved.`;
    try {
      process.stdout.write(safeAppendMigrationAdvisory(event, '', advisory));
    } catch {}
    return void 0;
  }
}
function runEventHooks(event, hooks, standardInput, response) {
  for (const hook of hooks) {
    if (hook.type !== 'command' || typeof hook.command !== 'string') {
      throw new Error(`Safeword Claude plugin event group has an unsupported ${event} hook.`);
    }
    const result = runFunctionalCommand(['bash', '-lc', hook.command], standardInput, true);
    if (result.status !== 0) return result.status;
    mergeHookOutput(event, response, result.stdout);
  }
  return 0;
}
function runEventGroup(event, eventGroupsContent, hookInput, standardInput) {
  const entries = readEventEntries(event, eventGroupsContent);
  const response = {};
  for (const entry of entries) {
    if (!eventEntryMatches(entry, hookInput)) continue;
    const hooks = entry.hooks ?? [];
    const status = runEventHooks(event, hooks, standardInput, response);
    if (status !== 0) return { status, stdout: '' };
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
  const advisory = `Safeword could not combine its Claude hook output: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked and the old integration was preserved.`;
  return { status: 0, stdout: safeAppendMigrationAdvisory(event, '', advisory) };
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
  if (viableLegacyAuthority(input.event)) return { status: 0, stdout: '' };
  try {
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
function mainUnsafe(event, mode, command) {
  if (mode !== void 0 && mode !== '--' && mode !== '--event-group') {
    throw new Error('Expected -- or --event-group after the hook event.');
  }
  const pluginRoot = realpathSync2(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
  process.env.SAFEWORD_PLUGIN_CLI = nodePath8.join(pluginRoot, 'runtime', 'cli.js');
  const standardInput = readFileSync4(0);
  const hookInput = parseHookInput(standardInput);
  const verifiedPlugin = verifiedIdentity(event, pluginRoot);
  if (verifiedPlugin === void 0) return 0;
  const { eventGroupsContent, identity } = verifiedPlugin;
  let execution = executeConfiguredHooks({
    event,
    mode,
    command,
    eventGroupsContent,
    hookInput,
    standardInput,
  });
  if (execution.status === 0) {
    execution = postExecutionLifecycle(event, pluginRoot, identity, hookInput, execution);
    if (execution.stdout !== '') process.stdout.write(execution.stdout);
  }
  return execution.status;
}
function startupFailure(event, error) {
  const detail = error instanceof Error ? error.message : String(error);
  if (event === 'UserPromptSubmit') {
    const advisory = `Safeword could not start its Claude hook: ${detail} The prompt was not blocked and the old integration was preserved.`;
    try {
      process.stdout.write(safeAppendMigrationAdvisory(event, '', advisory));
    } catch {}
    return 0;
  }
  process.stderr.write(`Safeword could not safely start its ${event} hook: ${detail}
`);
  return 2;
}
function main() {
  const [event, mode, ...command] = process.argv.slice(2);
  if (event === void 0) throw new Error('Claude hook event is required.');
  try {
    return mainUnsafe(event, mode, command);
  } catch (error) {
    return startupFailure(event, error);
  }
}
process.exitCode = main();
