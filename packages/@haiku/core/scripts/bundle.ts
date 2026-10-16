// Builds browser bundles of the runtime adapters into dist/ (for <script> tag use without a bundler):
// an IIFE exposing a global, plus a minified copy. Run with `yarn bundle` (compiles lib/ first).
const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const ADAPTERS = [
  {bundle: 'dom', entry: 'dom/index.js', globalName: 'HaikuDOMAdapter'},
  {bundle: 'element', entry: 'dom/element/index.js', globalName: 'HaikuElementAdapter'},
  {bundle: 'vue-dom', entry: 'dom/vue/index.js', globalName: 'HaikuVueAdapter', external: ['vue']},
];

const build = ({bundle, entry, globalName, external = []}, minify) => esbuild.build({
  entryPoints: [path.join(ROOT, entry)],
  outfile: path.join(DIST, `${bundle}.bundle${minify ? '.min' : ''}.js`),
  bundle: true,
  format: 'iife',
  globalName,
  // The CommonJS entry points export the adapter as module.exports.
  footer: {js: `${globalName} = ${globalName} && ${globalName}.default || ${globalName};`},
  external,
  minify,
  target: 'es2019',
  platform: 'browser',
  tsconfig: path.join(ROOT, 'tsconfig.json'),
  logLevel: 'warning',
});

Promise.all(ADAPTERS.flatMap((adapter) => [build(adapter, false), build(adapter, true)]))
  .then(() => console.log(`bundles written to ${DIST}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
