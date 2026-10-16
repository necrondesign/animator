/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import marshalParams from './marshalParams';

export default function functionSpecificationToFunction (name, params, body, type = 'FunctionExpression') {
  let fn;

  if (type === 'ArrowFunctionExpression') {
    fn = new Function(
      '\n' +
      'return ' +
      (name || '') +
      '(' +
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
