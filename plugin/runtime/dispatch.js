// claude-plugin/runtime/dispatch.ts
import { spawnSync as spawnSync2 } from 'node:child_process';
import { createHash as createHash4 } from 'node:crypto';
import {
  existsSync as existsSync7,
  lstatSync as lstatSync5,
  readFileSync as readFileSync6,
  realpathSync as realpathSync3,
} from 'node:fs';
import nodePath9 from 'node:path';

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

// claude-plugin/cleanup.ts
import { createHash as createHash3, randomUUID as randomUUID3 } from 'node:crypto';
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
  renameSync as renameSync2,
  rmdirSync as rmdirSync2,
  rmSync as rmSync4,
  writeSync,
} from 'node:fs';
import nodePath8 from 'node:path';

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
        '008fa4b5777834118ba0efd008862df52dd32d3feec2218537d7c90cbfdfd904',
      '.claude/agents/safeword-reviewer.md':
        '13333228aa180c0ff040ccfe4e16058147fadc596b51df0d6d73caeb01755470',
      '.claude/skills/audit/SKILL.md':
        '64afc92c419a8354c015f18ffe0cc581cfce48cb3fee3db8e3c39d75844fb2d3',
      '.claude/skills/bdd/DISCOVERY.md':
        'cc296952af2673b55adec79e61d4ea2c6c44b2865308fa85444b18dd1907b5e1',
      '.claude/skills/bdd/DONE.md':
        'e9f22430341cf225eaf58ef6335720c5033cb8f6779425d5740adc0ff80a5f60',
      '.claude/skills/bdd/PLAN_IMPLEMENTATION.md':
        '0d1c9103c9e6c00b4fb43d3c90a5118f90b9feb964b15daf12340a06d53e4f9a',
      '.claude/skills/bdd/SCENARIOS.md':
        '0abfced2f9473ae33f63913890d63dcd2232f1aad6779020449cc3e16f182fc7',
      '.claude/skills/bdd/SKILL.md':
        '970d5af3af22e599126b5a15f75ec9c9478fd0ca810b31ec33d2dbd94ec83516',
      '.claude/skills/bdd/SPLITTING.md':
        'e232a37a4d76f0dfc51e65965c1e1b7f1572e0dedce0fb8c031e75bd6544a708',
      '.claude/skills/bdd/TDD.md':
        'ed311cb035ab485577319ed21866b40a8406e3551989e4e5ae8b414cbb165eb9',
      '.claude/skills/bdd/VERIFY.md':
        '85abadfe756a3f391779fe500cd5c66597a33e0cab7fcef55f6b633b30818f31',
      '.claude/skills/brainstorm/SKILL.md':
        'fe99638bd1621cbd5fe3780a8d39023d4b175e3be2aef2e60d0ebe7558848f2e',
      '.claude/skills/cleanup-zombies/SKILL.md':
        'e0af9635774767cf36eb69726e11c642ec1dad42839c11407ea8ef60f89fc289',
      '.claude/skills/closeout/SKILL.md':
        '1fcbf06b7acf0e549cad4b964fbde3e4dc31feb601e75516041ec211c1bcb66a',
      '.claude/skills/debug/SKILL.md':
        'ae56c4c9287f76a2250d13fa9908f5726ed4edbe4080ece10d1559507e242bd0',
      '.claude/skills/demand-research/SKILL.md':
        '9271c21513cdb7048cf72c6343af17fed76a381569211eba24b31ba71c79381a',
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
        'b23b1bb565f0a4551defa0641b52254133807b1c79495641d82bba9102fd19ff',
      '.claude/skills/quality-review/SKILL.md':
        '9c7b0a5065d184fed0fd19e449c7a304eee35e376d052409163c3a83501ece27',
      '.claude/skills/refactor/SKILL.md':
        'a51a858fb13b50cbc86789edbde8a39e364b5cdd7d5d3b025d555d90b221760e',
      '.claude/skills/retro-filer/SKILL.md':
        'ea126f3805a2befefb4db2011439f075ebfd6eca31b78bd5f284ac11d667b4f0',
      '.claude/skills/retro/SKILL.md':
        'd01abb281a1c941024f304709c8727769383eb76d0ccc7da53f73776c4a0122d',
      '.claude/skills/review-spec/SKILL.md':
        'e5b335195da77f49f691142e7554140a268923f16ef6eb911fde601ec1693cd1',
      '.claude/skills/self-review/SKILL.md':
        'e5ff994ec84573e6f129127bad89617f0a67b67c5cf792cedac558b6e419ac3b',
      '.claude/skills/spike/SKILL.md':
        '905aab56037ad5a258bafa91cb2ebf05cff1acffbc9e1fd6f7a1f27230672f37',
      '.claude/skills/tdd-review/SKILL.md':
        '4b945f122a90d23462845d7bdbbd0b736aa69d423a2d7e99ebf646bf118faa4f',
      '.claude/skills/testing/SKILL.md':
        '697a4b090935989e0c8a53462d2b44087afafa50adc69e9a98da14bed23dbde9',
      '.claude/skills/ticket-system/SKILL.md':
        '97595a9875cdca30ea26c809a26e5be7df338a42034d6122b559e70275f2477e',
      '.claude/skills/verify/SKILL.md':
        '5b62944599be519ca06158c078702df9dfadc11a99f27ed19ede4bdcfc5cc0c8',
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
        'b730b5c63eb5b860203a2b453aaddbf8271050cab8b3479c23bc8fcc47d79205',
      '.safeword/hooks/pre-tool-config-guard.ts':
        '6bae1971493bc8fae0ce30db07f14a93ad660af11ca9fdf93518b23102d4f084',
      '.safeword/hooks/pre-tool-dependency-readiness.ts':
        'd23343dc3185916140a4b25572f3bb413aece93311f5084444c0debe188f85b8',
      '.safeword/hooks/pre-tool-git-bare-fix.sh':
        '0c75b7be01af1312cbbe86cf5964fb23520c8b9ef90f49075dd74e27ba58d414',
      '.safeword/hooks/pre-tool-quality.ts':
        'cf0af5ea412b487aa4cd3ed514123d6bd689056a57cd41bca511d01dfcf6831e',
      '.safeword/hooks/pre-tool-stale-main.ts':
        'cec806aeb0bfd132d45102eab631155da82b48869f4159cb49cf205d354c3e7e',
      '.safeword/hooks/prompt-questions.ts':
        '0d141bff2d063a61e4c1c8833d6219ceadabde861de1d23a68f2cf36e932c462',
      '.safeword/hooks/prompt-retro-nudge.ts':
        '78353d6f47adb0ed9969e83b40429d5792a98789dff67ec0bc4d5a024b1da457',
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
        '4810e508b3ef79e162c6e74e169e24f8eb7ae7980549ba3f53e640424ae10773',
      '.safeword/hooks/session-dependency-readiness.ts':
        '295d14c5a3d8112b01259cf89ce718144a568e62e0baf5aaa19eca3fcfdc50ff',
      '.safeword/hooks/session-lint-check.ts':
        '54bfe1e63777fbed4f3a002a76cd627410ccc627832d1a1d2ef41bed1ea80cc2',
      '.safeword/hooks/session-reply-format.ts':
        '41f7578e93188d5efacdd9ecbf29f72753a6fe98bca71fe321c61f547aeb8532',
      '.safeword/hooks/session-safeword-context.ts':
        '56c7a97a760c978e747010192855709baad66adda31e04f6c35d9279b87b19a5',
      '.safeword/hooks/session-start-reentry.ts':
        'b9f02a92eec2b195833660e9f5becab80e44a217094c188cd47b4ca9f7d1900d',
      '.safeword/hooks/session-version.ts':
        'c6160a3ea0ef65345c89b3c1dcf5a4177a408d94ab7efda82d86f9d455815c64',
      '.safeword/hooks/stop-quality.ts':
        'bf6faa1401fd655fe9ac64cde87cd47fa0accac96f300487a2528c9491a06d13',
      '.safeword/hooks/stop-reentry.ts':
        'a84d34d0798c83177d6ccc733299e9632e8485b700ef92ec53f153d68a1cfba5',
      '.safeword/hooks/stop-retro-filing.ts':
        'ae5693347a530547701c7fd9efd9d76ee4f690cd235b7e28b409d59d6090417d',
      '.safeword/hooks/stop-retro.ts':
        '5b0767121376bac1ad9f2b57765f0e705b1c34bff72724133014d31e39c0b916',
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

