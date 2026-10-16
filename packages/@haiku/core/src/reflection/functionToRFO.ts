/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import {tokenizeParameters} from './Tokenizer';

export interface RFO {
  type: string;
  name: string;
  params: string[];
  body: string;
  injectee?: boolean;
}

function nth (n, type, arr) {
  const none = {value: null, type: 'void'};
  if (arr.length < 1 || n > arr.length) {
    return none;
  }
  let f = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].type === type) {
      f += 1;
    }
    if (f === n) {
      return arr[i];
    }
  }
  return none;
}

function tokensToParams (tokens) {
  if (tokens.length < 1) {
    return [];
  }

  // HACK: Rather than property ast-ize this, we're just going to go through it linearly and make JSON.
  let json = '';
  let frag = '';
  let next;
  let token = tokens.shift();
  const scopes = [];

  while (token) {
    switch (token.type) {
      case 'whitespace':
        frag = ' ';
        break;
      case 'comma':
        frag = ',';
        break;
      case 'colon':
        frag = ':';
        break;

      // Treat parens as an 'array' scope, e.g. at top level of function signature arguments
      case 'paren_open':
        frag = '[';
        scopes.push('square');
        break;
      case 'paren_close':
        frag = ']';
        scopes.pop();
        break;

      case 'square_open':
        frag = '[';
        scopes.push('square');
        break;
      case 'square_close':
        frag = ']';
        scopes.pop();
        break;

      case 'curly_open':
        frag = '{';
        scopes.push('curly');
        break;
      case 'curly_close':
        frag = '}';
        scopes.pop();
        break;

      case 'rest':
        next = tokens.shift();
        frag = JSON.stringify({__rest: next.value});
        break;

      case 'identifier':
        frag = '"' + token.value + '"';
        // If the next token is a comma, we are a self-referential property
        if (
          tokens[0] &&
          (tokens[0].type === 'comma' ||
            tokens[0].type === 'square_close' ||
            tokens[0].type === 'curly_close')
        ) {
          // Handle differently inside array vs object, e.g.:
          // { a: a, b: b } vs [ a, b, c ]
          const scope = scopes[scopes.length - 1];
          if (scope === 'square') {
            frag += '';
          } else {
            frag += ':"' + token.value + '"';
          }
        }
        break;

      default:
        frag = '';
    }

    json += frag;

    token = tokens.shift();
  }

  return JSON.parse(json);
}

// Removes default values (`a = 1`, `{b = f(2)}`) from a signature: only parameter names matter here.
function stripDefaultValues (signature: string): string {
  let out = '';
  let skipping = false;
  let depthWhenSkipping = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < signature.length; i++) {
    const char = signature[i];
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      if (skipping && depth < depthWhenSkipping) {
        skipping = false;
      }
    } else if (char === ',' && skipping && depth === depthWhenSkipping) {
      skipping = false;
    } else if (char === '=' && !skipping && signature[i + 1] !== '>' && signature[i + 1] !== '=') {
      skipping = true;
      depthWhenSkipping = depth;
      continue;
    }
    if (!skipping) {
      out += char;
    }
  }
  return out;
}

function signatureToParams (signature) {
  try {
    const tokens = tokenizeParameters(stripDefaultValues(signature));
    const clean = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'whitespace') {
        clean.push(tokens[i]);
      }
    }
    return tokensToParams(clean);
  } catch (exception) {
    console.warn(`Unable to parse signature ${signature}`, exception);
    return [];
  }
}

// Index of the bracket closing the one at `open`, skipping strings; -1 if unbalanced.
function matchingClose (str: string, open: number): number {
  const pairs = {'(': ')', '[': ']', '{': '}'};
  const stack = [];
  let quote = null;
  for (let i = open; i < str.length; i++) {
    const char = str[i];
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (pairs[char]) {
      stack.push(pairs[char]);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return i;
      }
    }
  }
  return -1;
}

// Index of the arrow (=>) of an arrow function, outside any brackets; -1 if there is none.
function topLevelArrow (str: string): number {
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '[' || char === '{') {
      const close = matchingClose(str, i);
      if (close < 0) {
        return -1;
      }
      i = close;
    } else if (char === '"' || char === "'" || char === '`') {
      return -1;
    } else if (char === '=' && str[i + 1] === '>') {
      return i;
    }
  }
  return -1;
}

export default function functionToRFO (fn) {
  let str = fn.toString().trim();

  // HACK: Remove paren wrapping if any was provided
  if (str[str.length - 1] === ')') {
    if (str[0] === '(' && matchingClose(str, 0) === str.length - 1) {
      str = str.slice(1, -1).trim();
    }
  }

  let type;
  let name = null;
  let signature;
  let body;

  const arrow = str.startsWith('function') || str.startsWith('async function') ? -1 : topLevelArrow(str);
  if (arrow >= 0) {
    // (a, b) => {...}, a => {...}, (a, b) => expression
    type = 'ArrowFunctionExpression';
    const head = str.slice(0, arrow).trim().replace(/^async\s+/, '');
    signature = head.startsWith('(') ? head : `(${head})`;
    const tail = str.slice(arrow + 2).trim();
    body = tail.startsWith('{') && matchingClose(tail, 0) === tail.length - 1
      ? tail.slice(1, -1).trim() // Don't include braces or padding
      : `return ${tail.replace(/;\s*$/, '')};`;
  } else {
    // function name (a, b) {...}, and method shorthand name (a, b) {...}
    type = 'FunctionExpression';
    const pidx1 = str.indexOf('(');
    const pidx2 = matchingClose(str, pidx1);
    const prefix = str.slice(0, pidx1);
    signature = str.slice(pidx1, pidx2 + 1);
    const suffix = str.slice(pidx2 + 1, str.length);
    body = suffix.slice(suffix.indexOf('{') + 1, suffix.length - 1).trim(); // Don't include braces or padding
    name = nth(2, 'identifier', tokenizeParameters(prefix)).value;
  }
  const params = signatureToParams(signature);

  const spec: RFO = {
    type,
    name,
    params,
    body,
  };

  // If the runtime function is labeled as an injectee, we *must* indicate as much
  // in the specification so that serialization back to code wraps it properly
  if (fn.injectee) {
    spec.injectee = true;
  }

  return {
    __function: spec,
  };
}
