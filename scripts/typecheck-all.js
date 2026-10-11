const cp = require('child_process');
const log = require('./helpers/log');
const allPackages = require('./helpers/packages')();

// Type-checks each package's sources *and* tests (tsconfig.all.json). Tests themselves run with ts-node in
// transpile-only mode, so this is where their types are verified. Run after `yarn compile-all`.
const failures = [];

allPackages.forEach((pack) => {
  if (!pack.pkg.scripts || !pack.pkg.scripts.typecheck) {
    return;
  }

  try {
    log.log('type-checking ' + pack.name);
    cp.execSync('yarn run typecheck', {cwd: pack.abspath, stdio: 'inherit'});
  } catch (exception) {
    failures.push(pack.name);
  }
});

if (failures.length > 0) {
  log.err(`type errors in: ${failures.join(', ')}`);
  process.exit(1);
}

log.hat('all packages type-check');