// claude-plugin/inventory.ts
import {
  closeSync as closeSync2,
  constants as fsConstants,
  fstatSync,
  lstatSync as lstatSync2,
  openSync as openSync2,
  readdirSync,
  readSync,
  realpathSync,
} from 'node:fs';
import nodePath4 from 'node:path';
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
    const linkedBefore = lstatSync2(path);
    if (!isSmallRegularMetadata(linkedBefore)) return void 0;
    descriptor = openSync2(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    const linkedAfter = lstatSync2(path);
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
function isClaudeLeaseMarker(path, name) {
  const pid = leaseMarkerPid(name);
  if (pid === void 0) return false;
  const content = readSmallMetadataFile(path);
  if (content === void 0) return false;
  try {
    return isLeaseRecord(JSON.parse(content), Number(pid));
  } catch {
    return false;
  }
}
function isClaudeCacheMetadataFile(logicalDirectory, physicalPath, entry) {
  if (!entry.isFile()) return false;
  if (logicalDirectory === '.in_use') return isClaudeLeaseMarker(physicalPath, entry.name);
  if (logicalDirectory !== '' || entry.name !== '.orphaned_at') return false;
  return /^\d{13}\n?$/u.test(readSmallMetadataFile(physicalPath) ?? '');
}
function directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot) {
  const metadata = lstatSync2(physicalDirectory);
  const canonical = realpathSync(physicalDirectory);
  const insideRoot =
    canonical === canonicalRoot || canonical.startsWith(`${canonicalRoot}${nodePath4.sep}`);
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
      const physicalPath = nodePath4.join(physicalDirectory, entry.name);
      const logicalPath =
        logicalDirectory === '' ? entry.name : nodePath4.posix.join(logicalDirectory, entry.name);
      if (isClaudeCacheMetadataFile(logicalDirectory, physicalPath, entry)) continue;
      if (entry.isDirectory()) visit3(physicalPath, logicalPath);
      else files.push(logicalPath);
    }
  };
  visit3(root, '');
  return files;
}

