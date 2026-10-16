import * as tape from 'tape';
import functionToRFO from '@core/reflection/functionToRFO';

const spec = (fn) => functionToRFO(fn).__function;

tape('functionToRFO: arrow functions and tricky signatures', (t) => {
  t.deepEqual(
    spec((a, b) => a + b),
    {type: 'ArrowFunctionExpression', name: null, params: ['a', 'b'], body: 'return a + b;'},
    'concise arrow body becomes a return statement',
  );
  const single = new Function('return x => x * 2')();
  t.deepEqual(spec(single).params, ['x'], 'single parameter without parentheses');
  t.equal(spec(single).body, 'return x * 2;', 'single parameter body');
  t.deepEqual(
    spec(({$element, $event}) => {
      return [$element, $event];
    }).params,
    [{$element: '$element', $event: '$event'}],
    'destructured injectables in an arrow function',
  );
  const withDefaults = new Function('return function named (a = Math.max(1, 2), b) { return a + b; }')();
  t.deepEqual(spec(withDefaults).params, ['a', 'b'], 'default values are skipped, even with parentheses');
  const destructuredDefaults = new Function('return function ({$element, x = [1, 2]} = {}, y = "a,b") {}')();
  t.deepEqual(
    spec(destructuredDefaults).params,
    [{$element: '$element', x: 'x'}, 'y'],
    'defaults inside destructuring and string defaults',
  );
  t.equal(spec(withDefaults).name, 'named', 'function name');
  t.equal(spec(withDefaults).body, 'return a + b;', 'function body');
  const method = {handler (a) {
    return () => a;
  }}.handler;
  t.equal(spec(method).type, 'FunctionExpression', 'method shorthand is not mistaken for an arrow function');
  t.equal(spec(method).body, 'return () => a;', 'method body keeps inner arrows');
  t.end();
});
