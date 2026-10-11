const cp = require('child_process');
const log = require('./helpers/log');
const allPackages = require('./helpers/packages')();
const unbuildables = require('./helpers/unbuildables');

// A package whose test run hangs (e.g. a crash swallowed by a fatal-error handler) is killed after this long.
const PACKAGE_TEST_TIMEOUT_MS = 15 * 60 * 1000;

const failures = [];

allPackages.forEach((pack) => {
  if (unbuildables.includes(pack.name) || !pack.pkg.scripts || !pack.pkg.scripts.test) {
    return;
  }

  try {
    log.log('running tests in ' + pack.name);
    cp.execSync('yarn run test', {cwd: pack.abspath, stdio: 'inherit', timeout: PACKAGE_TEST_TIMEOUT_MS});
  } catch (exception) {
    log.err(`tests failed in ${pack.name}: ${exception.message}`);
    failures.push(pack.name);
  }
});

if (failures.length > 0) {
  log.err(`test failures in: ${failures.join(', ')}`);
  process.exit(1);
}

log.hat('all package tests passed');