// claude-plugin/legacy-classifier.ts
import {
  existsSync as existsSync3,
  lstatSync as lstatSync3,
  readFileSync as readFileSync2,
} from 'node:fs';
import nodePath5 from 'node:path';
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
    const path = nodePath5.join(cwd, relativePath);
    if (!existsSync3(path)) continue;
    try {
      const safePath = assertSafeClaudeCleanupTarget(cwd, relativePath);
      const regular = lstatSync3(safePath).isFile();
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
  const settingsPath = nodePath5.join(cwd, '.claude/settings.json');
  if (!existsSync3(settingsPath)) return { recognizedHooks: [], conflictingHooks: [] };
  if (!lstatSync3(settingsPath).isFile()) {
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
import { createHash as createHash2, randomUUID as randomUUID2 } from 'node:crypto';
import {
  existsSync as existsSync4,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync3,
  rmSync as rmSync2,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath6 from 'node:path';
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
  return createHash2('sha256').update(value).digest('hex');
}
function attemptsPath(cwd) {
  return nodePath6.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attemptsDirectory);
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
  const path = nodePath6.join(directory, 'initial-session-v1.json');
  exclusiveRecord(path, { schema_version: 1, session_digest: sessionDigest });
  try {
    const value = JSON.parse(readFileSync3(path, 'utf8'));
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
  const directory = nodePath6.join(
    attemptsPath(cwd),
    kind === 'recovery' && !initialSession ? 'recoveries' : 'launches',
  );
  mkdirSync2(directory, { recursive: true, mode: 448 });
  for (let slot = 1; slot <= limit; slot += 1) {
    if (
      exclusiveRecord(nodePath6.join(directory, `${sessionDigest}-${String(slot)}.json`), {
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
  const directory = nodePath6.join(attemptsPath(cwd), 'advisories');
  mkdirSync2(directory, { recursive: true, mode: 448 });
  const sessionDigest = migrationSessionDigest(sessionId, fallbackSessionId);
  return exclusiveRecord(nodePath6.join(directory, `${sessionDigest}-${stateDigest}.json`), {
    schema_version: 1,
    session_digest: sessionDigest,
    state_digest: stateDigest,
  });
}
function advisoryStateDigest(advisory) {
  return digest(advisory);
}
function claudeConfigDirectory(environment = process.env) {
  const configured = (environment.CLAUDE_CONFIG_DIR ?? '').trim();
  return configured === '' ? nodePath6.join(homedir(), '.claude') : configured;
}
function claudeWatchedSettingsDigest(cwd) {
  const configDirectory = claudeConfigDirectory();
  const paths = [
    nodePath6.join(cwd, '.claude/settings.json'),
    nodePath6.join(configDirectory, 'settings.json'),
  ];
  const hash = createHash2('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(existsSync4(path) ? readFileSync3(path) : '<absent>');
    hash.update('\0');
  }
  return hash.digest('hex');
}
function markerPath(cwd) {
  return nodePath6.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
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
  const path = markerPath(cwd);
  if (!existsSync4(path)) return void 0;
  try {
    const value = JSON.parse(readFileSync3(path, 'utf8'));
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
    nodePath6.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attention),
    `${JSON.stringify(attention, void 0, 2)}
`,
    { mode: 384 },
  );
}
function removeLegacyClaudePluginMode(cwd) {
  rmSync2(nodePath6.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker), { force: true });
}

// claude-plugin/project-root.ts
import { spawnSync } from 'node:child_process';

// utils/fs.ts
import {
  chmodSync,
  existsSync as existsSync5,
  mkdirSync as mkdirSync3,
  readdirSync as readdirSync2,
  readFileSync as readFileSync4,
  realpathSync as realpathSync2,
  rmdirSync,
  rmSync as rmSync3,
  statSync,
  writeFileSync as writeFileSync2,
} from 'node:fs';
import nodePath7 from 'node:path';
var __dirname = import.meta.dirname;
function canonicalDirectory(path) {
  if (typeof path !== 'string' || path.trim() === '') return void 0;
  try {
    if (!statSync(path).isDirectory()) return void 0;
    return nodePath7.normalize(realpathSync2(path));
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
  const path = nodePath8.join(cwd, relative);
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
  return containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.transaction);
}
function writeTransaction(cwd, transaction) {
  const path = transactionPath(cwd);
  mkdirSync4(nodePath8.dirname(path), { recursive: true, mode: 448 });
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
  const parentPath = nodePath8.dirname(path);
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
  const quarantineDirectory = nodePath8.dirname(safeQuarantinePath);
  mkdirSync4(quarantineDirectory, { recursive: true, mode: 448 });
  beforeQuarantine?.();
  renameSync2(opened.path, safeQuarantinePath);
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
  const parent = lstatSync4(nodePath8.dirname(path));
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
    let directory = nodePath8.dirname(entry.path);
    while (directory === '.claude' || directory.startsWith('.claude/')) {
      candidates.add(directory);
      directory = nodePath8.dirname(directory);
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
  const marker = containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
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
  rmSync4(transactionPath(projectRoot), { force: true });
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
    !nodePath8.isAbsolute(entry.quarantine_path) &&
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
  rmSync4(transactionPath(projectRoot), { force: true });
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
}
function acceptedLegacyHookReference(value, projectRoot) {
  const reference = /\.safeword\/hooks\/[^\s"';&|)]+/u.exec(value)?.[0];
  if (reference === void 0) return false;
  try {
    const hooksRoot = nodePath9.resolve(projectRoot, '.safeword/hooks');
    const target = nodePath9.resolve(projectRoot, reference);
    if (!target.startsWith(`${hooksRoot}${nodePath9.sep}`)) return false;
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
  const settings = parseSettings(nodePath9.join(projectRoot, '.claude/settings.json'));
  const hooks = settings?.hooks;
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return false;
  const entries = hooks[event];
  return (
    Array.isArray(entries) &&
    entries.some(
      entry => isAcceptedHistoricalHook(event, entry) && acceptedLegacyHookFile(entry, projectRoot),
    )
  );
}
function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === void 0 || value === '') throw new Error(`${name} is required.`);
  return value;
}
function readIdentity(pluginRoot) {
  const value = JSON.parse(readFileSync6(nodePath9.join(pluginRoot, 'identity.json'), 'utf8'));
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
    nodePath9.isAbsolute(asset.path) ||
    pathSegments.includes('..') ||
    !/^[\da-f]{64}$/u.test(asset.sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin inventory contains an unsafe asset.');
  }
}
function verifyInventoryAsset(pluginRoot, asset) {
  assertSafeInventoryAsset(asset);
  const assetPath = nodePath9.join(pluginRoot, asset.path);
  if (!lstatSync5(assetPath).isFile()) {
    throw new Error(`Safeword Claude plugin asset is not a regular file: ${asset.path}`);
  }
  const content = readFileSync6(assetPath);
  const actualDigest = createHash4('sha256').update(content).digest('hex');
  if (actualDigest !== asset.sha256) {
    throw new Error(
      `Safeword Claude plugin asset failed integrity validation: ${asset.path} (${actualDigest})`,
    );
  }
  return content;
}
function verifyInventory(pluginRoot, identity) {
  const inventoryContent = readFileSync6(nodePath9.join(pluginRoot, 'inventory.json'), 'utf8');
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
  const manifest = readFileSync6(nodePath9.join(pluginRoot, 'hooks', 'hooks.json'));
  const digest2 = createHash4('sha256').update(manifest).digest('hex');
  if (digest2 !== identity.hook_manifest_sha256) {
    throw new Error('Safeword Claude plugin hook manifest does not match its bundled identity.');
  }
}
function writeDurableRecord(pluginData, filename, record2) {
  writeDurableFile(
    nodePath9.join(pluginData, filename),
    `${JSON.stringify(record2, void 0, 2)}
`,
    {
      mode: 384,
    },
  );
}
function setupRanForSession(pluginData, sessionId, pluginRoot, projectRoot, identity) {
  if (sessionId === void 0) return false;
  const path = nodePath9.join(pluginData, 'cache-smoke-v1.json');
  if (!existsSync7(path)) return false;
  try {
    const smoke = JSON.parse(readFileSync6(path, 'utf8'));
    const expected = {
      schema_version: 1,
      event: 'Setup',
      session_id: sessionId,
      project_root: projectRoot,
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      inventory_sha256: identity.inventory_sha256,
      canonical_plugin_root: pluginRoot,
    };
    return Object.entries(expected).every(([key, value]) => smoke[key] === value);
  } catch {
    return false;
  }
}
function recordExecutionProof(event, pluginRoot, identity, input) {
  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  const pluginData = requiredEnvironment('CLAUDE_PLUGIN_DATA');
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  if (
    event === 'SessionStart' &&
    setupRanForSession(pluginData, input.session_id, pluginRoot, projectRoot, identity)
  ) {
    return;
  }
  const projectDigest = createHash4('sha256').update(projectRoot).digest('hex');
  writeDurableRecord(nodePath9.join(pluginData, 'execution-proofs-v2'), `${projectDigest}.json`, {
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
  writeDurableRecord(requiredEnvironment('CLAUDE_PLUGIN_DATA'), 'cache-smoke-v1.json', {
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
  return {
    status: result.status ?? 1,
    stdout: captureOutput ? (result.stdout?.toString('utf8') ?? '') : '',
  };
}
var TOOL_EVENTS = /* @__PURE__ */ new Set([
  'PermissionDenied',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
]);
function eventEntryMatches(event, entry, input) {
  if (entry.matcher === void 0 || entry.matcher === '') return true;
  const subject = TOOL_EVENTS.has(event) ? input.tool_name : input.source;
  return entry.matcher.split('|').includes(subject ?? '');
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
  const project = scopeDeclaration(nodePath9.join(projectRoot, '.claude/settings.json'));
  const user = scopeDeclaration(nodePath9.join(claudeConfigDirectory(), 'settings.json'));
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
  return existsSync7(nodePath9.join(projectRoot, CLAUDE_MIGRATION_SCHEMA.paths.transaction))
    ? 'recovery'
    : 'migration';
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
  if (event !== 'UserPromptSubmit') return execution;
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
    const advisory = `Safeword detected a damaged native plugin cache: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; no native Safeword hook result was applied.`;
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
    if (result.status !== 0) {
      return event === 'UserPromptSubmit' ? result.status : 2;
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
  const advisory = `Safeword could not combine its Claude hook output: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; no combined Safeword hook result was applied.`;
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
  if (viableLegacyAuthority(input.event, input.projectRoot)) return { status: 0, stdout: '' };
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
function exposePackagedSafewordContext(pluginRoot) {
  const packagedSafewordPath = nodePath9.join(pluginRoot, 'resources', 'SAFEWORD.md');
  if (existsSync7(packagedSafewordPath)) {
    process.env.SAFEWORD_PACKAGED_CONTEXT_PATH = packagedSafewordPath;
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
  process.env.SAFEWORD_PLUGIN_CLI = nodePath9.join(pluginRoot, 'runtime', 'cli.js');
  exposePackagedSafewordContext(pluginRoot);
  const standardInput = readFileSync6(0);
  const hookInput = parseHookInput(standardInput);
  const projectRoot = canonicalClaudeProjectRoot(hookInput.cwd ?? process.cwd());
  const verifiedPlugin = verifiedIdentity(event, pluginRoot);
  if (verifiedPlugin === void 0) return 0;
  const { eventGroupsContent, identity } = verifiedPlugin;
  let execution = executeConfiguredHooks({
    event,
    mode,
    command,
    eventGroupsContent,
    hookInput,
    projectRoot,
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
    const advisory = `Safeword could not start its Claude hook: ${detail} The prompt was not blocked; no Safeword hook result was applied.`;
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
