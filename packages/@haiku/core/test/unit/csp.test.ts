import * as tape from 'tape';
import * as TestHelpers from '../TestHelpers';

import {compilePlaybackExpression} from '@core/HaikuTimeline';
import functionToRFO from '@core/reflection/functionToRFO';

const pkg = require('../../package.json');

// Under a strict Content-Security-Policy (no 'unsafe-eval') the browser refuses `new Function`.
const withoutEval = (run: () => void) => {
  const globals = global as any;
  const OriginalFunction = globals.Function;
  globals.Function = function () {
    throw new EvalError('Refused to evaluate a string as JavaScript (Content-Security-Policy)');
  };
  try {
    run();
  } finally {
    globals.Function = OriginalFunction;
  }
};

tape('csp: playback directives are compiled without eval', (t) => {
  withoutEval(() => {
    t.equal(compilePlaybackExpression(['$time', '+', 100])(50), 150, 'addition');
    t.equal(compilePlaybackExpression(['(', '$time', '+', 1, ')', '*', 2])(4), 10, 'parentheses');
    t.equal(compilePlaybackExpression(['$time', '-', 2, '*', 3])(10), 4, 'operator precedence');
    t.equal(compilePlaybackExpression(['$time', '%', 1000])(2500), 500, 'modulo');
    t.equal(compilePlaybackExpression(['-', '$time', '+', 10])(3), 7, 'unary minus');
    t.equal(compilePlaybackExpression([2, '**', 3, '**', 2])(0), 512, 'power is right-associative');
    t.equal(compilePlaybackExpression(['$time', '+', 'alert', '(', 1, ')']), undefined, 'rejects anything else');
    t.equal(compilePlaybackExpression(['$time', '+']), undefined, 'rejects incomplete expressions');
  });
  t.end();
});

tape('csp: legacy event handlers are migrated without eval', (t) => {
  const received = [];
  const bytecode = {
    metadata: {core: pkg.version},
    eventHandlers: {
      foo: {
        click: {
          handler (target, event) {
            received.push([target, event]);
            return 'handled';
          },
        },
      },
    },
  };

  withoutEval(() => {
    TestHelpers.createComponent(bytecode, {}, (component, teardown) => {
      const migrated = component.bytecode.eventHandlers.foo.click.handler;
      t.equal(migrated('component', 'element', 'target', 'event'), 'handled', 'the handler still runs');
      t.deepEqual(received[0], ['target', 'event'], 'arguments are passed by parameter name');
      t.deepEqual(
        functionToRFO(migrated).__function.params,
        ['component', 'element', 'target', 'event'],
        'serializing writes the migrated signature',
      );
      t.ok(functionToRFO(migrated).__function.body.includes('received.push'), 'with the original body');
      teardown();
      t.end();
    });
  });
});

tape('csp: a function name from data cannot inject code', (t) => {
  const functionSpecificationToFunction = require('@core/reflection/functionSpecificationToFunction').default;
  const fn = functionSpecificationToFunction('x(){}; globalThis.injected = true; function y', [], 'return 1;');
  t.equal(fn(), 1, 'the function still works');
  t.notOk((global as any).injected, 'the name is not interpreted as code');
  t.equal(functionSpecificationToFunction('handler', [], 'return 2;').name, 'handler', 'plain names are kept');
  t.end();
});

tape('functionSpecificationToFunction: named arrow function specifications', (t) => {
  const functionSpecificationToFunction = require('@core/reflection/functionSpecificationToFunction').default;
  const fn = functionSpecificationToFunction('handler', ['a', 'b'], 'return a + b;', 'ArrowFunctionExpression');
  t.equal(fn(1, 2), 3, 'an arrow specification with a name becomes a working arrow function');
  t.end();
});
