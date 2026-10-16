/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import marshalParams from './marshalParams';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export default function functionSpecificationToFunction (rawName, params, body, type = 'FunctionExpression') {
  // The name is placed into source code, so only accept a plain identifier.
  const name = typeof rawName === 'string' && IDENTIFIER.test(rawName) ? rawName : '';
  let fn;

  if (type === 'ArrowFunctionExpression') {
    fn = new Function(
      '\n' +
      // Arrow functions have no name of their own.
      'return (' +
      marshalParams(params) +
      ') => {\n' +
      '  ' +
      (body || '') +
      '\n' +
      '}\n',
    )();
  } else {
    fn = new Function(
      '\n' +
      'return function ' +
      (name || '') +
      '(' +
      marshalParams(params) +
      ') {\n' +
      '  ' +
      (body || '') +
      '\n' +
      '}\n',
    )();
  }

  return fn;
}
